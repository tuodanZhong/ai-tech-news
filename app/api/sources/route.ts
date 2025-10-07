import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // 获取数据库中所有不同的信息源
    const sources = await prisma.article.groupBy({
      by: ['source'],
      _count: {
        source: true
      },
      orderBy: {
        source: 'asc'
      }
    })

    // 返回信息源列表（带文章数量）
    const sourceList = sources.map(s => ({
      name: s.source,
      count: s._count.source
    }))

    return NextResponse.json({
      sources: sourceList
    })
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json({
      error: '获取信息源失败'
    }, { status: 500 })
  }
}
