// 信息源管理 API - 列表和创建

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { SourceType, TestStatus } from '@/lib/sources/types'

// GET - 获取所有信息源
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') // all | active | tested | untested

    let where = {}

    if (filter === 'active') {
      where = { isActive: true }
    } else if (filter === 'tested') {
      where = { isTested: true }
    } else if (filter === 'untested') {
      where = { isTested: false }
    }

    const sources = await prisma.rSSSource.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 转换 testResult 从 JSON 字符串到对象
    const sourcesWithParsedResults = sources.map(source => ({
      ...source,
      testResult: source.testResult ? JSON.parse(source.testResult) : null,
      scrapeConfig: source.scrapeConfig ? JSON.parse(source.scrapeConfig) : null
    }))

    return NextResponse.json({
      success: true,
      sources: sourcesWithParsedResults,
      count: sourcesWithParsedResults.length
    })
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sources' },
      { status: 500 }
    )
  }
}

// POST - 创建新信息源
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name,
      url,
      category,
      type,
      scrapeConfig
    } = body as {
      name: string
      url: string
      category: string
      type: SourceType
      scrapeConfig?: any
    }

    // 验证必填字段
    if (!name || !url || !category || !type) {
      return NextResponse.json(
        { error: 'Name, URL, category, and type are required' },
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

    // 验证类型
    if (type !== 'rss' && type !== 'web') {
      return NextResponse.json(
        { error: 'Type must be "rss" or "web"' },
        { status: 400 }
      )
    }

    // 检查 URL 是否已存在
    const existing = await prisma.rSSSource.findUnique({
      where: { url }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Source with this URL already exists' },
        { status: 409 }
      )
    }

    // 创建信息源
    const source = await prisma.rSSSource.create({
      data: {
        name,
        url,
        category,
        type,
        isActive: false, // 默认未激活
        isTested: false, // 默认未测试
        testStatus: 'pending',
        scrapeConfig: scrapeConfig ? JSON.stringify(scrapeConfig) : null
      }
    })

    // 解析 JSON 字段
    const sourceWithParsedFields = {
      ...source,
      testResult: source.testResult ? JSON.parse(source.testResult) : null,
      scrapeConfig: source.scrapeConfig ? JSON.parse(source.scrapeConfig) : null
    }

    return NextResponse.json({
      success: true,
      source: sourceWithParsedFields
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating source:', error)
    return NextResponse.json(
      { error: 'Failed to create source' },
      { status: 500 }
    )
  }
}
