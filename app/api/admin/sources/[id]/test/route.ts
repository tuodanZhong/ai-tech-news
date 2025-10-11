// 信息源测试并保存结果 API
// 简化版：只测试已保存的 type 和 url，不做智能检测

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { testRSSFeed, testWebScrape } from '@/lib/sources/testers'
import type { WebScrapeConfig, TestResult } from '@/lib/sources/types'

// POST - 测试信息源并保存结果到数据库
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // 获取信息源
    const source = await prisma.rSSSource.findUnique({
      where: { id }
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    console.log(`[测试] 开始测试信息源: ${source.name} (${source.type})`)

    // 解析配置
    const scrapeConfig: WebScrapeConfig | undefined = source.scrapeConfig
      ? JSON.parse(source.scrapeConfig)
      : undefined

    // 根据已保存的 type 直接测试，不做任何智能检测或类型切换
    let testResult: TestResult

    if (source.type === 'rss') {
      console.log(`[测试] RSS 模式: ${source.url}`)
      testResult = await testRSSFeed(source.url)
    } else if (source.type === 'web') {
      console.log(`[测试] Web 模式: ${source.url}`)
      testResult = await testWebScrape(source.url, scrapeConfig)
    } else {
      return NextResponse.json(
        { error: `未知的信息源类型: ${source.type}` },
        { status: 400 }
      )
    }

    console.log(`[测试] 测试结果: ${testResult.success ? '成功' : '失败'}`)
    if (testResult.success) {
      console.log(`[测试] 采集到 ${testResult.count} 篇文章`)
    } else {
      console.log(`[测试] 错误: ${testResult.error}`)
    }

    // 如果测试失败，直接返回错误，不更新数据库
    if (!testResult.success) {
      return NextResponse.json({
        success: false,
        error: testResult.error || '测试失败',
        testResult
      }, { status: 400 })
    }

    // 测试成功，更新测试结果到数据库
    // 注意: 不更新 url 和 type，只更新测试状态和结果
    const updatedSource = await prisma.rSSSource.update({
      where: { id },
      data: {
        isTested: true,
        testStatus: 'success',
        testResult: JSON.stringify({
          ...testResult,
          testedAt: new Date().toISOString(),
          testedType: source.type,
          testedUrl: source.url
        }),
        lastTested: new Date()
      }
    })

    console.log(`[测试] 测试结果已保存到数据库`)

    // 解析 JSON 字段
    const sourceWithParsedFields = {
      ...updatedSource,
      testResult: updatedSource.testResult ? JSON.parse(updatedSource.testResult) : null,
      scrapeConfig: updatedSource.scrapeConfig ? JSON.parse(updatedSource.scrapeConfig) : null
    }

    return NextResponse.json({
      success: true,
      source: sourceWithParsedFields,
      testResult
    })
  } catch (error) {
    console.error('[测试] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
