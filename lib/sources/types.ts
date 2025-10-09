// 信息源类型定义

export type SourceType = 'rss' | 'web'

export type TestStatus = 'pending' | 'success' | 'failed'

// 信息源配置
export interface SourceConfig {
  id?: string
  name: string
  url: string
  category: string
  type: SourceType
  isActive?: boolean
  isTested?: boolean
  testStatus?: TestStatus
  scrapeConfig?: WebScrapeConfig
}

// 网页抓取配置
export interface WebScrapeConfig {
  articleSelector?: string    // 文章列表选择器
  titleSelector?: string       // 标题选择器
  linkSelector?: string        // 链接选择器
  dateSelector?: string        // 日期选择器
  imageSelector?: string       // 图片选择器
  waitForSelector?: string     // 等待加载的选择器
  excludePatterns?: string[]   // 排除 URL 模式 (包含这些文本的链接将被排除)
  includePatterns?: string[]   // 包含 URL 模式 (只保留包含这些文本的链接)
}

// 采集到的文章
export interface CollectedArticle {
  title: string
  link: string
  pubDate?: Date
  imageUrl?: string
  description?: string
  extractStrategy?: string  // 提取策略标识（用于调试）
}

// 测试结果
export interface TestResult {
  success: boolean
  articles: CollectedArticle[]
  count: number
  error?: string
  timestamp: Date
  dateExtractionFailed?: boolean  // Web 采集时，是否因为无法提取日期而失败
  dateExtractionStats?: {          // 日期提取统计
    total: number
    withRealDate: number
    failedCount: number
  }
}

// URL 检测结果
export interface DetectResult {
  type: SourceType
  detected: boolean
  rssUrl?: string              // 如果检测到 RSS
  suggestions?: string[]       // 建议的 RSS 地址
  error?: string
}
