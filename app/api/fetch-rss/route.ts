import { NextResponse } from 'next/server'
import { fetchAllFeeds } from '@/lib/rss-parser'
import { filterIrrelevantArticles } from '@/lib/content-filter'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // 记录采集前的文章ID,用于后续过滤
    const beforeArticles = await prisma.article.findMany({
      select: { id: true }
    })
    const beforeIds = new Set(beforeArticles.map(a => a.id))

    // 1. 抓取所有 RSS 源
    const rssResults = await fetchAllFeeds()

    // 2. 抓取 Bloomberg（使用网页抓取）
    let bloombergResult = { feed: 'Bloomberg Technology', count: 0, error: null as string | null }
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

      const bloombergResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scrape-bloomberg`, {
        method: 'POST',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const bloombergData = await bloombergResponse.json()

      if (bloombergData.success) {
        bloombergResult.count = bloombergData.count
      } else {
        bloombergResult.error = bloombergData.error
      }
    } catch (error) {
      console.error('Error scraping Bloomberg:', error)
      bloombergResult.error = error instanceof Error ? error.message : 'Unknown error'
    }

    // 合并结果
    const allResults = [...rssResults, bloombergResult]

    // 4. 去重处理
    let deduplicateResult = { deleted: 0, error: null as string | null }
    try {
      const controller2 = new AbortController()
      const timeoutId2 = setTimeout(() => controller2.abort(), 5000) // 5秒超时

      const deduplicateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/deduplicate`, {
        method: 'POST',
        signal: controller2.signal
      })

      clearTimeout(timeoutId2)
      const deduplicateData = await deduplicateResponse.json()

      if (deduplicateData.success) {
        deduplicateResult.deleted = deduplicateData.deleted.total
      } else {
        deduplicateResult.error = deduplicateData.error
      }
    } catch (error) {
      console.error('Error deduplicating:', error)
      deduplicateResult.error = error instanceof Error ? error.message : 'Unknown error'
    }

    // 5. 智能过滤不相关内容
    let filterResult = { total: 0, filtered: 0, error: null as string | null }
    try {
      // 获取所有新采集的文章
      const afterArticles = await prisma.article.findMany({
        select: { id: true }
      })
      const newArticleIds = afterArticles
        .filter(a => !beforeIds.has(a.id))
        .map(a => a.id)

      if (newArticleIds.length > 0) {
        console.log(`[API] 开始过滤 ${newArticleIds.length} 篇新采集的文章...`)
        const filterData = await filterIrrelevantArticles(newArticleIds)
        filterResult.total = filterData.total
        filterResult.filtered = filterData.filtered
        console.log(`[API] 过滤完成: 保留 ${filterData.relevantIds.length} 篇, 删除 ${filterData.filtered} 篇`)
      }
    } catch (error) {
      console.error('Error filtering articles:', error)
      filterResult.error = error instanceof Error ? error.message : 'Unknown error'
    }

    // 6. 计算热度分数
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calculate-trending`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('Error calculating trending scores:', error)
    }

    // 7. 后台翻译所有未翻译的文章（不等待结果，后台执行）
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/translate-all`, {
      method: 'POST'
    }).catch(error => {
      console.error('Error triggering background translation:', error)
    })

    // 构建结果消息
    let message = '成功抓取所有新闻源'
    if (deduplicateResult.deleted > 0) {
      message += `，已去重 ${deduplicateResult.deleted} 篇`
    }
    if (filterResult.filtered > 0) {
      message += `，已过滤 ${filterResult.filtered} 篇不相关内容`
    }
    message += '，后台翻译进行中...'

    return NextResponse.json({
      success: true,
      results: allResults,
      deduplicated: deduplicateResult.deleted,
      filtered: filterResult.filtered,
      message
    })
  } catch (error) {
    console.error('Error in fetch-rss:', error)
    return NextResponse.json({
      success: false,
      error: '抓取新闻源失败'
    }, { status: 500 })
  }
}
