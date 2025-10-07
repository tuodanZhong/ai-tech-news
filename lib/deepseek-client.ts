interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DeepSeekResponse {
  choices: {
    message: {
      content: string
    }
  }[]
}

export class DeepSeekClient {
  private apiKey: string
  private baseUrl = 'https://api.deepseek.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async chat(messages: DeepSeekMessage[]): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.3,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.statusText}`)
      }

      const data: DeepSeekResponse = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      console.error('DeepSeek API error:', error)
      throw error
    }
  }

  // 判断两篇文章是否属于同一话题
  async isSameTopic(title1: string, title2: string): Promise<boolean> {
    const prompt = `判断以下两篇新闻标题是否报道同一事件或话题：

标题1: ${title1}
标题2: ${title2}

只需回答 yes 或 no，不要解释。`

    const response = await this.chat([
      {
        role: 'system',
        content: '你是一个新闻分析专家，擅长判断新闻是否属于同一话题。'
      },
      {
        role: 'user',
        content: prompt
      }
    ])

    return response.toLowerCase().trim().includes('yes')
  }

  // 为话题聚类生成摘要标题
  async generateTopicSummary(titles: string[]): Promise<string> {
    const prompt = `以下是关于同一话题的多篇新闻标题，请生成一个简洁的话题摘要（不超过20字）：

${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

只返回摘要，不要解释。`

    const response = await this.chat([
      {
        role: 'system',
        content: '你是一个新闻编辑，擅长提炼新闻要点。'
      },
      {
        role: 'user',
        content: prompt
      }
    ])

    return response.trim()
  }

  // 批量判断文章相似性（优化版）
  async batchCheckSimilarity(articles: { id: string; title: string }[]): Promise<Map<string, string[]>> {
    const clusters = new Map<string, string[]>()
    const processed = new Set<string>()

    for (let i = 0; i < articles.length; i++) {
      if (processed.has(articles[i].id)) continue

      const cluster = [articles[i].id]
      processed.add(articles[i].id)

      // 与后续文章比对
      for (let j = i + 1; j < articles.length; j++) {
        if (processed.has(articles[j].id)) continue

        const isSame = await this.isSameTopic(articles[i].title, articles[j].title)
        if (isSame) {
          cluster.push(articles[j].id)
          processed.add(articles[j].id)
        }
      }

      if (cluster.length > 0) {
        clusters.set(articles[i].id, cluster)
      }
    }

    return clusters
  }
}

// 单例模式
let deepseekClient: DeepSeekClient | null = null

export function getDeepSeekClient(): DeepSeekClient {
  if (!deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set')
    }
    deepseekClient = new DeepSeekClient(apiKey)
  }
  return deepseekClient
}
