// 网页抓取测试器

import { TestResult, CollectedArticle, WebScrapeConfig } from '../types'

/**
 * 从 HTML 片段中提取发布日期
 * 用于从文章列表的单个文章容器中提取日期
 */
function extractDateFromContent(content: string): Date | null {
  // 策略1: <time> 标签的 datetime 属性
  const timeTagRegex = /<time[^>]*datetime=["']([^"']+)["'][^>]*>/i
  const timeMatch = timeTagRegex.exec(content)
  if (timeMatch) {
    const date = new Date(timeMatch[1])
    if (!isNaN(date.getTime())) return date
  }

  // 策略2: 查找 ISO 8601 格式的日期字符串
  // 匹配: 2025-10-08T10:00:00.000Z 或 2025-10-08
  const isoDateRegex = /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)?)/
  const isoMatch = isoDateRegex.exec(content)
  if (isoMatch) {
    const date = new Date(isoMatch[1])
    if (!isNaN(date.getTime())) return date
  }

  // 策略3: 查找常见的日期格式
  // 匹配: Oct 8, 2025 或 October 8, 2025 或 8 Oct 2025
  const commonDateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i
  const commonMatch = commonDateRegex.exec(content)
  if (commonMatch) {
    const date = new Date(commonMatch[0])
    if (!isNaN(date.getTime())) return date
  }

  return null
}

/**
 * 多策略提取文章链接
 */
function extractArticles(html: string, baseUrl: string): CollectedArticle[] {
  const articles: CollectedArticle[] = []
  const seen = new Set<string>() // 去重

  // 策略1: 提取 <h1>, <h2>, <h3> 标签中的链接
  // 1a. 标准结构: <h2><a href="...">标题</a></h2>
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
        pubDate: new Date(),
        extractStrategy: 'heading-link'
      })
      seen.add(link)
    }
  }

  // 1b. 反向嵌套结构: <a href="..."><div><h2>标题</h2></div></a>
  // 这是现代 React 网站常用的结构 (如 therundown.ai)
  const reverseLinkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  while ((match = reverseLinkRegex.exec(html)) !== null && articles.length < 50) {
    const link = match[1]
    const content = match[2]

    // 在 <a> 标签内查找 h1-h3 标签
    const innerHeadingRegex = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/i
    const headingMatch = innerHeadingRegex.exec(content)

    if (headingMatch) {
      const title = headingMatch[1].replace(/<[^>]+>/g, '').trim()

      if (title && title.length > 10 && link && !seen.has(link)) {
        try {
          const absoluteUrl = new URL(link, baseUrl).href
          // 只保留同域名的链接
          const baseHost = new URL(baseUrl).hostname
          const linkHost = new URL(absoluteUrl).hostname

          if (linkHost === baseHost || linkHost.endsWith('.' + baseHost)) {
            // 尝试从内容中提取日期
            const extractedDate = extractDateFromContent(content)

            articles.push({
              title,
              link: absoluteUrl,
              pubDate: extractedDate || new Date(),
              extractStrategy: 'heading-link-reverse'
            })
            seen.add(link)
          }
        } catch {
          // URL 解析失败,跳过
        }
      }
    }
  }

  // 策略2: 如果策略1没找到足够文章，尝试提取所有有意义的 <a> 标签
  if (articles.length < 5) {
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi
    while ((match = linkRegex.exec(html)) !== null && articles.length < 50) {
      const link = match[1]
      const title = match[2].replace(/<[^>]+>/g, '').trim()

      // 过滤掉太短或明显不是文章的标题
      if (
        title.length > 10 &&
        link &&
        !seen.has(link) &&
        !link.includes('#') && // 排除锚点
        !link.match(/\.(jpg|png|gif|css|js|ico)$/i) && // 排除资源文件
        !title.toLowerCase().match(/^(home|about|contact|login|signup|subscribe|menu|search)$/i) // 排除导航
      ) {
        const absoluteUrl = new URL(link, baseUrl).href

        // 只保留同域名或子路径的链接
        const baseHost = new URL(baseUrl).hostname
        const linkHost = new URL(absoluteUrl).hostname
        if (linkHost === baseHost || linkHost.endsWith('.' + baseHost)) {
          // 策略2无法从单个链接提取日期,使用当前时间
          articles.push({
            title,
            link: absoluteUrl,
            pubDate: new Date(),
            extractStrategy: 'generic-link'
          })
          seen.add(link)
        }
      }
    }
  }

  // 策略3: 寻找常见文章容器类名
  if (articles.length < 5) {
    const articleContainerRegex = /<(?:article|div)[^>]*class=["'][^"']*(?:post|article|entry|item|card)[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|div)>/gi
    while ((match = articleContainerRegex.exec(html)) !== null && articles.length < 50) {
      const container = match[1]

      // 在容器内查找链接
      const innerLinkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      const innerMatch = innerLinkRegex.exec(container)

      if (innerMatch) {
        const link = innerMatch[1]
        let title = innerMatch[2].replace(/<[^>]+>/g, '').trim()

        // 如果 <a> 内没有文本，尝试找 h1-h6
        if (!title || title.length < 10) {
          const titleMatch = container.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)
          if (titleMatch) {
            title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
          }
        }

        if (title && title.length > 10 && link && !seen.has(link)) {
          const absoluteUrl = new URL(link, baseUrl).href

          // 尝试从容器中提取日期
          const extractedDate = extractDateFromContent(container)

          articles.push({
            title,
            link: absoluteUrl,
            pubDate: extractedDate || new Date(),
            extractStrategy: 'article-container'
          })
          seen.add(link)
        }
      }
    }
  }

  return articles
}

/**
 * 测试网页抓取
 * 注意: 这个函数需要在实际环境中使用 Playwright MCP
 * 当前版本返回模拟数据,实际实现需要调用 Playwright
 */
export async function testWebScrape(
  url: string,
  config?: WebScrapeConfig
): Promise<TestResult> {
  try {
    // TODO: 实际实现需要使用 Playwright MCP
    // 这里先返回一个基本的实现

    // 使用简单的 fetch 获取网页内容
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // 使用多策略提取文章
    let articles = extractArticles(html, url)

    // 应用过滤规则
    let filteredArticles = [...articles]

    if (config) {
      // 应用排除规则
      if (config.excludePatterns && config.excludePatterns.length > 0) {
        const patterns = config.excludePatterns
        filteredArticles = filteredArticles.filter(article => {
          for (const pattern of patterns) {
            if (pattern && article.link.includes(pattern)) {
              return false
            }
          }
          return true
        })
      }

      // 应用包含规则
      if (config.includePatterns && config.includePatterns.length > 0) {
        const patterns = config.includePatterns
        filteredArticles = filteredArticles.filter(article => {
          for (const pattern of patterns) {
            if (pattern && article.link.includes(pattern)) {
              return true
            }
          }
          return false
        })
      }
    }

    // 限制最多10篇
    filteredArticles = filteredArticles.slice(0, 10)

    if (filteredArticles.length === 0) {
      return {
        success: false,
        articles: [],
        count: 0,
        error: '未能从网页中提取到文章。建议使用 RSS 源或配置自定义选择器。',
        timestamp: new Date()
      }
    }

    // 检查日期提取情况 - 如果超过20%的文章无法提取日期，则拒绝
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000) // 使用1分钟前作为阈值

    // 统计有多少文章无法提取到真实日期（使用的是默认当前时间）
    const articlesWithoutRealDate = filteredArticles.filter(article => {
      // 如果文章日期在1分钟内，说明使用的是默认当前时间，没有提取到真实日期
      return !article.pubDate || article.pubDate >= oneMinuteAgo
    })

    const failedCount = articlesWithoutRealDate.length
    const totalCount = filteredArticles.length
    const failedRatio = failedCount / totalCount

    // 如果超过 20% 的文章无法提取日期，拒绝该信息源
    if (failedRatio > 0.2) {
      return {
        success: false,
        articles: filteredArticles,
        count: filteredArticles.length,
        error: `❌ 无法提取文章发布日期！\n\n该网站的 ${totalCount} 篇文章中，有 ${failedCount} 篇无法提取到真实的发布日期（${(failedRatio * 100).toFixed(0)}%）。\n\n📅 文章发布日期对于新闻时效性至关重要，超过 20% 的文章缺失日期不符合要求。\n\n建议：\n1. 优先使用 RSS 源（系统会自动尝试检测）\n2. 或选择其他有明确日期标注的新闻源`,
        timestamp: new Date(),
        dateExtractionFailed: true,
        dateExtractionStats: {
          total: totalCount,
          withRealDate: totalCount - failedCount,
          failedCount: failedCount
        }
      }
    }

    // 日期提取成功率达标
    return {
      success: true,
      articles: filteredArticles,
      count: filteredArticles.length,
      timestamp: new Date(),
      dateExtractionStats: {
        total: filteredArticles.length,
        withRealDate: filteredArticles.length - failedCount,
        failedCount: failedCount
      }
    }
  } catch (error) {
    return {
      success: false,
      articles: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    }
  }
}

/**
 * 使用 Playwright 进行高级抓取
 * 这个函数将来会通过 API 调用 Playwright MCP
 */
export async function testWebScrapeAdvanced(
  url: string,
  config: WebScrapeConfig
): Promise<TestResult> {
  // TODO: 实现 Playwright 抓取逻辑
  // 需要调用专门的 API 端点来使用 Playwright MCP
  return testWebScrape(url, config)
}
