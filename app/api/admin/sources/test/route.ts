// 测试采集的 API

import { NextRequest, NextResponse } from 'next/server'
import { testRSSFeed, testWebScrape } from '@/lib/sources/testers'
import type { SourceType, WebScrapeConfig } from '@/lib/sources/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, type, scrapeConfig } = body as {
      url: string
      type: SourceType
      scrapeConfig?: WebScrapeConfig
    }

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required' },
        { status: 400 }
      )
    }

    // 验证 URL 格式
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // 根据类型调用不同的测试器
    let result
    if (type === 'rss') {
      result = await testRSSFeed(url)
    } else if (type === 'web') {
      result = await testWebScrape(url, scrapeConfig)
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "rss" or "web"' },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing source:', error)
    return NextResponse.json(
      {
        success: false,
        articles: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      },
      { status: 500 }
    )
  }
}
