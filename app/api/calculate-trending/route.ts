import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 提取关键词（公司名、技术名、主题）
function extractKeywords(text: string): string[] {
  const keywords: string[] = []

  // 常见科技公司
  const companies = [
    'OpenAI', 'Google', 'Microsoft', 'Apple', 'Meta', 'Amazon', 'Tesla', 'NVIDIA', 'AMD', 'Intel',
    'Alibaba', 'Tencent', 'Baidu', 'ByteDance', 'Huawei', 'Xiaomi', 'Samsung', 'TSMC',
    'Netflix', 'Uber', 'Airbnb', 'SpaceX', 'Twitter', 'Facebook', 'Instagram', 'TikTok',
    'ChatGPT', 'Claude', 'Gemini', 'Anthropic', 'DeepMind', 'Salesforce'
  ]

  // 技术关键词
  const techKeywords = [
    'AI', 'artificial intelligence', 'machine learning', 'deep learning', 'LLM', 'GPT',
    'blockchain', 'crypto', 'bitcoin', 'ethereum', 'Web3', 'metaverse', 'VR', 'AR',
    'cloud', '5G', '6G', 'quantum', 'robotics', 'autonomous', 'semiconductor', 'chip',
    'EV', 'electric vehicle', 'battery', 'solar', 'renewable', 'climate tech',
    'cybersecurity', 'privacy', 'data', 'API', 'SaaS', 'startup', 'IPO', 'funding'
  ]

  const allKeywords = [...companies, ...techKeywords]
  const lowerText = text.toLowerCase()

  for (const keyword of allKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      keywords.push(keyword)
    }
  }

  return [...new Set(keywords)] // 去重
}

// 计算热度分数
async function calculateTrendingScore(articleId: string, keywords: string[]): Promise<number> {
  if (keywords.length === 0) return 0

  // 统计每个关键词在所有文章中出现的次数
  const articles = await prisma.article.findMany({
    select: { title: true, description: true }
  })

  const keywordCounts: Record<string, number> = {}

  for (const keyword of keywords) {
    let count = 0
    for (const article of articles) {
      const text = `${article.title} ${article.description || ''}`.toLowerCase()
      if (text.includes(keyword.toLowerCase())) {
        count++
      }
    }
    keywordCounts[keyword] = count
  }

  // 计算总分：关键词提及次数的总和
  const totalMentions = Object.values(keywordCounts).reduce((sum, count) => sum + count, 0)

  // 归一化分数（0-100）
  const maxPossibleScore = keywords.length * articles.length
  const score = maxPossibleScore > 0 ? (totalMentions / maxPossibleScore) * 100 : 0

  return score
}

export async function POST() {
  try {
    const articles = await prisma.article.findMany()
    let updated = 0

    for (const article of articles) {
      const text = `${article.title} ${article.description || ''}`
      const keywords = extractKeywords(text)
      const trendingScore = await calculateTrendingScore(article.id, keywords)

      await prisma.article.update({
        where: { id: article.id },
        data: {
          keywords: keywords.join(', '),
          trendingScore
        }
      })

      updated++
    }

    return NextResponse.json({
      success: true,
      message: `成功计算 ${updated} 篇文章的热度分数`
    })
  } catch (error) {
    console.error('Error calculating trending scores:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
