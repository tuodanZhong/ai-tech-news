// 信息源激活 API

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST - 激活或停用信息源
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { isActive } = body as { isActive: boolean }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean value' },
        { status: 400 }
      )
    }

    // 检查信息源是否存在
    const source = await prisma.rSSSource.findUnique({
      where: { id }
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // 如果要激活,检查是否已测试通过
    if (isActive && !source.isTested) {
      return NextResponse.json(
        {
          error: 'Cannot activate source that has not been tested successfully',
          message: '请先测试信息源,确保能正常采集数据后再激活'
        },
        { status: 400 }
      )
    }

    // 如果要激活,检查测试状态
    if (isActive && source.testStatus !== 'success') {
      return NextResponse.json(
        {
          error: 'Cannot activate source with failed or pending test',
          message: '只有测试成功的信息源才能激活'
        },
        { status: 400 }
      )
    }

    // 更新激活状态
    const updatedSource = await prisma.rSSSource.update({
      where: { id },
      data: { isActive }
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
      message: isActive ? 'Source activated successfully' : 'Source deactivated successfully'
    })
  } catch (error) {
    console.error('Error activating/deactivating source:', error)
    return NextResponse.json(
      { error: 'Failed to update source activation status' },
      { status: 500 }
    )
  }
}
