import { NextResponse } from 'next/server'
import { saveScrapedArticles, type ScrapedArticle } from '@/lib/playwright-scraper'
import * as cheerio from 'cheerio'

export async function POST() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

    const response = await fetch('https://www.bloomberg.com/technology', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const html = await response.text()
    const $ = cheerio.load(html)

    const articles: ScrapedArticle[] = []
    const seenLinks = new Set<string>()

    // 查找所有文章链接
    $('a[href*="/news/articles/"], a[href*="/news/features/"]').each((_, element) => {
      const $link = $(element)
      const href = $link.attr('href')

      if (!href) return

      const fullLink = href.startsWith('http') ? href : `https://www.bloomberg.com${href}`

      // 检查链接是否只包含图片（没有文本内容）
      const hasOnlyImage = $link.find('img').length > 0 && !$link.text().trim()
      if (hasOnlyImage) return

      // 获取标题文本
      let title = $link.text().trim()

      // 跳过图片署名
      if (title.includes('/Bloomberg') || title.includes('Bloomberg/')) return

      // 跳过空标题或太短的标题
      if (!title || title.length < 15) return

      // 去重
      if (seenLinks.has(fullLink)) return

      seenLinks.add(fullLink)

      // 截取标题到合理长度
      if (title.length > 150) {
        title = title.substring(0, 150)
      }

      articles.push({
        title,
        description: '',
        link: fullLink,
        pubDate: new Date()
      })
    })

    // 限制最多 30 篇文章
    const limitedArticles = articles.slice(0, 30)

    // 保存抓取的文章
    const saved = await saveScrapedArticles(
      limitedArticles,
      'Bloomberg Technology',
      'https://www.bloomberg.com/technology',
      '综合科技'
    )

    return NextResponse.json({
      success: true,
      count: saved.length,
      total: limitedArticles.length,
      articles: saved
    })
  } catch (error) {
    console.error('Error scraping Bloomberg:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
