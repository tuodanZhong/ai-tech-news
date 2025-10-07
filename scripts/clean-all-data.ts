import { prisma } from '../lib/db'

async function cleanAllData() {
  try {
    console.log('开始清理数据库所有数据...')

    // 删除所有文章
    const deletedArticles = await prisma.article.deleteMany({})
    console.log(`✅ 已删除 ${deletedArticles.count} 篇文章`)

    // 删除所有热点话题
    const deletedHotTopics = await prisma.hotTopic.deleteMany({})
    console.log(`✅ 已删除 ${deletedHotTopics.count} 个热点话题`)

    console.log('数据库清理完成！')
  } catch (error) {
    console.error('清理数据时出错:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanAllData()
