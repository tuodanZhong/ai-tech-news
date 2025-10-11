// 智能 RSS 发现 API
import { NextResponse } from 'next/server'
import { discoverRSSFeeds } from '@/lib/sources/intelligent-discovery'

export const maxDuration = 300 // 5分钟超时
export const dynamic = 'force-dynamic'

/**
 * POST /api/sources/discover
 *
 * 智能发现并分析网站的 RSS 源
 *
 * Request body:
 * {
 *   "url": "https://example.com"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "websiteName": "Example Site",
 *     "websiteUrl": "https://example.com",
 *     "feeds": [...],
 *     "recommended": [...],
 *     "ignored": [...],
 *     "reason": "..."
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url } = body

    // 验证 URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'URL is required and must be a string'
        },
        { status: 400 }
      )
    }

    // 验证 URL 格式
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid URL format'
        },
        { status: 400 }
      )
    }

    console.log(`[API] 开始发现 RSS: ${url}`)

    // 执行智能发现
    const result = await discoverRSSFeeds(url)

    console.log(`[API] 发现完成: ${result.recommended.length} 个推荐源`)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('[API] RSS 发现失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '发现 RSS 源失败,请检查 URL 是否正确'
      },
      { status: 500 }
    )
  }
}
