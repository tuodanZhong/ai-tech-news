import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { translateToChinese, isChinese } from '@/lib/translator'

export async function POST(request: NextRequest) {
  try {
    const { page, limit = 20, source, search, sortBy = 'date' } = await request.json()

    // 构建查询条件（与 /api/articles 保持一致）
    const where: any = {}

    if (source) {
      where.source = source
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { titleOriginal: { contains: search, mode: 'insensitive' } },
        { descriptionOriginal: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 获取当前页的文章（包括已翻译和未翻译的）
    const skip = (page - 1) * limit
    const orderBy = sortBy === 'source' ? { source: 'asc' as const } : { pubDate: 'desc' as const }

    const articles = await prisma.article.findMany({
      where,
      skip,
      take: limit,
      orderBy
    })

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: '当前页面没有文章',
        count: 0
      })
    }

    let translatedCount = 0
    let skippedCount = 0
    let failedCount = 0

    // 逐个翻译文章（只翻译标题）
    for (const article of articles) {
      try {
        // 只检查并翻译标题
        const titleText = article.titleOriginal || article.title
        console.log(`[翻译] 处理文章: ${article.id}, 标题: ${titleText.substring(0, 50)}...`)

        // 如果已经是中文，直接标记为已翻译
        if (isChinese(titleText)) {
          console.log(`[翻译] 已是中文，跳过翻译`)
          // 如果尚未标记为已翻译，则标记
          if (!article.isTranslated) {
            await prisma.article.update({
              where: { id: article.id },
              data: {
                title: titleText,
                isTranslated: true
              }
            })
            translatedCount++
          } else {
            skippedCount++
          }
          continue
        }

        // 如果已经翻译过，跳过
        if (article.isTranslated) {
          console.log(`[翻译] 已翻译过，跳过`)
          skippedCount++
          continue
        }

        // 翻译标题（如果失败会抛出错误）
        console.log(`[翻译] 调用翻译API...`)
        const title = await translateToChinese(titleText)
        console.log(`[翻译] 翻译结果: ${title.substring(0, 50)}...`)

        // API调用成功就更新并标记为已翻译（不再验证翻译结果）
        await prisma.article.update({
          where: { id: article.id },
          data: {
            title,
            isTranslated: true
          }
        })

        console.log(`[翻译] 成功翻译并保存`)
        translatedCount++
      } catch (error) {
        console.error(`[翻译] 文章 ${article.id} 翻译失败:`, error)
        console.error(`[翻译] 标题: ${article.titleOriginal || article.title}`)
        failedCount++
        // 继续翻译其他文章，但不标记为已翻译
      }
    }

    let message = `成功翻译 ${translatedCount} 篇`
    if (skippedCount > 0) {
      message += `，跳过 ${skippedCount} 篇（已翻译）`
    }
    if (failedCount > 0) {
      message += `，失败 ${failedCount} 篇`
    }

    return NextResponse.json({
      success: true,
      message,
      count: translatedCount,
      skipped: skippedCount,
      failed: failedCount
    })
  } catch (error) {
    console.error('Error in translate API:', error)
    return NextResponse.json({
      success: false,
      error: '翻译失败'
    }, { status: 500 })
  }
}
