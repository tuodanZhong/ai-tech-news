// 检测 URL 类型的 API

import { NextRequest, NextResponse } from 'next/server'
import { detectSourceType } from '@/lib/sources/detector'
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // 验证管理员权限
  if (!verifyAdminAuth(req)) {
    return unauthorizedResponse()
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
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

    // 检测类型
    const result = await detectSourceType(url)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error detecting source type:', error)
    return NextResponse.json(
      { error: 'Failed to detect source type' },
      { status: 500 }
    )
  }
}
