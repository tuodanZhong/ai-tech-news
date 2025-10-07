import { NextResponse } from 'next/server'
import { filterIrrelevantArticles } from '@/lib/content-filter'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    console.log('[API] 开始过滤最近48小时的新闻...')

    // 获取最近48小时的所有文章ID
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const articles = await prisma.article.findMany({
      where: {
        pubDate: {
          gte: fortyEightHoursAgo
        }
      },
      select: {
        id: true
      },
      orderBy: {
        pubDate: 'desc'
      }
    })

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有找到最近48小时的文章',
        total: 0,
        filtered: 0
      })
    }

    const articleIds = articles.map(a => a.id)
    console.log(`[API] 找到 ${articleIds.length} 篇最近48小时的文章`)

    // 调用过滤器
    const filterResult = await filterIrrelevantArticles(articleIds)

    console.log(`[API] 过滤完成: 保留 ${filterResult.relevantIds.length} 篇, 删除 ${filterResult.filtered} 篇`)

    return NextResponse.json({
      success: true,
      message: `成功过滤最近48小时的新闻，保留 ${filterResult.relevantIds.length} 篇，删除 ${filterResult.filtered} 篇不相关内容`,
      total: filterResult.total,
      filtered: filterResult.filtered,
      relevant: filterResult.relevantIds.length
    })

  } catch (error) {
    console.error('[API] 过滤48小时新闻失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
