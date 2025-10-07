import { prisma } from './db'

export interface ScrapedArticle {
  title: string
  description: string
  link: string
  pubDate?: Date
  imageUrl?: string
}

export interface WebScraper {
  name: string
  url: string
  category: string
  scrapeFunction: string // 用于标识使用哪个抓取函数
}

// Bloomberg Technology 抓取逻辑
// 注意：这个函数需要在实际环境中通过 Playwright MCP 执行
export const bloombergTechScraper = {
  name: 'Bloomberg Technology',
  url: 'https://www.bloomberg.com/technology',
  category: '综合科技',

  // 这个函数返回 Playwright 需要执行的操作指令
  getPlaywrightInstructions() {
    return {
      url: 'https://www.bloomberg.com/technology',
      waitForSelector: 'article, [class*="story"]',
      extractData: `
        // 在浏览器上下文中执行的代码
        const articles = [];
        const articleElements = document.querySelectorAll('article, [class*="story-list-story"]');

        articleElements.forEach((article, index) => {
          if (index >= 20) return; // 限制最多 20 篇

          const titleEl = article.querySelector('h3, [class*="headline"]');
          const linkEl = article.querySelector('a[href*="/news/"]');
          const descEl = article.querySelector('[class*="abstract"], [class*="summary"]');
          const imgEl = article.querySelector('img');

          if (titleEl && linkEl) {
            articles.push({
              title: titleEl.textContent.trim(),
              description: descEl ? descEl.textContent.trim() : '',
              link: linkEl.href,
              imageUrl: imgEl ? imgEl.src : null
            });
          }
        });

        return articles;
      `
    }
  }
}

// 所有需要 Playwright 抓取的网站配置
export const WEB_SCRAPERS: WebScraper[] = [
  {
    name: 'Bloomberg Technology',
    url: 'https://www.bloomberg.com/technology',
    category: '综合科技',
    scrapeFunction: 'scrapeBloomberg'
  },
  {
    name: 'Reuters Technology',
    url: 'https://www.reuters.com/technology/',
    category: '综合科技',
    scrapeFunction: 'scrapeReuters'
  }
]

// 通用的保存抓取结果函数
export async function saveScrapedArticles(
  articles: ScrapedArticle[],
  sourceName: string,
  sourceUrl: string,
  category: string
) {
  const savedArticles = []

  for (const article of articles) {
    try {
      // 检查文章是否已存在
      const existingArticle = await prisma.article.findUnique({
        where: { link: article.link }
      })

      if (existingArticle) continue

      // 只保存标题，不保存简介和内容
      const titleOriginal = article.title

      // 保存新文章（不自动翻译，等待用户点击翻译按钮）
      const saved = await prisma.article.create({
        data: {
          title: titleOriginal,
          titleOriginal,
          description: null,
          descriptionOriginal: null,
          content: null,
          contentOriginal: null,
          link: article.link,
          pubDate: article.pubDate || new Date(),
          source: sourceName,
          category: category,
          imageUrl: article.imageUrl,
          isTranslated: false  // 标记为未翻译
        }
      })

      savedArticles.push(saved)
    } catch (error) {
      console.error(`Error saving article ${article.link}:`, error)
    }
  }

  // 更新抓取源记录
  try {
    await prisma.rSSSource.upsert({
      where: { url: sourceUrl },
      update: { lastFetched: new Date() },
      create: {
        name: sourceName,
        url: sourceUrl,
        category: category,
        lastFetched: new Date()
      }
    })
  } catch (error) {
    console.error(`Error updating source ${sourceName}:`, error)
  }

  return savedArticles
}
