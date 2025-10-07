import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    console.log('[Cron Job] 开始执行定时任务...')
    const startTime = Date.now()

    // 1. 采集新闻
    console.log('[Cron Job] 步骤 1/3: 采集新闻')
    const fetchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fetch-rss`, {
      method: 'GET',
    })
    const fetchData = await fetchResponse.json()

    if (!fetchData.success) {
      throw new Error('新闻采集失败: ' + fetchData.error)
    }

    const totalArticles = fetchData.results?.reduce((sum: number, r: any) => sum + r.count, 0) || 0
    console.log(`[Cron Job] ✓ 采集完成: ${totalArticles} 篇文章`)

    // 2. 翻译新闻
    console.log('[Cron Job] 步骤 2/3: 翻译新闻')
    const translateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/translate-all`, {
      method: 'GET',
    })
    const translateData = await translateResponse.json()

    if (!translateData.success) {
      console.warn('[Cron Job] ⚠ 翻译失败，但继续执行:', translateData.error)
    } else {
      console.log(`[Cron Job] ✓ 翻译完成: ${translateData.translated || 0} 篇`)
    }

    // 3. 分析热点（48小时和24小时）
    console.log('[Cron Job] 步骤 3/3: 分析热点话题')
    const [hotTopics48h, hotTopics24h] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/hot-topics`, {
        method: 'GET',
      }),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/hot-topics-24h`, {
        method: 'GET',
      })
    ])

    const hotTopics48hData = await hotTopics48h.json()
    const hotTopics24hData = await hotTopics24h.json()

    console.log(`[Cron Job] ✓ 热点分析完成: 48h ${hotTopics48hData.count || 0} 个, 24h ${hotTopics24hData.count || 0} 个`)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Cron Job] 🎉 定时任务执行完成，耗时 ${duration} 秒`)

    return NextResponse.json({
      success: true,
      message: '定时任务执行成功',
      duration: `${duration}s`,
      summary: {
        articlesCollected: totalArticles,
        articlesTranslated: translateData.translated || 0,
        hotTopics48h: hotTopics48hData.count || 0,
        hotTopics24h: hotTopics24hData.count || 0,
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Cron Job] ❌ 定时任务执行失败:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
