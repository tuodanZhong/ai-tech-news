import { prisma } from '../lib/db'
import { filterIrrelevantArticles } from '../lib/content-filter'
import { analyzeHotTopicsV2 } from '../lib/trending-analyzer-v2'

async function main() {
  console.log('开始过滤和分析流程...\n')

  // 1. 获取所有文章ID
  console.log('[1/4] 获取所有文章...')
  const allArticles = await prisma.article.findMany({
    select: { id: true }
  })
  console.log(`找到 ${allArticles.length} 篇文章\n`)

  // 2. 用新标准过滤
  console.log('[2/4] 使用新标准过滤文章...')
  const articleIds = allArticles.map(a => a.id)
  const filterResult = await filterIrrelevantArticles(articleIds)
  console.log(`过滤完成: 保留 ${filterResult.relevantIds.length} 篇，删除 ${filterResult.filtered} 篇\n`)

  // 3. 清理旧的热点数据
  console.log('[3/4] 清理旧的热点数据...')
  await prisma.hotTopic.deleteMany({})
  console.log('旧热点数据已清理\n')

  // 4. 生成48小时热点
  console.log('[4/4] 生成新的热点分析...')
  console.log('正在分析48小时热点...')
  const hotTopics48h = await analyzeHotTopicsV2(48)

  if (hotTopics48h.length > 0) {
    // 保存到数据库
    for (const topic of hotTopics48h) {
      await prisma.hotTopic.create({
        data: {
          type: '48h',
          title: topic.title,
          discussionCount: topic.discussionCount,
          sources: JSON.stringify(topic.sources),
          articleIds: JSON.stringify(topic.articles.map(a => a.id)),
          score: topic.trendingScore
        }
      })
    }
    console.log(`✓ 48小时热点: ${hotTopics48h.length} 个`)
  } else {
    console.log('✗ 未能生成48小时热点')
  }

  // 生成24小时热点
  console.log('正在分析24小时热点...')
  const hotTopics24h = await analyzeHotTopicsV2(24)

  if (hotTopics24h.length > 0) {
    // 保存到数据库
    for (const topic of hotTopics24h) {
      await prisma.hotTopic.create({
        data: {
          type: '24h',
          title: topic.title,
          discussionCount: topic.discussionCount,
          sources: JSON.stringify(topic.sources),
          articleIds: JSON.stringify(topic.articles.map(a => a.id)),
          score: topic.trendingScore
        }
      })
    }
    console.log(`✓ 24小时热点: ${hotTopics24h.length} 个`)
  } else {
    console.log('✗ 未能生成24小时热点')
  }

  console.log('\n✅ 全部完成！')
}

main()
  .catch((error) => {
    console.error('执行失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
