// 保存 RSS 源 API
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/sources/save
 *
 * 保存推荐的 RSS 源到数据库
 *
 * Request body:
 * {
 *   "feeds": [
 *     {
 *       "url": "https://example.com/feed",
 *       "name": "Example Feed",
 *       "category": "AI",
 *       "feedType": "specific",
 *       "websiteUrl": "https://example.com",
 *       "aiAnalysis": "{...}"
 *     }
 *   ]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "saved": 2,
 *     "sources": [...]
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { feeds } = body

    // 验证输入
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'feeds array is required and must not be empty'
        },
        { status: 400 }
      )
    }

    console.log(`[API] 准备保存 ${feeds.length} 个 RSS 源`)

    const savedSources = []
    const errors = []

    for (const feed of feeds) {
      try {
        // 验证必需字段
        if (!feed.url || !feed.name || !feed.category) {
          errors.push({
            feed: feed.url || 'unknown',
            error: 'Missing required fields: url, name, category'
          })
          continue
        }

        // 检查是否已存在
        const existing = await prisma.rSSSource.findUnique({
          where: { url: feed.url }
        })

        if (existing) {
          console.log(`[API] RSS 源已存在,跳过: ${feed.url}`)
          errors.push({
            feed: feed.url,
            error: 'RSS source already exists'
          })
          continue
        }

        // 创建新的 RSS 源
        const source = await prisma.rSSSource.create({
          data: {
            name: feed.name,
            url: feed.url,
            category: feed.category,
            type: 'rss',
            feedType: feed.feedType || 'unknown',
            websiteUrl: feed.websiteUrl || null,
            aiAnalysis: feed.aiAnalysis || null,
            isActive: false,  // 默认未激活,需要测试后才激活
            isTested: false,
            testStatus: 'pending'
          }
        })

        savedSources.push({
          id: source.id,
          name: source.name,
          url: source.url,
          category: source.category,
          feedType: source.feedType
        })

        console.log(`[API] ✓ 已保存: ${source.name}`)

      } catch (error) {
        console.error(`[API] 保存失败 ${feed.url}:`, error)
        errors.push({
          feed: feed.url,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`[API] 保存完成: ${savedSources.length}/${feeds.length} 成功`)

    // 如果没有任何源被保存成功，返回失败状态
    if (savedSources.length === 0 && errors.length > 0) {
      // 检查是否全部是重复的
      const allDuplicates = errors.every(err => err.error === 'RSS source already exists')

      return NextResponse.json({
        success: false,
        error: allDuplicates
          ? '所有信息源已存在，未添加新的源'
          : '保存失败，请检查输入信息',
        data: {
          saved: 0,
          total: feeds.length,
          sources: [],
          errors
        }
      }, { status: 400 })
    }

    // 部分成功或全部成功
    return NextResponse.json({
      success: true,
      data: {
        saved: savedSources.length,
        total: feeds.length,
        sources: savedSources,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error) {
    console.error('[API] 保存 RSS 源失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '保存 RSS 源失败'
      },
      { status: 500 }
    )
  }
}
