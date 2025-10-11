// RSS 源相关类型定义

/**
 * 发现的 RSS Feed
 */
export interface DiscoveredRSSFeed {
  url: string
  name: string
  feedType: 'specific' | 'general' | 'unknown'
  category: string
  techRelevance: number      // 0-100
  aiRelevance: number         // 0-100
  confidence: number          // 0-100
  recommendation: 'strongly_recommend' | 'recommend' | 'caution' | 'not_recommend'
  reasoning: string
  sampleTitles: string[]
}

/**
 * RSS 发现结果
 */
export interface RSSDiscoveryResult {
  websiteName: string
  websiteUrl: string
  feeds: DiscoveredRSSFeed[]
  recommended: DiscoveredRSSFeed[]
  ignored: DiscoveredRSSFeed[]
  reason: string
}

/**
 * API 请求: 发现 RSS
 */
export interface DiscoverRSSRequest {
  url: string
}

/**
 * API 响应: 发现 RSS
 */
export interface DiscoverRSSResponse {
  success: boolean
  data?: RSSDiscoveryResult
  error?: string
  message?: string
}

/**
 * API 请求: 保存 RSS 源
 */
export interface SaveRSSSourceRequest {
  feeds: {
    url: string
    name: string
    category: string
    feedType: string
    websiteUrl: string
    aiAnalysis: string  // JSON string
  }[]
}

/**
 * API 响应: 保存 RSS 源
 */
export interface SaveRSSSourceResponse {
  success: boolean
  data?: {
    saved: number
    sources: Array<{
      id: string
      name: string
      url: string
    }>
  }
  error?: string
}
