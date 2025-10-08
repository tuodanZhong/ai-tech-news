import Parser from 'rss-parser'
import { prisma } from './db'
import { translateToChinese } from './translator'

const parser = new Parser({
  timeout: 5000, // 5秒超时
  requestOptions: {
    timeout: 5000
  }
})

export interface RSSFeed {
  name: string
  url: string
  category: string
}

export const RSS_FEEDS: RSSFeed[] = [
  // 国际科技媒体（纯科技频道）
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: '综合科技' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: '综合科技' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: '综合科技' },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', category: '综合科技' },

  // Ars Technica 多频道
  { name: 'Ars Technica - AI', url: 'https://arstechnica.com/ai/feed/', category: 'AI' },
  { name: 'Ars Technica - Gadgets', url: 'https://arstechnica.com/gadgets/feed/', category: '综合科技' },
  { name: 'Ars Technica - IT', url: 'https://arstechnica.com/information-technology/feed/', category: '综合科技' },

  // 中文科技媒体（纯科技频道）
  { name: '36氪', url: 'https://36kr.com/feed', category: '综合科技' },
  { name: '钛媒体', url: 'https://www.tmtpost.com/rss.xml', category: '综合科技' },
  { name: 'InfoQ中国', url: 'https://www.infoq.cn/feed', category: '综合科技' },

  // AI 专题
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', category: 'AI' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', category: 'AI' },

  // Wired
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: '综合科技' },

  // Techmeme - 科技新闻聚合
  { name: 'Techmeme', url: 'https://www.techmeme.com/feed.xml', category: '综合科技' },

  // SCMP (South China Morning Post)
  { name: 'SCMP Tech', url: 'https://www.scmp.com/rss/36/feed', category: '综合科技' },
  { name: 'SCMP Business', url: 'https://www.scmp.com/rss/92/feed', category: '综合科技' },
]

export async function fetchRSSFeed(feedUrl: string, sourceName: string, category: string) {
  try {
    const feed = await parser.parseURL(feedUrl)
    const articles: any[] = []

    // 限制每个 RSS 源最多 50 篇
    const limitedItems = feed.items.slice(0, 50)

    // 批量查询：收集所有链接并一次性查询数据库
    const links = limitedItems
      .map(item => item.link)
      .filter(Boolean) as string[]

    if (links.length === 0) return articles

    // 查询已存在的文章
    const existingArticles = await prisma.article.findMany({
      where: { link: { in: links } },
      select: { link: true }
    })

    // 查询过滤历史中的文章（曾经被过滤过的）
    const filteredArticles = await prisma.filteredArticle.findMany({
      where: { link: { in: links } },
      select: { link: true }
    })

    const existingLinks = new Set(existingArticles.map(a => a.link))
    const filteredLinks = new Set(filteredArticles.map(a => a.link))

    // 过滤出新文章并批量创建
    for (const item of limitedItems) {
      if (!item.link) continue

      // 使用 Set 快速判断是否已存在
      if (existingLinks.has(item.link)) continue

      // 检查是否在过滤历史中（曾经被过滤过）
      if (filteredLinks.has(item.link)) {
        console.log(`[RSS] 跳过已过滤文章: ${item.link}`)
        continue
      }

      // 只保存标题，不保存简介和内容
      const titleOriginal = item.title || '无标题'

      try {
        // 先不翻译，保存原文，标记为未翻译
        const article = await prisma.article.create({
          data: {
            title: titleOriginal,
            titleOriginal,
            description: null,
            descriptionOriginal: null,
            content: null,
            contentOriginal: null,
            link: item.link,
            pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            source: sourceName,
            category: category,
            imageUrl: item.enclosure?.url || null,
            isTranslated: false,
          }
        })

        articles.push(article)
      } catch (createError: any) {
        // 如果是唯一约束错误，跳过该文章
        if (createError.code === 'P2002') {
          console.log(`Article already exists, skipping: ${item.link}`)
          continue
        }
        // 其他错误继续抛出
        throw createError
      }
    }

    // 更新 RSS 源的最后抓取时间
    await prisma.rSSSource.upsert({
      where: { url: feedUrl },
      update: { lastFetched: new Date() },
      create: {
        name: sourceName,
        url: feedUrl,
        category: category,
        lastFetched: new Date(),
      }
    })

    return articles
  } catch (error) {
    console.error(`Error fetching RSS feed ${sourceName}:`, error)
    return []
  }
}

export async function fetchAllFeeds() {
  // 并行抓取所有 RSS 源，提升性能
  const results = await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      const articles = await fetchRSSFeed(feed.url, feed.name, feed.category)
      return { feed: feed.name, count: articles.length }
    })
  )

  return results
}
