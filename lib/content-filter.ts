import { prisma } from './db'

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
      source: true
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

  // 准备文章列表供 LLM 分析
  const articleList = articles.map((article, index) => ({
    index,
    id: article.id,
    title: article.title || article.titleOriginal || '',
    source: article.source
  }))

  const prompt = `你是一个科技新闻过滤专家。请分析以下新闻标题，筛选出**明确不相关**的内容。

**保留标准**（以下任一即保留）：
- AI/人工智能相关
- 科技公司/互联网公司相关
- 互联网产品/服务相关
- 商业/创业/投资相关
- 技术/编程/开发相关
- 数字化/云计算/大数据相关
- 自然科学研究相关（物理、化学、生物、天文、地质等科学研究）

**过滤标准**（需同时满足才过滤）：
- 明确与科技、AI、互联网、商业、自然科学研究无关
- 纯粹的政治、体育、娱乐、生活类新闻
- 注意：即使看起来不太相关，但如果涉及科技公司、互联网或科学研究，仍应保留

新闻列表：
${articleList.map(a => `${a.index}. [${a.source}] ${a.title}`).join('\n')}

请以 JSON 格式返回：
{
  "irrelevant": [需要过滤的文章索引数组],
  "reasoning": "简要说明过滤理由"
}

注意：
1. 宁可保守过滤（保留更多），不要过度过滤
2. 如果不确定，倾向于保留
3. 只返回**明确不相关**的索引`

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个科技新闻过滤专家，精通识别科技、AI、互联网和商业相关内容。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('[过滤器] DeepSeek API 调用失败:', response.statusText)
      return {
        relevantIds: articleIds,
        irrelevantIds: [],
        total: articles.length,
        filtered: 0
      }
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      console.error('[过滤器] DeepSeek 返回内容为空')
      return {
        relevantIds: articleIds,
        irrelevantIds: [],
        total: articles.length,
        filtered: 0
      }
    }

    const result = JSON.parse(content)
    const irrelevantIndexes = result.irrelevant || []

    console.log(`[过滤器] DeepSeek 分析结果: ${result.reasoning}`)
    console.log(`[过滤器] 标记为不相关的文章数: ${irrelevantIndexes.length}`)

    // 分离相关和不相关的文章ID
    const irrelevantIds = irrelevantIndexes.map((idx: number) => articleList[idx]?.id).filter(Boolean)
    const relevantIds = articles.map(a => a.id).filter(id => !irrelevantIds.includes(id))

    // 删除不相关的文章
    if (irrelevantIds.length > 0) {
      await prisma.article.deleteMany({
        where: {
          id: {
            in: irrelevantIds
          }
        }
      })
      console.log(`[过滤器] 已删除 ${irrelevantIds.length} 篇不相关文章`)
    }

    return {
      relevantIds,
      irrelevantIds,
      total: articles.length,
      filtered: irrelevantIds.length
    }

  } catch (error) {
    console.error('[过滤器] 过滤过程出错:', error)
    // 出错时保留所有文章
    return {
      relevantIds: articleIds,
      irrelevantIds: [],
      total: articles.length,
      filtered: 0
    }
  }
}
