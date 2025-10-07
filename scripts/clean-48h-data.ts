import { prisma } from '../lib/db'

async function clean48hData() {
  try {
    console.log('开始清理最近48小时的数据...')

    // 计算48小时前的时间
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - 48)

    console.log(`删除 ${cutoffTime.toISOString()} 之后的数据...`)

    // 删除最近48小时的文章
    const deletedArticles = await prisma.article.deleteMany({
      where: {
        createdAt: {
          gte: cutoffTime
        }
      }
    })
    console.log(`✅ 已删除 ${deletedArticles.count} 篇文章`)

    // 删除最近48小时的热点话题
    const deletedHotTopics = await prisma.hotTopic.deleteMany({
      where: {
        createdAt: {
          gte: cutoffTime
        }
      }
    })
    console.log(`✅ 已删除 ${deletedHotTopics.count} 个热点话题`)

    console.log('数据清理完成！')
  } catch (error) {
    console.error('清理数据时出错:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clean48hData()
