import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearData() {
  try {
    console.log('开始清理数据库数据...')

    // 清理所有表的数据，但保留表结构
    await prisma.hotTopic.deleteMany({})
    console.log('✓ 已清理 HotTopic 表数据')

    await prisma.article.deleteMany({})
    console.log('✓ 已清理 Article 表数据')

    await prisma.rSSSource.deleteMany({})
    console.log('✓ 已清理 RSSSource 表数据')

    console.log('\n✅ 数据库数据清理完成！表结构保持不变。')
  } catch (error) {
    console.error('清理数据时出错:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clearData()
