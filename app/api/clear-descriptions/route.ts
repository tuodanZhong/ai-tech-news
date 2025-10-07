import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    // 清空所有文章的 description 和 content 字段
    const result = await prisma.article.updateMany({
      data: {
        description: null,
        descriptionOriginal: null,
        content: null,
        contentOriginal: null,
      }
    })

    return NextResponse.json({
      success: true,
      updated: result.count,
      message: `已清理 ${result.count} 篇文章的简介内容`
    })
  } catch (error) {
    console.error('Error clearing descriptions:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
