// 信息源测试并保存结果 API

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { testRSSFeed, testWebScrape } from '@/lib/sources/testers'
import { findRSSInPage } from '@/lib/sources/detector'
import type { WebScrapeConfig } from '@/lib/sources/types'

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

    // 解析配置
    const scrapeConfig: WebScrapeConfig | undefined = source.scrapeConfig
      ? JSON.parse(source.scrapeConfig)
      : undefined

    // 智能测试策略: RSS 优先 → 网页爬虫备选 → 最终失败
    let testResult
    let finalType = source.type
    let finalCollectionUrl = source.url // 最终确定的采集 URL
    let attemptLog: string[] = []

    // 第一次尝试: 如果用户指定了类型,先按指定类型测试
    if (source.type === 'rss') {
      attemptLog.push('尝试 RSS 采集...')

      // 1. 先尝试自动发现 RSS feed
      let rssUrl = source.url
      if (!source.url.includes('/feed') && !source.url.includes('.xml') && !source.url.includes('.rss')) {
        attemptLog.push('检测网页中的 RSS 链接...')
        const discoveredFeeds = await findRSSInPage(source.url)
        if (discoveredFeeds.length > 0) {
          rssUrl = discoveredFeeds[0]
          attemptLog.push(`✓ 发现 RSS: ${rssUrl}`)
        } else {
          attemptLog.push('未发现 RSS 链接,尝试直接解析...')
        }
      }

      // 2. 尝试解析 RSS
      testResult = await testRSSFeed(rssUrl)

      // 如果 RSS 失败,自动降级到网页爬虫
      if (!testResult.success) {
        attemptLog.push(`RSS 采集失败: ${testResult.error}`)
        attemptLog.push('自动降级到网页爬虫...')
        testResult = await testWebScrape(source.url, scrapeConfig)

        if (testResult.success) {
          finalType = 'web'
          finalCollectionUrl = source.url // Web 爬虫使用原 URL
          attemptLog.push('✓ 网页爬虫采集成功')
        } else {
          attemptLog.push(`✗ 网页爬虫也失败: ${testResult.error}`)
        }
      } else {
        finalCollectionUrl = rssUrl // RSS 成功,使用 RSS feed URL
        attemptLog.push('✓ RSS 采集成功')
      }
    } else if (source.type === 'web') {
      // 如果指定为 web,也可以先尝试 RSS(因为 RSS 更稳定)
      attemptLog.push('优先尝试 RSS 采集...')

      // 1. 先尝试自动发现 RSS feed
      attemptLog.push('检测网页中的 RSS 链接...')
      const discoveredFeeds = await findRSSInPage(source.url)

      if (discoveredFeeds.length > 0) {
        const rssUrl = discoveredFeeds[0]
        attemptLog.push(`✓ 发现 RSS: ${rssUrl}`)
        const rssResult = await testRSSFeed(rssUrl)

        if (rssResult.success) {
          testResult = rssResult
          finalType = 'rss'
          finalCollectionUrl = rssUrl // 使用发现的 RSS URL
          attemptLog.push('✓ RSS 采集成功,自动切换为 RSS 模式')
        } else {
          attemptLog.push(`RSS 解析失败: ${rssResult.error}`)
          attemptLog.push('使用网页爬虫...')
          testResult = await testWebScrape(source.url, scrapeConfig)

          if (testResult.success) {
            finalCollectionUrl = source.url // Web 爬虫使用原 URL
            attemptLog.push('✓ 网页爬虫采集成功')
          } else {
            attemptLog.push(`✗ 网页爬虫失败: ${testResult.error}`)
          }
        }
      } else {
        attemptLog.push('未检测到 RSS,使用网页爬虫...')
        testResult = await testWebScrape(source.url, scrapeConfig)

        if (testResult.success) {
          finalCollectionUrl = source.url // Web 爬虫使用原 URL
          attemptLog.push('✓ 网页爬虫采集成功')
        } else {
          attemptLog.push(`✗ 网页爬虫失败: ${testResult.error}`)
        }
      }
    } else {
      // 未知类型,执行完整的自动检测流程
      attemptLog.push('自动检测信息源类型...')

      // 1. 先尝试自动发现 RSS
      attemptLog.push('检测网页中的 RSS 链接...')
      const discoveredFeeds = await findRSSInPage(source.url)

      if (discoveredFeeds.length > 0) {
        const rssUrl = discoveredFeeds[0]
        attemptLog.push(`✓ 发现 RSS: ${rssUrl}`)
        const rssResult = await testRSSFeed(rssUrl)

        if (rssResult.success) {
          testResult = rssResult
          finalType = 'rss'
          finalCollectionUrl = rssUrl // 使用发现的 RSS URL
          attemptLog.push('✓ RSS 采集成功')
        } else {
          attemptLog.push(`RSS 解析失败: ${rssResult.error}`)
          attemptLog.push('尝试网页爬虫...')
          const webResult = await testWebScrape(source.url, scrapeConfig)

          if (webResult.success) {
            testResult = webResult
            finalType = 'web'
            finalCollectionUrl = source.url // Web 爬虫使用原 URL
            attemptLog.push('✓ 网页爬虫采集成功')
          } else {
            testResult = webResult
            attemptLog.push(`✗ 网页爬虫也失败: ${webResult.error}`)
            attemptLog.push('所有采集方式均失败')
          }
        }
      } else {
        // 未发现 RSS,直接尝试网页爬虫
        attemptLog.push('未检测到 RSS,尝试网页爬虫...')
        const webResult = await testWebScrape(source.url, scrapeConfig)

        if (webResult.success) {
          testResult = webResult
          finalType = 'web'
          finalCollectionUrl = source.url // Web 爬虫使用原 URL
          attemptLog.push('✓ 网页爬虫采集成功')
        } else {
          testResult = webResult
          attemptLog.push(`✗ 网页爬虫失败: ${webResult.error}`)
          attemptLog.push('所有采集方式均失败')
        }
      }
    }

    // 检查采集 URL 是否已存在（防止重复）
    if (testResult.success && finalCollectionUrl !== source.url) {
      const existingSource = await prisma.rSSSource.findFirst({
        where: {
          url: finalCollectionUrl,
          id: { not: id } // 排除当前源自己
        }
      })

      if (existingSource) {
        attemptLog.push(`⚠️ 采集 URL 已存在于源 "${existingSource.name}"，跳过更新`)
        return NextResponse.json({
          success: false,
          error: `该采集源已存在（源名称: ${existingSource.name}），无需重复添加`,
          attemptLog,
          existingSource: {
            id: existingSource.id,
            name: existingSource.name,
            url: existingSource.url
          }
        }, { status: 409 })
      }
    }

    // 如果测试失败，直接返回错误，不更新数据库
    if (!testResult.success) {
      return NextResponse.json({
        success: false,
        error: testResult.error || '测试失败',
        attemptLog,
        testResult
      }, { status: 400 })
    }

    // 测试成功，更新测试结果到数据库，包括自动检测到的类型和采集 URL
    const updatedSource = await prisma.rSSSource.update({
      where: { id },
      data: {
        url: finalCollectionUrl, // 更新为真正的采集 URL
        type: finalType, // 更新为最终成功的类型
        isTested: true,
        testStatus: 'success',
        testResult: JSON.stringify({
          ...testResult,
          attemptLog, // 保存尝试日志
          detectedType: finalType,
          originalType: source.type,
          collectionUrl: finalCollectionUrl
        }),
        lastTested: new Date()
      }
    })

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
    console.error('Error testing source:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
