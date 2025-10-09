// 检测 URL 是否为 RSS 或需要网页抓取

import { DetectResult } from './types'

/**
 * 检测 URL 类型
 * 1. 尝试解析为 RSS
 * 2. 检查常见的 RSS URL 模式
 * 3. 尝试在网页中查找 RSS link
 */
export async function detectSourceType(url: string): Promise<DetectResult> {
  try {
    // 1. 直接检查 URL 模式
    if (isLikelyRSSUrl(url)) {
      // 尝试验证是否真的是 RSS
      const isValid = await validateRSS(url)
      if (isValid) {
        return {
          type: 'rss',
          detected: true,
          rssUrl: url
        }
      }
    }

    // 2. 尝试在网页中查找 RSS feed
    const rssLinks = await findRSSInPage(url)
    if (rssLinks.length > 0) {
      return {
        type: 'rss',
        detected: true,
        rssUrl: rssLinks[0],
        suggestions: rssLinks
      }
    }

    // 3. 默认为网页抓取
    return {
      type: 'web',
      detected: true
    }

  } catch (error) {
    return {
      type: 'web',
      detected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 检查 URL 是否像 RSS
 */
function isLikelyRSSUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  return (
    lowerUrl.includes('/feed') ||
    lowerUrl.includes('/rss') ||
    lowerUrl.includes('.xml') ||
    lowerUrl.includes('/atom')
  )
}

/**
 * 验证 URL 是否为有效的 RSS
 */
async function validateRSS(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(5000) // 5秒超时
    })

    if (!response.ok) return false

    const text = await response.text()

    // 简单检查是否包含 RSS/Atom 标记
    return (
      text.includes('<rss') ||
      text.includes('<feed') ||
      text.includes('</rss>') ||
      text.includes('</feed>')
    )
  } catch (error) {
    return false
  }
}

/**
 * 在网页中查找 RSS feed 链接
 * 使用多层策略提高成功率
 */
export async function findRSSInPage(url: string): Promise<string[]> {
  // 策略 1: 从静态 HTML 中查找（快速）
  const staticLinks = await findRSSInStaticHTML(url)
  if (staticLinks.length > 0) {
    return staticLinks
  }

  // 策略 2: 尝试常见 RSS 路径（中等速度）
  const commonLinks = await tryCommonRSSPaths(url)
  if (commonLinks.length > 0) {
    return commonLinks
  }

  // 策略 3: 使用 Firecrawl 渲染页面（慢但强大）
  if (process.env.FIRECRAWL_API_KEY) {
    const firecrawlLinks = await findRSSWithFirecrawl(url)
    if (firecrawlLinks.length > 0) {
      return firecrawlLinks
    }
  }

  return []
}

/**
 * 策略 1: 从静态 HTML 中查找 RSS 链接
 */
async function findRSSInStaticHTML(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) return []

    const html = await response.text()
    const rssLinks: string[] = []

    // 查找 <link type="application/rss+xml"> 或 <link type="application/atom+xml">
    const linkRegex = /<link[^>]*type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*href=["']([^"']+)["']/gi
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[2]
      // 处理相对路径
      const absoluteUrl = new URL(href, url).href
      rssLinks.push(absoluteUrl)
    }

    // 也检查 href 在前的情况
    const linkRegex2 = /<link[^>]*href=["']([^"']+)["'][^>]*type=["'](application\/rss\+xml|application\/atom\+xml)["']/gi
    while ((match = linkRegex2.exec(html)) !== null) {
      const href = match[1]
      const absoluteUrl = new URL(href, url).href
      if (!rssLinks.includes(absoluteUrl)) {
        rssLinks.push(absoluteUrl)
      }
    }

    return rssLinks
  } catch (error) {
    return []
  }
}

/**
 * 策略 2: 尝试常见的 RSS 路径
 */
async function tryCommonRSSPaths(url: string): Promise<string[]> {
  const baseUrl = new URL(url)
  const commonPaths = [
    '/feed',
    '/rss',
    '/feed.xml',
    '/rss.xml',
    '/atom.xml',
    '/index.xml',
    '/feeds/posts/default',  // Blogger
    '/?feed=rss2',            // WordPress
    '/feed/',
  ]

  const found: string[] = []

  for (const path of commonPaths) {
    try {
      const testUrl = new URL(path, baseUrl).href
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      })

      if (response.ok) {
        // 验证是否真的是 RSS
        const isValid = await validateRSS(testUrl)
        if (isValid) {
          found.push(testUrl)
          // 找到第一个就返回，节省时间
          break
        }
      }
    } catch {
      // 路径不存在或超时，继续尝试下一个
    }
  }

  return found
}

/**
 * 策略 3: 使用 Firecrawl 获取渲染后的 HTML
 */
async function findRSSWithFirecrawl(url: string): Promise<string[]> {
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY
    if (!apiKey) return []

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        onlyMainContent: false,  // 需要完整 HTML 包括 <head>
        timeout: 10000
      }),
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) return []

    const data = await response.json()
    const html = data.html || data.markdown || ''

    // 在渲染后的 HTML 中查找 RSS 链接
    const rssLinks: string[] = []
    const linkRegex = /<link[^>]*type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*href=["']([^"']+)["']/gi
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[2]
      const absoluteUrl = new URL(href, url).href
      if (!rssLinks.includes(absoluteUrl)) {
        rssLinks.push(absoluteUrl)
      }
    }

    return rssLinks
  } catch (error) {
    console.error('Firecrawl RSS detection error:', error)
    return []
  }
}
