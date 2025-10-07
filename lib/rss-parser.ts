import Parser from 'rss-parser'
import { prisma } from './db'
import { translateToChinese } from './translator'

const parser = new Parser()

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
    const articles = []

    for (const item of feed.items) {
      // 限制每个 RSS 源最多 50 篇
      if (articles.length >= 50) break

      if (!item.link) continue

      const existingArticle = await prisma.article.findUnique({
        where: { link: item.link }
      })

      if (existingArticle) continue

      // 只保存标题，不保存简介和内容
      const titleOriginal = item.title || '无标题'

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
  const results = []

  for (const feed of RSS_FEEDS) {
    const articles = await fetchRSSFeed(feed.url, feed.name, feed.category)
    results.push({ feed: feed.name, count: articles.length })
  }

  return results
}
