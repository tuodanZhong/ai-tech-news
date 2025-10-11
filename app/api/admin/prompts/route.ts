import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/auth'

// GET: 获取所有提示词配置
export async function GET(request: NextRequest) {
  // 验证管理员权限
  if (!verifyAdminAuth(request)) {
    return unauthorizedResponse()
  }
  try {
    const prompts = await prisma.promptConfig.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        key: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      prompts
    })
  } catch (error) {
    console.error('[API] 获取提示词失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT: 更新提示词配置（允许修改 systemPrompt 和 userPromptTemplate）
export async function PUT(request: NextRequest) {
  // 验证管理员权限
  if (!verifyAdminAuth(request)) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const { key, systemPrompt, userPromptTemplate } = body

    if (!key) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: key'
      }, { status: 400 })
    }

    // 至少需要提供一个要更新的字段
    if (!systemPrompt && !userPromptTemplate) {
      return NextResponse.json({
        success: false,
        error: 'At least one field (systemPrompt or userPromptTemplate) must be provided'
      }, { status: 400 })
    }

    // 验证 key 是否存在
    const existing = await prisma.promptConfig.findUnique({
      where: { key }
    })

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Prompt configuration not found'
      }, { status: 404 })
    }

    // 构建更新数据（只更新提供的字段）
    const updateData: any = {
      version: { increment: 1 }, // 自动增加版本号
      updatedAt: new Date()
    }

    if (systemPrompt !== undefined) {
      updateData.systemPrompt = systemPrompt
    }

    if (userPromptTemplate !== undefined) {
      updateData.userPromptTemplate = userPromptTemplate
    }

    // 更新提示词配置
    const updated = await prisma.promptConfig.update({
      where: { key },
      data: updateData
    })

    console.log(`[API] 更新提示词: ${key} -> v${updated.version}`)

    return NextResponse.json({
      success: true,
      prompt: updated
    })
  } catch (error) {
    console.error('[API] 更新提示词失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
