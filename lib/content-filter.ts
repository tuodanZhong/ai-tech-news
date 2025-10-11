import { prisma } from './db'
import { loadPrompt, renderPrompt } from './prompt-loader'

interface FilterResult {
  relevantIds: string[]
  irrelevantIds: string[]
  total: number
  filtered: number
}

export async function filterIrrelevantArticles(articleIds: string[]): Promise<FilterResult> {
  if (articleIds.length === 0) {
    return {
      relevantIds: [],
      irrelevantIds: [],
      total: 0,
      filtered: 0
    }
  }

  console.log(`[过滤器] 开始过滤 ${articleIds.length} 篇文章...`)

  // 获取文章详情
  const articles = await prisma.article.findMany({
    where: {
      id: {
        in: articleIds
      }
    },
    select: {
      id: true,
      title: true,
      titleOriginal: true,
      source: true,
      link: true
    }
  })

  if (articles.length === 0) {
    return {
      relevantIds: [],
      irrelevantIds: [],
      total: 0,
      filtered: 0
    }
  }

  // 分批处理，每次最多 50 篇
  const BATCH_SIZE = 50
  const allRelevantIds: string[] = []
  const allIrrelevantIds: string[] = []

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE)
    console.log(`[过滤器] 处理第 ${Math.floor(i / BATCH_SIZE) + 1} 批，共 ${batch.length} 篇文章`)

    const result = await filterBatch(batch)
    allRelevantIds.push(...result.relevantIds)
    allIrrelevantIds.push(...result.irrelevantIds)

    // 批次之间延迟 1 秒，避免 API 限流
    if (i + BATCH_SIZE < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return {
    relevantIds: allRelevantIds,
    irrelevantIds: allIrrelevantIds,
    total: articles.length,
    filtered: allIrrelevantIds.length
  }
}

async function filterBatch(articles: any[]): Promise<{ relevantIds: string[], irrelevantIds: string[] }> {
  // 准备文章列表供 LLM 分析
  const articleList = articles.map((article, index) => ({
    index,
    id: article.id,
    title: article.title || article.titleOriginal || '',
    source: article.source,
    link: article.link
  }))

  // 从数据库加载提示词配置
  const promptConfig = await loadPrompt('content_filter')

  // 如果加载失败,保留所有文章 (向后兼容)
  if (!promptConfig) {
    console.warn('[过滤器] 提示词配置未找到,保留所有文章')
    return {
      relevantIds: articles.map(a => a.id),
      irrelevantIds: []
    }
  }

  // 渲染提示词模板 (替换变量)
  const userPrompt = renderPrompt(promptConfig.userPromptTemplate, {
    articleList: articleList.map(a => `${a.index}. [${a.source}] ${a.title}`).join('\n')
  })

  try {
    const requestBody: any = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: promptConfig.systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    }

    // 添加可选参数
    if (promptConfig.temperature !== undefined) {
      requestBody.temperature = promptConfig.temperature
    }
    if (promptConfig.useJsonMode) {
      requestBody.response_format = { type: 'json_object' }
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      console.error('[过滤器] DeepSeek API 调用失败:', response.statusText)
      return {
        relevantIds: articles.map(a => a.id),
        irrelevantIds: []
      }
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      console.error('[过滤器] DeepSeek 返回内容为空')
      return {
        relevantIds: articles.map(a => a.id),
        irrelevantIds: []
      }
    }

    const result = JSON.parse(content)
    const irrelevantIndexes = result.irrelevant || []

    console.log(`[过滤器] DeepSeek 分析结果: ${result.reasoning}`)
    console.log(`[过滤器] 标记为不相关的文章数: ${irrelevantIndexes.length}`)

    // 输出被过滤的文章标题，便于调试
    if (irrelevantIndexes.length > 0) {
      console.log('[过滤器] 被过滤的文章:')
      irrelevantIndexes.forEach((idx: number) => {
        const article = articleList[idx]
        if (article) {
          console.log(`  - [${article.source}] ${article.title}`)
        }
      })
    }

    // 分离相关和不相关的文章ID
    const irrelevantIds = irrelevantIndexes.map((idx: number) => articleList[idx]?.id).filter(Boolean)
    const relevantIds = articles.map(a => a.id).filter(id => !irrelevantIds.includes(id))

    // 删除不相关的文章，并记录到过滤历史表
    if (irrelevantIds.length > 0) {
      // 获取被过滤文章的详细信息
      const irrelevantArticles = articles.filter(a => irrelevantIds.includes(a.id))

      // 批量插入到过滤历史表（使用 createMany，跳过已存在的）
      await prisma.filteredArticle.createMany({
        data: irrelevantArticles.map(article => ({
          link: article.link || '',
          title: article.title || article.titleOriginal || '无标题',
          source: article.source,
          reason: result.reasoning || '智能过滤'
        })),
        skipDuplicates: true // 如果link已存在，跳过
      })

      // 删除不相关的文章
      await prisma.article.deleteMany({
        where: {
          id: {
            in: irrelevantIds
          }
        }
      })
      console.log(`[过滤器] 已删除 ${irrelevantIds.length} 篇不相关文章，并记录到过滤历史`)
    }

    return {
      relevantIds,
      irrelevantIds
    }

  } catch (error) {
    console.error('[过滤器] 批次过滤出错:', error)
    // 出错时保留所有文章
    return {
      relevantIds: articles.map(a => a.id),
      irrelevantIds: []
    }
  }
}
