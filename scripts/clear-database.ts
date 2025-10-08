import { prisma } from '../lib/db'
import { execSync } from 'child_process'

async function clearDatabase() {
  try {
    console.log('🗑️  开始清理数据库...')

    // 删除所有表的数据
    console.log('\n📊 清理数据...')
    const deletedHotTopics = await prisma.hotTopic.deleteMany({})
    console.log(`  ✓ 已删除 ${deletedHotTopics.count} 条热点话题`)

    const deletedFiltered = await prisma.filteredArticle.deleteMany({})
    console.log(`  ✓ 已删除 ${deletedFiltered.count} 条过滤历史`)

    const deletedArticles = await prisma.article.deleteMany({})
    console.log(`  ✓ 已删除 ${deletedArticles.count} 篇文章`)

    const deletedRSS = await prisma.rSSSource.deleteMany({})
    console.log(`  ✓ 已删除 ${deletedRSS.count} 个RSS源`)

    await prisma.$disconnect()

    console.log('\n🔄 同步数据库表结构...')
    execSync('npx prisma db push', { stdio: 'inherit' })

    console.log('\n✅ 数据库清理完成！')
    console.log('📋 表结构已保留并同步')

  } catch (error) {
    console.error('❌ 清理数据库失败:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

clearDatabase()
