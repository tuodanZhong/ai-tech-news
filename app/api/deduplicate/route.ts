import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    // 1. 按 link 去重（link 已经是 unique，但可能有数据不一致的情况）
    const linkDuplicates = await prisma.$queryRaw<{ link: string; count: number }[]>`
      SELECT link, COUNT(*) as count
      FROM Article
      GROUP BY link
      HAVING count > 1
    `

    let deletedByLink = 0
    for (const dup of linkDuplicates) {
      // 保留最新的，删除旧的
      const articles = await prisma.article.findMany({
        where: { link: dup.link },
        orderBy: { createdAt: 'desc' }
      })

      if (articles.length > 1) {
        const toDelete = articles.slice(1).map(a => a.id)
        await prisma.article.deleteMany({
          where: { id: { in: toDelete } }
        })
        deletedByLink += toDelete.length
      }
    }

    // 2. 按标题去重（相似度检查）
    const allArticles = await prisma.article.findMany({
      orderBy: { createdAt: 'desc' }
    })

    const seenTitles = new Map<string, string>() // title -> id
    const toDeleteByTitle: string[] = []

    for (const article of allArticles) {
      const normalizedTitle = article.title.trim().toLowerCase()

      if (seenTitles.has(normalizedTitle)) {
        toDeleteByTitle.push(article.id)
      } else {
        seenTitles.set(normalizedTitle, article.id)
      }
    }

    if (toDeleteByTitle.length > 0) {
      await prisma.article.deleteMany({
        where: { id: { in: toDeleteByTitle } }
      })
    }

    const totalDeleted = deletedByLink + toDeleteByTitle.length

    return NextResponse.json({
      success: true,
      message: '去重完成',
      deleted: {
        byLink: deletedByLink,
        byTitle: toDeleteByTitle.length,
        total: totalDeleted
      }
    })
  } catch (error) {
    console.error('Error deduplicating articles:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
