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

  const prompt = `你是一个科技新闻过滤专家。请根据**文章主题**判断是否相关，而不是仅看关键词。

**保留标准（满足任一即保留）：**
- AI/人工智能相关（包括AI产品、AI应用、AI公司）
- 科技公司/互联网公司的产品、业务、战略、投资
- 技术、编程、开发相关
- 科技产品报道（即使提到价格、销售，只要主题是科技产品就保留）
- 商业投资新闻（科技/互联网领域的投资、并购、股票）
- 自然科学研究

**删除标准（主题必须是以下内容才删除）：**
- 纯电商促销广告（双11、618、限时秒杀等）
- 旅游出行数据（客运量、旅客人次、假期出游）
- 影视娱乐消费（票房、演唱会、综艺）
- 传统零售、餐饮、时尚（非科技类）
- 体育、政治、社会新闻

**重要：不要因为出现"价格"、"买"、"卖"等词就删除，要看主题！**
- ✅ "AI产品售价700美金" - 主题是AI产品，保留
- ✅ "巴菲特减持科技股" - 主题是投资，保留
- ❌ "飞猪国庆客单价提升" - 主题是旅游消费，删除

新闻列表：
${articleList.map(a => `${a.index}. [${a.source}] ${a.title}`).join('\n')}

请以 JSON 格式返回：
{
  "irrelevant": [需要过滤的文章索引数组],
  "reasoning": "简要说明过滤理由"
}`

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
