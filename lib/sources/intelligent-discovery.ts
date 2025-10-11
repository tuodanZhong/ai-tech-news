// 智能 RSS 发现与分析
import Parser from 'rss-parser'
import { findRSSInPage } from './detector'
import * as iconv from 'iconv-lite'

const parser = new Parser({
  timeout: 10000,
  requestOptions: {
    timeout: 10000
  }
})

// RSS 发现结果
export interface DiscoveredRSSFeed {
  url: string
  name: string
  feedType: 'specific' | 'general' | 'unknown'
  category: string
  techRelevance: number
  aiRelevance: number
  confidence: number
  recommendation: 'strongly_recommend' | 'recommend' | 'caution' | 'not_recommend'
  reasoning: string
  sampleTitles: string[]
}

// 完整发现结果
export interface RSSDiscoveryResult {
  websiteName: string
  websiteUrl: string
  feeds: DiscoveredRSSFeed[]
  recommended: DiscoveredRSSFeed[]
  ignored: DiscoveredRSSFeed[]
  reason: string
}

/**
 * 发现网站的所有 RSS 源
 */
export async function findAllRSSFeeds(url: string): Promise<string[]> {
  console.log(`[发现] 开始分析网站: ${url}`)

  const feeds: string[] = []

  // 1. 从静态 HTML 和常见路径查找 RSS
  const foundFeeds = await findRSSInPage(url)
  feeds.push(...foundFeeds)

  // 2. 尝试特定平台的模式
  const platformFeeds = await detectPlatformSpecificFeeds(url)
  feeds.push(...platformFeeds)

  // 去重
  const uniqueFeeds = [...new Set(feeds)]

  console.log(`[发现] 找到 ${uniqueFeeds.length} 个 RSS 源`)
  return uniqueFeeds
}

/**
 * 检测特定平台的 RSS 模式
 */
async function detectPlatformSpecificFeeds(url: string): Promise<string[]> {
  const baseUrl = new URL(url)
  const hostname = baseUrl.hostname
  const feeds: string[] = []

  // Ars Technica 模式
  if (hostname.includes('arstechnica.com')) {
    const sections = ['ai', 'gadgets', 'information-technology', 'science', 'tech-policy']
    for (const section of sections) {
      feeds.push(`https://arstechnica.com/${section}/feed/`)
    }
  }

  // Wired 模式
  if (hostname.includes('wired.com')) {
    const categories = ['ai', 'gear', 'science', 'security', 'business']
    for (const cat of categories) {
      feeds.push(`https://www.wired.com/feed/category/${cat}/latest/rss`)
    }
  }

  // Medium 模式
  if (hostname.includes('medium.com')) {
    const tags = ['ai', 'machine-learning', 'technology', 'programming']
    for (const tag of tags) {
      feeds.push(`https://medium.com/feed/tag/${tag}`)
    }
  }

  // WordPress 通用模式 (尝试分类RSS)
  const wpCategories = ['tech', 'ai', 'technology', 'science']
  for (const cat of wpCategories) {
    feeds.push(new URL(`/category/${cat}/feed/`, baseUrl).href)
  }

  // 验证这些 URL 是否真的存在
  const validated: string[] = []
  for (const feedUrl of feeds) {
    try {
      const response = await fetch(feedUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      })
      if (response.ok) {
        validated.push(feedUrl)
      }
    } catch {
      // URL 不存在或超时,跳过
    }
  }

  return validated
}

/**
 * 从 URL 提取 feed 名称
 */
export function extractFeedName(feedUrl: string): string {
  try {
    const url = new URL(feedUrl)
    const path = url.pathname

    // 匹配常见模式
    const patterns = [
      /\/([^\/]+)\/feed\/?$/,  // /ai/feed/
      /\/feed\/([^\/]+)\/?$/,  // /feed/ai/
      /\/tag\/([^\/]+)/,       // /tag/ai
      /\/category\/([^\/]+)/,  // /category/tech
    ]

    for (const pattern of patterns) {
      const match = path.match(pattern)
      if (match) {
        return match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }
    }

    // 如果是主站 feed
    if (path === '/feed' || path === '/feed/' || path === '/rss' || path === '/rss/') {
      return 'Main Feed'
    }

    // 默认返回 hostname
    return url.hostname.replace('www.', '')
  } catch {
    return 'Unknown Feed'
  }
}

/**
 * 从网站 URL 提取网站名称
 */
export function extractWebsiteName(websiteUrl: string): string {
  try {
    const url = new URL(websiteUrl)
    const hostname = url.hostname.replace('www.', '')

    // 已知网站映射
    const knownSites: { [key: string]: string } = {
      'techcrunch.com': 'TechCrunch',
      'theverge.com': 'The Verge',
      'arstechnica.com': 'Ars Technica',
      'wired.com': 'Wired',
      'engadget.com': 'Engadget',
      'venturebeat.com': 'VentureBeat',
      'technologyreview.com': 'MIT Technology Review',
      'openai.com': 'OpenAI',
      '36kr.com': '36氪',
      'tmtpost.com': '钛媒体',
      'infoq.cn': 'InfoQ中国',
    }

    return knownSites[hostname] || hostname
  } catch {
    return 'Unknown Website'
  }
}

/**
 * 检测 RSS XML 的编码
 */
function detectRSSEncoding(buffer: Buffer): string {
  const xmlHeader = buffer.toString('utf8', 0, 200) // 读取前200字节

  // 从 XML 声明中提取编码: <?xml version="1.0" encoding="GBK"?>
  const encodingMatch = xmlHeader.match(/encoding=["']([^"']+)["']/i)
  if (encodingMatch) {
    const encoding = encodingMatch[1].toUpperCase()
    console.log(`[编码检测] XML声明编码: ${encoding}`)
    return encoding
  }

  // 默认 UTF-8
  return 'UTF-8'
}

/**
 * 获取并转换 RSS 内容为 UTF-8
 */
async function fetchAndConvertRSS(feedUrl: string): Promise<string> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechNewsBot/1.0)'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    // 获取原始字节
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 检测编码
    const encoding = detectRSSEncoding(buffer)

    // 如果是 UTF-8,直接返回
    if (encoding === 'UTF-8' || encoding === 'UTF8') {
      return buffer.toString('utf8')
    }

    // 转换编码到 UTF-8
    console.log(`[编码转换] ${encoding} -> UTF-8`)
    const decoded = iconv.decode(buffer, encoding)

    return decoded
  } catch (error) {
    console.error(`[RSS获取失败] ${feedUrl}:`, error)
    throw error
  }
}

/**
 * 采样 RSS feed (获取前N篇文章标题)
 */
export async function sampleRSSFeed(feedUrl: string, limit: number = 10): Promise<string[]> {
  try {
    // 先获取并转换编码
    const xmlContent = await fetchAndConvertRSS(feedUrl)

    // 用 rss-parser 解析转换后的 UTF-8 内容
    const feed = await parser.parseString(xmlContent)

    const titles = feed.items
      .slice(0, limit)
      .map(item => item.title || '')
      .filter(title => title.length > 0)

    console.log(`[采样] ${feedUrl}: 获取 ${titles.length} 篇文章标题`)
    return titles
  } catch (error) {
    console.error(`[采样] 失败 ${feedUrl}:`, error)
    return []
  }
}

/**
 * 使用 AI 分析 RSS 内容
 */
export async function analyzeRSSContentWithAI(
  titles: string[],
  feedUrl: string
): Promise<Omit<DiscoveredRSSFeed, 'url' | 'name' | 'sampleTitles'>> {

  if (titles.length === 0) {
    return {
      feedType: 'unknown',
      category: '未知',
      techRelevance: 0,
      aiRelevance: 0,
      confidence: 0,
      recommendation: 'not_recommend',
      reasoning: 'RSS源为空或无法访问'
    }
  }

  // 先尝试快速分类 (基于 URL 模式)
  const quickResult = quickClassifyByURL(feedUrl)
  if (quickResult) {
    console.log(`[分析] ${feedUrl}: 快速分类命中 - ${quickResult.category}`)
  }

  const prompt = `你是一个RSS源分类专家。请分析以下RSS源采样的${titles.length}篇文章标题:

RSS URL: ${feedUrl}
文章标题:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

请判断这个RSS源的特征,返回 JSON:

{
  "feedType": "specific" | "general",
  "category": "AI" | "综合科技" | "科技产品" | "互联网/创业" | "综合新闻" | "其他",
  "techRelevance": 0-100,
  "aiRelevance": 0-100,
  "confidence": 0-100,
  "recommendation": "strongly_recommend" | "recommend" | "caution" | "not_recommend",
  "reasoning": "简要说明判断理由 (1-2句话)"
}

说明:
- feedType: specific=90%以上文章属于AI/科技垂直领域, general=内容覆盖多个领域
- techRelevance: 科技/互联网相关内容占比
- aiRelevance: AI/机器学习相关内容占比
- recommendation:
  * strongly_recommend: 高质量科技/AI专门板块 (techRelevance + aiRelevance > 80%)
  * recommend: 科技媒体全站 (techRelevance + aiRelevance > 60%)
  * caution: 综合媒体包含科技内容 (techRelevance + aiRelevance 在 30%-60% 之间)
  * not_recommend: 非科技媒体 (techRelevance + aiRelevance < 30%)`

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
            content: '你是一个RSS源分类专家，精通识别科技、AI、互联网内容的特征。'
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
      console.error(`[AI分析] API调用失败: ${response.statusText}`)
      // 使用快速分类结果或默认值
      return quickResult || getDefaultAnalysis()
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      console.error('[AI分析] 返回内容为空')
      return quickResult || getDefaultAnalysis()
    }

    const result = JSON.parse(content)
    console.log(`[AI分析] ${feedUrl}: ${result.recommendation} - ${result.reasoning}`)

    return {
      feedType: result.feedType || 'unknown',
      category: result.category || '未知',
      techRelevance: result.techRelevance || 0,
      aiRelevance: result.aiRelevance || 0,
      confidence: result.confidence || 0,
      recommendation: result.recommendation || 'not_recommend',
      reasoning: result.reasoning || ''
    }

  } catch (error) {
    console.error('[AI分析] 出错:', error)
    return quickResult || getDefaultAnalysis()
  }
}

/**
 * URL 模式快速分类
 */
function quickClassifyByURL(url: string): Omit<DiscoveredRSSFeed, 'url' | 'name' | 'sampleTitles'> | null {
  const lowerUrl = url.toLowerCase()

  // AI 相关
  if (lowerUrl.includes('/ai/') || lowerUrl.includes('/artificial-intelligence/')) {
    return {
      feedType: 'specific',
      category: 'AI',
      techRelevance: 95,
      aiRelevance: 90,
      confidence: 90,
      recommendation: 'strongly_recommend',
      reasoning: 'URL模式识别: AI专题RSS'
    }
  }

  // 科技相关
  if (lowerUrl.includes('/tech/') || lowerUrl.includes('/technology/') || lowerUrl.includes('/gadgets/')) {
    return {
      feedType: 'specific',
      category: '综合科技',
      techRelevance: 90,
      aiRelevance: 20,
      confidence: 85,
      recommendation: 'strongly_recommend',
      reasoning: 'URL模式识别: 科技专题RSS'
    }
  }

  // 全站 RSS
  if (lowerUrl.match(/\/feed\/?$/) || lowerUrl.match(/\/rss\/?$/)) {
    return {
      feedType: 'general',
      category: '综合',
      techRelevance: 50,
      aiRelevance: 10,
      confidence: 60,
      recommendation: 'caution',
      reasoning: 'URL模式识别: 全站RSS,需AI分析确认'
    }
  }

  return null
}

/**
 * 默认分析结果
 */
function getDefaultAnalysis(): Omit<DiscoveredRSSFeed, 'url' | 'name' | 'sampleTitles'> {
  return {
    feedType: 'unknown',
    category: '未知',
    techRelevance: 50,
    aiRelevance: 10,
    confidence: 30,
    recommendation: 'caution',
    reasoning: 'AI分析失败,建议手动检查'
  }
}

/**
 * 智能推荐逻辑
 */
export function smartRecommendation(
  feeds: DiscoveredRSSFeed[],
  websiteUrl: string
): { recommended: DiscoveredRSSFeed[], ignored: DiscoveredRSSFeed[], reason: string } {

  // 筛选所有符合推荐标准的源
  const recommended = feeds.filter(f =>
    f.recommendation === 'strongly_recommend' || f.recommendation === 'recommend'
  )

  // 不推荐的源
  const ignored = feeds.filter(f =>
    f.recommendation === 'caution' || f.recommendation === 'not_recommend'
  )

  // 按相关性排序 (使用 techRelevance + aiRelevance 总和)
  const sorted = recommended.sort((a, b) => {
    const scoreA = a.techRelevance + a.aiRelevance
    const scoreB = b.techRelevance + b.aiRelevance
    return scoreB - scoreA
  })

  if (sorted.length > 0) {
    // 统计推荐的源类型
    const specificCount = sorted.filter(f => f.feedType === 'specific').length
    const generalCount = sorted.filter(f => f.feedType === 'general').length

    let reason = ''
    if (specificCount > 0 && generalCount > 0) {
      reason = `发现 ${specificCount} 个专题RSS和 ${generalCount} 个全站RSS,请根据需求选择`
    } else if (specificCount > 0) {
      reason = `发现 ${specificCount} 个科技/AI专题RSS,建议优先选择`
    } else {
      reason = `发现 ${generalCount} 个全站RSS,内容会通过AI过滤`
    }

    return {
      recommended: sorted,
      ignored,
      reason
    }
  } else {
    // 所有源都不推荐
    return {
      recommended: [],
      ignored: feeds,
      reason: '未找到合适的RSS源,建议寻找其他科技媒体'
    }
  }
}

/**
 * 完整的智能发现流程
 */
export async function discoverRSSFeeds(url: string): Promise<RSSDiscoveryResult> {
  const websiteName = extractWebsiteName(url)
  console.log(`[智能发现] 开始分析: ${websiteName}`)

  // 1. 发现所有 RSS 源
  const feedUrls = await findAllRSSFeeds(url)

  if (feedUrls.length === 0) {
    console.log('[智能发现] 未找到任何RSS源')
    return {
      websiteName,
      websiteUrl: url,
      feeds: [],
      recommended: [],
      ignored: [],
      reason: '未找到任何RSS源'
    }
  }

  // 2. 采样 + AI 分析每个 feed
  const analyzed: DiscoveredRSSFeed[] = []

  for (const feedUrl of feedUrls) {
    const name = extractFeedName(feedUrl)
    const sampleTitles = await sampleRSSFeed(feedUrl, 10)

    if (sampleTitles.length === 0) {
      console.log(`[智能发现] ${name}: 无法获取内容,跳过`)
      continue
    }

    const analysis = await analyzeRSSContentWithAI(sampleTitles, feedUrl)

    analyzed.push({
      url: feedUrl,
      name,
      sampleTitles,
      ...analysis
    })

    // 延迟避免 API 限流
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // 3. 智能推荐
  const { recommended, ignored, reason } = smartRecommendation(analyzed, url)

  console.log(`[智能发现] 完成: 推荐 ${recommended.length} 个, 忽略 ${ignored.length} 个`)

  return {
    websiteName,
    websiteUrl: url,
    feeds: analyzed,
    recommended,
    ignored,
    reason
  }
}
