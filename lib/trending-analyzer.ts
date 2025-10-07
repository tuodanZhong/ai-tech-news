import { prisma } from './db'
import { getDeepSeekClient } from './deepseek-client'

export interface HotTopic {
  id: string
  title: string
  articles: {
    id: string
    title: string
    link: string
    source: string
    pubDate: Date
  }[]
  sources: string[]
  discussionCount: number
  trendingScore: number
  latestUpdate: Date
}

export async function analyzeHotTopics(hours: number = 48): Promise<HotTopic[]> {
  console.log(`[热点分析] 开始分析最近 ${hours} 小时的热点...`)

  // 1. 获取指定时间内的文章
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)
  const articles = await prisma.article.findMany({
    where: {
      pubDate: {
        gte: cutoffTime
      }
    },
    orderBy: {
      pubDate: 'desc'
    },
    select: {
      id: true,
      title: true,
      titleOriginal: true,
      link: true,
      source: true,
      pubDate: true,
      isTranslated: true
    }
  })

  console.log(`[热点分析] 找到 ${articles.length} 篇文章`)

  if (articles.length === 0) {
    return []
  }

  // 2. 使用 DeepSeek 进行全面聚类（不依赖传统算法初筛）
  const deepseek = getDeepSeekClient()
  const clusters: Map<string, string[]> = new Map()
  const processed = new Set<string>()

  console.log(`[热点分析] 开始 LLM 聚类...`)

  // 遍历所有文章，使用 LLM 进行聚类
  for (let i = 0; i < articles.length; i++) {
    if (processed.has(articles[i].id)) continue

    const cluster: string[] = [articles[i].id]
    processed.add(articles[i].id)

    const baseTitle = articles[i].isTranslated
      ? articles[i].title
      : articles[i].titleOriginal || articles[i].title

    console.log(`[热点分析] 分析话题 ${i + 1}/${articles.length}: ${baseTitle.substring(0, 50)}...`)

    // 与后续未处理的文章比对
    for (let j = i + 1; j < articles.length; j++) {
      if (processed.has(articles[j].id)) continue

      const compareTitle = articles[j].isTranslated
        ? articles[j].title
        : articles[j].titleOriginal || articles[j].title

      try {
        const isSame = await deepseek.isSameTopic(baseTitle, compareTitle)
        if (isSame) {
          cluster.push(articles[j].id)
          processed.add(articles[j].id)
          console.log(`  ✓ 聚合: ${compareTitle.substring(0, 50)}...`)
        }
      } catch (error) {
        console.error('[热点分析] LLM 判断失败:', error)
        // 降级：如果 LLM 失败，使用关键词匹配
        const keywords1 = extractKeywords(baseTitle)
        const keywords2 = extractKeywords(compareTitle)
        const commonKeywords = keywords1.filter(k => keywords2.includes(k))

        if (commonKeywords.length >= 2 || baseTitle.includes(compareTitle) || compareTitle.includes(baseTitle)) {
          cluster.push(articles[j].id)
          processed.add(articles[j].id)
          console.log(`  ✓ 聚合(降级): ${compareTitle.substring(0, 50)}...`)
        }
      }
    }

    if (cluster.length > 0) {
      clusters.set(articles[i].id, cluster)
    }
  }

  console.log(`[热点分析] LLM 聚类完成，共 ${clusters.size} 个话题`)

  // 4. 计算热度并生成结果
  const hotTopics: HotTopic[] = []

  for (const [mainId, articleIds] of clusters) {
    const clusterArticles = articles.filter(a => articleIds.includes(a.id))

    if (clusterArticles.length === 0) continue

    // 获取所有来源
    const sources = [...new Set(clusterArticles.map(a => a.source))]

    // 计算热度分数
    const trendingScore = calculateTrendingScore(
      clusterArticles.length,
      sources.length,
      clusterArticles[0].pubDate
    )

    // 跳过热度为 0 的话题（单来源单文章）
    if (trendingScore === 0) {
      continue
    }

    // 生成话题标题（使用最新文章的标题）
    const latestArticle = clusterArticles[0]
    const topicTitle = latestArticle.isTranslated
      ? latestArticle.title
      : latestArticle.titleOriginal || latestArticle.title

    hotTopics.push({
      id: mainId,
      title: topicTitle,
      articles: clusterArticles.map(a => ({
        id: a.id,
        title: a.isTranslated ? a.title : a.titleOriginal || a.title,
        link: a.link,
        source: a.source,
        pubDate: a.pubDate
      })),
      sources,
      discussionCount: clusterArticles.length,
      trendingScore,
      latestUpdate: clusterArticles[0].pubDate
    })
  }

  // 5. 按热度排序，返回 Top 10
  const topHotTopics = hotTopics
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 10)

  console.log(`[热点分析] 分析完成，返回 ${topHotTopics.length} 个热点话题`)

  return topHotTopics
}

// 提取关键词（简单版本）
function extractKeywords(title: string): string[] {
  // 移除标点符号，分词
  const words = title
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2) // 只保留长度 > 2 的词

  // 移除常见停用词
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个']
  return words.filter(w => !stopWords.includes(w))
}

// 计算热度分数（纯粹基于讨论度）
function calculateTrendingScore(
  articleCount: number,
  sourceCount: number,
  latestDate: Date
): number {
  // 基础门槛：必须有多个来源才算热点
  if (sourceCount < 2) {
    return 0 // 单来源不算热点，无论有多少文章
  }

  // 文章数量权重：每篇 5 分
  const countScore = articleCount * 5

  // 来源多样性权重：每个来源 3 分
  const diversityScore = sourceCount * 3

  // 多来源加成：3个以上来源额外加分
  const diversityBonus = sourceCount >= 3 ? (sourceCount - 2) * 5 : 0

  return countScore + diversityScore + diversityBonus
}
