import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { translateToChinese, isChinese } from '@/lib/translator'

export async function POST() {
  try {
    // 获取所有未翻译的文章
    const untranslatedArticles = await prisma.article.findMany({
      where: {
        isTranslated: false
      },
      orderBy: {
        pubDate: 'desc'
      }
    })

    if (untranslatedArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要翻译的文章',
        count: 0
      })
    }

    let translatedCount = 0
    let failedCount = 0

    // 逐个翻译文章（只翻译标题）
    for (const article of untranslatedArticles) {
      try {
        const titleText = article.titleOriginal || article.title

        // 如果已经是中文，直接标记为已翻译
        if (isChinese(titleText)) {
          await prisma.article.update({
            where: { id: article.id },
            data: {
              title: titleText,
              isTranslated: true
            }
          })
          translatedCount++
          continue
        }

        // 翻译标题
        const title = await translateToChinese(titleText)

        // 更新并标记为已翻译
        await prisma.article.update({
          where: { id: article.id },
          data: {
            title,
            isTranslated: true
          }
        })

        translatedCount++
      } catch (error) {
        console.error(`翻译文章 ${article.id} 失败:`, error)
        failedCount++
        // 继续翻译其他文章
      }
    }

    return NextResponse.json({
      success: true,
      message: `翻译完成：成功 ${translatedCount} 篇${failedCount > 0 ? `，失败 ${failedCount} 篇` : ''}`,
      count: translatedCount,
      failed: failedCount,
      total: untranslatedArticles.length
    })
  } catch (error) {
    console.error('Error in translate-all API:', error)
    return NextResponse.json({
      success: false,
      error: '后台翻译失败'
    }, { status: 500 })
  }
}
