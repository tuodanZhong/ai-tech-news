import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const source = await prisma.rSSSource.findFirst({
      where: {
        lastFetched: {
          not: null
        }
      },
      orderBy: {
        lastFetched: 'desc'
      },
      select: {
        lastFetched: true
      }
    })

    return NextResponse.json({
      success: true,
      lastFetchTime: source?.lastFetched?.toISOString() || null
    })
  } catch (error) {
    console.error('[API] 获取最后采集时间失败:', error)
    return NextResponse.json({
      success: false,
      lastFetchTime: null
    }, { status: 500 })
  }
}
