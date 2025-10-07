import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'time'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}

    if (source && source !== 'all') {
      where.source = source
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    // 根据排序方式选择排序字段
    const orderBy = sortBy === 'trending'
      ? { trendingScore: 'desc' as const }
      : { pubDate: 'desc' as const }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        take: limit,
        skip,
      }),
      prisma.article.count({ where })
    ])

    return NextResponse.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching articles:', error)
    return NextResponse.json({
      error: '获取文章失败'
    }, { status: 500 })
  }
}
