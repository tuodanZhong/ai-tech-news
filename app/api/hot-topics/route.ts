import { NextResponse } from 'next/server'
import { analyzeHotTopicsV2 } from '@/lib/trending-analyzer-v2'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // 如果不是强制刷新，先尝试从数据库读取
    if (!forceRefresh) {
      const hotTopics = await prisma.hotTopic.findMany({
        where: { type: '48h' },
        orderBy: { score: 'desc' }
      })

      if (hotTopics.length > 0) {
        console.log('[API] 从数据库返回48小时热点话题')

        // 获取关联的文章信息
        const topicsWithArticles = await Promise.all(
          hotTopics.map(async (topic) => {
            const articleIds = JSON.parse(topic.articleIds)
            const articles = await prisma.article.findMany({
              where: {
                id: { in: articleIds }
              },
              select: {
                id: true,
                title: true,
                titleOriginal: true,
                link: true,
                pubDate: true,
                source: true,
                isTranslated: true
              }
            })

            return {
              id: topic.id,
              title: topic.title,
              discussionCount: topic.discussionCount,
              sources: JSON.parse(topic.sources),
              articles,
              score: topic.score
            }
          })
        )

        return NextResponse.json({
          success: true,
          topics: topicsWithArticles,
          count: topicsWithArticles.length,
          updatedAt: hotTopics[0]?.updatedAt.toISOString(),
          fromCache: true
        })
      }
    }

    console.log('[API] 开始分析48小时热点话题（V2版本）...')
    const hotTopics = await analyzeHotTopicsV2(48)

    // 删除旧的热点
    await prisma.hotTopic.deleteMany({
      where: { type: '48h' }
    })

    // 保存新的热点到数据库
    await Promise.all(
      hotTopics.map((topic: any) =>
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

    console.log(`[API] 成功分析并保存 ${hotTopics.length} 个48小时热点话题`)

    return NextResponse.json({
      success: true,
      topics: hotTopics,
      count: hotTopics.length,
      updatedAt: new Date().toISOString(),
      fromCache: false
    })
  } catch (error) {
    console.error('[API] 热点分析失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      topics: []
    }, { status: 500 })
  }
}
