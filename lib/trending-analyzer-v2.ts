import { prisma } from './db'
import { getDeepSeekClient } from './deepseek-client'
import { loadPrompt, renderPrompt } from './prompt-loader'

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

interface LLMHotTopic {
  topic: string
  articleIndexes: number[]
  sources: string[]
}

interface LLMResponse {
  hotTopics: LLMHotTopic[]
}

export async function analyzeHotTopicsV2(hours: number = 48): Promise<HotTopic[]> {
  console.log(`[热点分析V2] 开始分析最近 ${hours} 小时的热点...`)

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

  console.log(`[热点分析V2] 找到 ${articles.length} 篇文章`)

  if (articles.length === 0) {
    return []
  }

  // 限制文章数量，避免 token 超限（取最新的 200 篇）
  const limitedArticles = articles.slice(0, 200)
  console.log(`[热点分析V2] 分析最新的 ${limitedArticles.length} 篇文章`)

  // 2. 构造文章列表（带编号）
  const articleList = limitedArticles.map((article, index) => {
    const title = article.isTranslated
      ? article.title
      : article.titleOriginal || article.title
    return `[${index}] ${article.source} | ${title}`
  }).join('\n')

  // 3. 从数据库加载提示词配置
  const promptConfig = await loadPrompt('trending_analysis')

  // 如果加载失败,返回空数组 (向后兼容)
  if (!promptConfig) {
    console.warn('[热点分析V2] 提示词配置未找到,跳过分析')
    return []
  }

  // 渲染提示词模板 (替换变量)
  const userPrompt = renderPrompt(promptConfig.userPromptTemplate, {
    hours: hours.toString(),
    articleList: articleList
  })

  // 4. 调用 LLM
  const deepseek = getDeepSeekClient()
  let llmResponse: LLMResponse

  try {
    console.log('[热点分析V2] 调用 DeepSeek 分析热点...')

    const response = await deepseek.chat([
      {
        role: 'system',
        content: promptConfig.systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ])

    console.log('[热点分析V2] LLM 原始响应:', response)

    // 提取 JSON（去除可能的 markdown 代码块）
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('LLM 返回格式错误')
    }

    llmResponse = JSON.parse(jsonMatch[0])
    console.log(`[热点分析V2] 识别出 ${llmResponse.hotTopics.length} 个热点话题`)

  } catch (error) {
    console.error('[热点分析V2] LLM 分析失败:', error)
    return []
  }

  // 5. 映射回文章数据并计算热度
  const hotTopics: HotTopic[] = []

  for (const llmTopic of llmResponse.hotTopics) {
    // 过滤无效索引
    const validIndexes = llmTopic.articleIndexes.filter(
      idx => idx >= 0 && idx < limitedArticles.length
    )

    if (validIndexes.length === 0) continue

    // 获取对应的文章
    const topicArticles = validIndexes.map(idx => limitedArticles[idx])

    // 获取所有来源
    const sources = [...new Set(topicArticles.map(a => a.source))]

    // 过滤单来源话题
    if (sources.length < 2) {
      console.log(`[热点分析V2] 跳过单来源话题: ${llmTopic.topic}`)
      continue
    }

    // 计算热度分数
    const trendingScore = calculateTrendingScore(
      topicArticles.length,
      sources.length
    )

    hotTopics.push({
      id: topicArticles[0].id,
      title: llmTopic.topic,
      articles: topicArticles.map(a => ({
        id: a.id,
        title: a.isTranslated ? a.title : a.titleOriginal || a.title,
        link: a.link,
        source: a.source,
        pubDate: a.pubDate
      })),
      sources,
      discussionCount: topicArticles.length,
      trendingScore,
      latestUpdate: topicArticles[0].pubDate
    })
  }

  // 6. 按热度排序，返回 Top 10
  const topHotTopics = hotTopics
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 10)

  console.log(`[热点分析V2] 分析完成，返回 ${topHotTopics.length} 个热点话题`)

  return topHotTopics
}

// 计算热度分数
function calculateTrendingScore(
  articleCount: number,
  sourceCount: number
): number {
  // 文章数量权重：每篇 5 分
  const countScore = articleCount * 5

  // 来源多样性权重：每个来源 3 分
  const diversityScore = sourceCount * 3

  // 多来源加成：3个以上来源额外加分
  const diversityBonus = sourceCount >= 3 ? (sourceCount - 2) * 5 : 0

  return countScore + diversityScore + diversityBonus
}
