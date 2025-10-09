// RSS 采集测试器

import Parser from 'rss-parser'
import { TestResult, CollectedArticle } from '../types'

const parser = new Parser({
  timeout: 10000, // 10秒超时
  requestOptions: {
    timeout: 10000
  }
})

/**
 * 测试 RSS 采集
 * @param url RSS feed URL
 * @returns 测试结果,包含预览文章
 */
export async function testRSSFeed(url: string): Promise<TestResult> {
  try {
    const feed = await parser.parseURL(url)

    // 最多返回 10 篇文章作为预览
    const articles: CollectedArticle[] = feed.items
      .slice(0, 10)
      .map(item => ({
        title: item.title || '无标题',
        link: item.link || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        imageUrl: item.enclosure?.url || undefined,
        description: item.contentSnippet || item.content || undefined
      }))
      .filter(article => article.link) // 过滤掉没有链接的

    return {
      success: true,
      articles,
      count: articles.length,
      timestamp: new Date()
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
