// 信息源管理 API - 更新和删除

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { SourceType } from '@/lib/sources/types'
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/auth'

// GET - 获取单个信息源
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
  if (!verifyAdminAuth(req)) {
    return unauthorizedResponse()
  }
  try {
    const { id } = await context.params

    const source = await prisma.rSSSource.findUnique({
      where: { id }
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // 解析 JSON 字段
    const sourceWithParsedFields = {
      ...source,
      testResult: source.testResult ? JSON.parse(source.testResult) : null,
      scrapeConfig: source.scrapeConfig ? JSON.parse(source.scrapeConfig) : null
    }

    return NextResponse.json({
      success: true,
      source: sourceWithParsedFields
    })
  } catch (error) {
    console.error('Error fetching source:', error)
    return NextResponse.json(
      { error: 'Failed to fetch source' },
      { status: 500 }
    )
  }
}

// PUT - 更新信息源
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
  if (!verifyAdminAuth(req)) {
    return unauthorizedResponse()
  }

  try {
    const { id } = await context.params
    const body = await req.json()
    const {
      name,
      url,
      category,
      type,
      scrapeConfig
    } = body as {
      name?: string
      url?: string
      category?: string
      type?: SourceType
      scrapeConfig?: any
    }

    // 检查信息源是否存在
    const existing = await prisma.rSSSource.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // 如果修改了 URL,验证格式
    if (url) {
      try {
        new URL(url)
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        )
      }

      // 检查新 URL 是否与其他源冲突
      const urlConflict = await prisma.rSSSource.findFirst({
        where: {
          url,
          id: { not: id }
        }
      })

      if (urlConflict) {
        return NextResponse.json(
          { error: 'Another source with this URL already exists' },
          { status: 409 }
        )
      }
    }

    // 验证类型
    if (type && type !== 'rss' && type !== 'web') {
      return NextResponse.json(
        { error: 'Type must be "rss" or "web"' },
        { status: 400 }
      )
    }

    // 构建更新数据
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (url !== undefined) updateData.url = url
    if (category !== undefined) updateData.category = category
    if (type !== undefined) updateData.type = type
    if (scrapeConfig !== undefined) {
      updateData.scrapeConfig = scrapeConfig ? JSON.stringify(scrapeConfig) : null
    }

    // 如果修改了关键配置,重置测试状态
    if (url !== undefined || type !== undefined || scrapeConfig !== undefined) {
      updateData.isTested = false
      updateData.testStatus = 'pending'
      updateData.testResult = null
      updateData.lastTested = null
      // 如果修改了配置,也应该停用源
      updateData.isActive = false
    }

    // 更新信息源
    const source = await prisma.rSSSource.update({
      where: { id },
      data: updateData
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
    })
  } catch (error) {
    console.error('Error updating source:', error)
    return NextResponse.json(
      { error: 'Failed to update source' },
      { status: 500 }
    )
  }
}

// DELETE - 删除信息源
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
  if (!verifyAdminAuth(req)) {
    return unauthorizedResponse()
  }

  try {
    const { id } = await context.params

    // 检查信息源是否存在
    const existing = await prisma.rSSSource.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // 删除信息源
    await prisma.rSSSource.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Source deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting source:', error)
    return NextResponse.json(
      { error: 'Failed to delete source' },
      { status: 500 }
    )
  }
}
