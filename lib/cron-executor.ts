import { fetchAllFeeds } from './rss-parser'
import { filterIrrelevantArticles } from './content-filter'
import { analyzeHotTopicsV2 } from './trending-analyzer-v2'
import { prisma } from './db'
import { translateToChinese, isChinese } from './translator'

interface CronJobResult {
  success: boolean
  message?: string
  error?: string
  duration: string
  summary: {
    articlesCollected: number
    articlesTranslated: number
    hotTopics48h: number
    hotTopics24h: number
  }
  timestamp: string
}

export async function executeCronJob(): Promise<CronJobResult> {
  const startTime = Date.now()

  try {
    console.log('[Cron Executor] 开始执行定时任务...')

    // 0. 清理7天前的旧数据
    console.log('[Cron Executor] 步骤 0/4: 清理7天前的数据')
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const deletedArticles = await prisma.article.deleteMany({
      where: {
        pubDate: { lt: sevenDaysAgo }
      }
    })
    console.log(`[Cron Executor] ✓ 清理完成: 删除 ${deletedArticles.count} 篇7天前的文章`)

    // 1. 采集新闻
    console.log('[Cron Executor] 步骤 1/4: 采集新闻')
    const beforeArticles = await prisma.article.findMany({
      select: { id: true }
    })
    const beforeIds = new Set(beforeArticles.map(a => a.id))

    // 抓取所有 RSS 源
    const rssResults = await fetchAllFeeds()
    const totalArticles = rssResults.reduce((sum, r) => sum + r.count, 0)
    console.log(`[Cron Executor] ✓ 采集完成: ${totalArticles} 篇文章`)

    // 2. 智能过滤不相关内容
    console.log('[Cron Executor] 步骤 2/4: 过滤不相关内容')
    const afterArticles = await prisma.article.findMany({
      select: { id: true }
    })
    const newArticleIds = afterArticles
      .filter(a => !beforeIds.has(a.id))
      .map(a => a.id)

    let filteredCount = 0
    if (newArticleIds.length > 0) {
      console.log(`[Cron Executor] 开始过滤 ${newArticleIds.length} 篇新采集的文章...`)
      const filterData = await filterIrrelevantArticles(newArticleIds)
      filteredCount = filterData.filtered
      console.log(`[Cron Executor] ✓ 过滤完成: 保留 ${filterData.relevantIds.length} 篇, 删除 ${filteredCount} 篇`)
    }

    // 3. 翻译新闻
    console.log('[Cron Executor] 步骤 3/4: 翻译新闻')
    const untranslatedArticles = await prisma.article.findMany({
      where: {
        isTranslated: false
      },
      orderBy: {
        pubDate: 'desc'
      }
    })

    let translatedCount = 0
    for (const article of untranslatedArticles) {
      try {
        const titleText = article.titleOriginal || article.title

        if (isChinese(titleText)) {
          await prisma.article.update({
            where: { id: article.id },
            data: {
              title: titleText,
              isTranslated: true
            }
          })
          translatedCount++
          continue
        }

        const title = await translateToChinese(titleText)
        await prisma.article.update({
          where: { id: article.id },
          data: {
            title,
            isTranslated: true
          }
        })
        translatedCount++
      } catch (error) {
        console.error(`[Cron Executor] 翻译文章 ${article.id} 失败:`, error)
      }
    }
    console.log(`[Cron Executor] ✓ 翻译完成: ${translatedCount} 篇`)

    // 4. 分析热点话题
    console.log('[Cron Executor] 步骤 4/4: 分析热点话题')

    // 48小时热点
    console.log('[Cron Executor] 分析48小时热点...')
    const hotTopics48h = await analyzeHotTopicsV2(48)

    // 删除旧的48小时热点
    await prisma.hotTopic.deleteMany({
      where: { type: '48h' }
    })

    // 保存新的48小时热点
    await Promise.all(
      hotTopics48h.map((topic: any) =>
        prisma.hotTopic.create({
          data: {
            type: '48h',
            title: topic.title,
            discussionCount: topic.discussionCount,
            sources: JSON.stringify(topic.sources),
            articleIds: JSON.stringify(topic.articles.map((a: any) => a.id)),
            score: topic.trendingScore || 0
          }
        })
      )
    )
    console.log(`[Cron Executor] ✓ 48小时热点分析完成: ${hotTopics48h.length} 个`)

    // 24小时热点
    console.log('[Cron Executor] 分析24小时热点...')
    const hotTopics24h = await analyzeHotTopicsV2(24)

    // 删除旧的24小时热点
    await prisma.hotTopic.deleteMany({
      where: { type: '24h' }
    })

    // 保存新的24小时热点
    await Promise.all(
      hotTopics24h.map((topic: any) =>
        prisma.hotTopic.create({
          data: {
            type: '24h',
            title: topic.title,
            discussionCount: topic.discussionCount,
            sources: JSON.stringify(topic.sources),
            articleIds: JSON.stringify(topic.articles.map((a: any) => a.id)),
            score: topic.trendingScore || 0
          }
        })
      )
    )
    console.log(`[Cron Executor] ✓ 24小时热点分析完成: ${hotTopics24h.length} 个`)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Cron Executor] 🎉 定时任务执行完成，耗时 ${duration} 秒`)

    return {
      success: true,
      message: '定时任务执行成功',
      duration: `${duration}s`,
      summary: {
        articlesCollected: totalArticles,
        articlesTranslated: translatedCount,
        hotTopics48h: hotTopics48h.length,
        hotTopics24h: hotTopics24h.length,
      },
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error('[Cron Executor] ❌ 定时任务执行失败:', error)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}s`,
      summary: {
        articlesCollected: 0,
        articlesTranslated: 0,
        hotTopics48h: 0,
        hotTopics24h: 0,
      },
      timestamp: new Date().toISOString()
    }
  }
}
