// 统一采集器 - 根据信息源类型自动选择 RSS 或 Web 采集方式
import Parser from 'rss-parser'
import { prisma } from './db'
import { WebScrapeConfig } from './sources/types'

const parser = new Parser({
  timeout: 15000,
  requestOptions: {
    timeout: 15000
  },
  customFields: {
    item: ['content:encoded', 'content', 'description']
  }
})

/**
 * 清理 XML 内容中的无效字符
 */
function sanitizeXML(xmlString: string): string {
  // 修复常见的无效 XML 实体
  return xmlString
    // 修复未转义的 & 符号（但保留已转义的实体如 &amp; &lt; 等）
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    // 移除控制字符（除了换行、回车、制表符）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * 从 HTML 片段中提取发布日期
 */
function extractDateFromContent(content: string): Date | null {
  const timeTagRegex = /<time[^>]*datetime=["']([^"']+)["'][^>]*>/i
  const timeMatch = timeTagRegex.exec(content)
  if (timeMatch) {
    const date = new Date(timeMatch[1])
    if (!isNaN(date.getTime())) return date
  }

  const isoDateRegex = /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)?)/
  const isoMatch = isoDateRegex.exec(content)
  if (isoMatch) {
    const date = new Date(isoMatch[1])
    if (!isNaN(date.getTime())) return date
  }

  const commonDateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i
  const commonMatch = commonDateRegex.exec(content)
  if (commonMatch) {
    const date = new Date(commonMatch[0])
    if (!isNaN(date.getTime())) return date
  }

  return null
}

/**
 * 从网页提取文章
 */
function extractArticlesFromHTML(html: string, baseUrl: string, config?: WebScrapeConfig) {
  const articles: any[] = []
  const seen = new Set<string>()

  // 策略1: <h1-h3><a>标题</a></h1-h3>
  const headingRegex = /<(h[1-3])[^>]*>.*?<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>.*?<\/\1>/gi
  let match
  while ((match = headingRegex.exec(html)) !== null && articles.length < 50) {
    const link = match[2]
    const title = match[3].replace(/<[^>]+>/g, '').trim()

    if (title && link && !seen.has(link)) {
      const absoluteUrl = new URL(link, baseUrl).href
      articles.push({
        title,
        link: absoluteUrl,
        pubDate: new Date()
      })
      seen.add(link)
    }
  }

  // 策略2: <a><div><h1-h3>标题</h1-h3></div></a> (现代 React 结构)
  const reverseLinkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  while ((match = reverseLinkRegex.exec(html)) !== null && articles.length < 50) {
    const link = match[1]
    const content = match[2]

    const innerHeadingRegex = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/i
    const headingMatch = innerHeadingRegex.exec(content)

    if (headingMatch) {
      const title = headingMatch[1].replace(/<[^>]+>/g, '').trim()

      if (title && title.length > 10 && link && !seen.has(link)) {
        try {
          const absoluteUrl = new URL(link, baseUrl).href
          const baseHost = new URL(baseUrl).hostname
          const linkHost = new URL(absoluteUrl).hostname

          if (linkHost === baseHost || linkHost.endsWith('.' + baseHost)) {
            const extractedDate = extractDateFromContent(content)
            articles.push({
              title,
              link: absoluteUrl,
              pubDate: extractedDate || new Date()
            })
            seen.add(link)
          }
        } catch {
          // URL 解析失败,跳过
        }
      }
    }
  }

  // 应用过滤规则
  let filteredArticles = [...articles]

  if (config) {
    if (config.excludePatterns && config.excludePatterns.length > 0) {
      filteredArticles = filteredArticles.filter(article => {
        for (const pattern of config.excludePatterns!) {
          if (pattern && article.link.includes(pattern)) {
            return false
          }
        }
        return true
      })
    }

    if (config.includePatterns && config.includePatterns.length > 0) {
      filteredArticles = filteredArticles.filter(article => {
        for (const pattern of config.includePatterns!) {
          if (pattern && article.link.includes(pattern)) {
            return true
          }
        }
        return false
      })
    }
  }

  return filteredArticles
}

/**
 * RSS 采集
 */
async function collectFromRSS(url: string, sourceName: string, category: string) {
  try {
    // 先获取原始 XML 内容
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xmlText = await response.text()
    // 清理 XML 内容
    const sanitizedXML = sanitizeXML(xmlText)

    // 解析清理后的 XML
    const feed = await parser.parseString(sanitizedXML)
    const articles: any[] = []

    const limitedItems = feed.items.slice(0, 50)
    const links = limitedItems
      .map(item => item.link)
      .filter(Boolean) as string[]

    if (links.length === 0) return articles

    // 查询已存在的文章
    const existingArticles = await prisma.article.findMany({
      where: { link: { in: links } },
      select: { link: true }
    })

    const filteredArticles = await prisma.filteredArticle.findMany({
      where: { link: { in: links } },
      select: { link: true }
    })

    const existingLinks = new Set(existingArticles.map(a => a.link))
    const filteredLinks = new Set(filteredArticles.map(a => a.link))

    for (const item of limitedItems) {
      if (!item.link) continue
      if (existingLinks.has(item.link)) continue
      if (filteredLinks.has(item.link)) {
        console.log(`[RSS] 跳过已过滤文章: ${item.link}`)
        continue
      }

      const titleOriginal = item.title || '无标题'

      try {
        const article = await prisma.article.create({
          data: {
            title: titleOriginal,
            titleOriginal,
            description: null,
            descriptionOriginal: null,
            content: null,
            contentOriginal: null,
            link: item.link,
            pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            source: sourceName,
            category: category,
            imageUrl: item.enclosure?.url || null,
            isTranslated: false,
          }
        })

        articles.push(article)
      } catch (createError: any) {
        if (createError.code === 'P2002') {
          console.log(`Article already exists, skipping: ${item.link}`)
          continue
        }
        throw createError
      }
    }

    return articles
  } catch (error) {
    console.error(`Error collecting from RSS ${sourceName}:`, error)
    return []
  }
}

/**
 * Web 采集
 */
async function collectFromWeb(url: string, sourceName: string, category: string, scrapeConfig?: WebScrapeConfig) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const extractedArticles = extractArticlesFromHTML(html, url, scrapeConfig)

    // 限制最多50篇
    const limitedArticles = extractedArticles.slice(0, 50)
    const links = limitedArticles.map(a => a.link)

    if (links.length === 0) {
      console.log(`[Web] 未能从 ${sourceName} 提取到文章`)
      return []
    }

    // 查询已存在的文章
    const existingArticles = await prisma.article.findMany({
      where: { link: { in: links } },
      select: { link: true }
    })

    const filteredArticles = await prisma.filteredArticle.findMany({
      where: { link: { in: links } },
      select: { link: true }
    })

    const existingLinks = new Set(existingArticles.map(a => a.link))
    const filteredLinks = new Set(filteredArticles.map(a => a.link))

    const articles: any[] = []

    for (const extractedArticle of limitedArticles) {
      if (existingLinks.has(extractedArticle.link)) continue
      if (filteredLinks.has(extractedArticle.link)) {
        console.log(`[Web] 跳过已过滤文章: ${extractedArticle.link}`)
        continue
      }

      try {
        const article = await prisma.article.create({
          data: {
            title: extractedArticle.title,
            titleOriginal: extractedArticle.title,
            description: null,
            descriptionOriginal: null,
            content: null,
            contentOriginal: null,
            link: extractedArticle.link,
            pubDate: extractedArticle.pubDate,
            source: sourceName,
            category: category,
            imageUrl: null,
            isTranslated: false,
          }
        })

        articles.push(article)
      } catch (createError: any) {
        if (createError.code === 'P2002') {
          console.log(`Article already exists, skipping: ${extractedArticle.link}`)
          continue
        }
        throw createError
      }
    }

    return articles
  } catch (error) {
    console.error(`Error collecting from Web ${sourceName}:`, error)
    return []
  }
}

/**
 * 统一采集接口
 * 根据信息源的类型自动选择 RSS 或 Web 采集方式
 */
export async function collectFromSource(source: {
  name: string
  url: string
  category: string
  type: string
  scrapeConfig?: string | null
}) {
  console.log(`[Collector] 开始采集: ${source.name} (类型: ${source.type})`)

  // 解析 scrapeConfig
  const config = source.scrapeConfig ? JSON.parse(source.scrapeConfig) : undefined

  if (source.type === 'rss') {
    const articles = await collectFromRSS(source.url, source.name, source.category)
    console.log(`[Collector] RSS采集完成: ${source.name} - ${articles.length} 篇新文章`)
    return articles
  } else if (source.type === 'web') {
    const articles = await collectFromWeb(source.url, source.name, source.category, config)
    console.log(`[Collector] Web采集完成: ${source.name} - ${articles.length} 篇新文章`)
    return articles
  } else {
    console.error(`[Collector] 未知的源类型: ${source.type}`)
    return []
  }
}

/**
 * 批量采集所有激活的信息源
 */
export async function collectAllActiveSources() {
  // 从数据库获取所有激活且测试成功的信息源
  const activeSources = await prisma.rSSSource.findMany({
    where: {
      isActive: true,
      isTested: true,
      testStatus: 'success'
    }
  })

  console.log(`[Collector] 准备采集 ${activeSources.length} 个信息源`)

  // 并行采集所有源
  const results = await Promise.all(
    activeSources.map(async (source) => {
      const articles = await collectFromSource(source)

      // 更新最后抓取时间
      await prisma.rSSSource.update({
        where: { id: source.id },
        data: { lastFetched: new Date() }
      })

      return {
        source: source.name,
        type: source.type,
        count: articles.length
      }
    })
  )

  return results
}
