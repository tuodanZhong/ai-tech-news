import { NextResponse } from 'next/server'
import { saveScrapedArticles, type ScrapedArticle } from '@/lib/playwright-scraper'

export async function POST() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

    // 使用 Firecrawl 抓取（绕过反爬虫）
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://www.reuters.com/technology/',
        formats: ['markdown'],
        waitFor: 3000,
        mobile: false,
        skipTlsVerification: false
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!firecrawlResponse.ok) {
      const errorData = await firecrawlResponse.json()
      throw new Error(`Firecrawl error: ${errorData.error || firecrawlResponse.statusText}`)
    }

    const data = await firecrawlResponse.json()
    const markdown = data.data?.markdown || ''

    const articles: ScrapedArticle[] = []
    const seenLinks = new Set<string>()

    // 从 markdown 中提取文章链接和标题
    const linkPattern = /\[([^\]]+)\]\((https:\/\/www\.reuters\.com\/[^\)]+)\)/g
    let match

    while ((match = linkPattern.exec(markdown)) !== null) {
      const title = match[1].trim()
      const link = match[2]

      // 只保留文章链接（包含日期的）
      if (!link.includes('/2025/')) continue

      // 跳过分类链接
      if (link.endsWith('/technology/') ||
          link.endsWith('/business/') ||
          link.endsWith('/sustainability/') ||
          link.endsWith('category')) continue

      // 跳过空标题或太短的标题
      if (!title || title.length < 20) continue

      // 跳过图片说明和 "category" 文本
      if (title.toLowerCase().includes('category') ||
          title.toLowerCase() === 'technologycategory' ||
          title.toLowerCase() === 'businesscategory') continue

      // 去重
      if (seenLinks.has(link)) continue
      seenLinks.add(link)

      articles.push({
        title: title.length > 150 ? title.substring(0, 150) : title,
        description: '',
        link,
        pubDate: new Date()
      })
    }

    // 限制最多 30 篇文章
    const limitedArticles = articles.slice(0, 30)

    const saved = await saveScrapedArticles(
      limitedArticles,
      'Reuters Technology',
      'https://www.reuters.com/technology/',
      '综合科技'
    )

    return NextResponse.json({
      success: true,
      count: saved.length,
      total: limitedArticles.length,
      articles: saved
    })
  } catch (error) {
    console.error('Error scraping Reuters:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
