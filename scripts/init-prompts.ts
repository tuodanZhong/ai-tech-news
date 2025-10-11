// 初始化默认提示词配置
import { prisma } from '../lib/db'

const defaultPrompts = [
  {
    key: 'rss_analysis',
    name: 'RSS源智能分析',
    description: '分析RSS源采样标题，判断内容类型和相关性',
    systemPrompt: '你是一个RSS源分类专家，精通识别科技、AI、互联网内容的特征。',
    userPromptTemplate: `你是一个RSS源分类专家。请分析以下RSS源采样的{{count}}篇文章标题:

RSS URL: {{feedUrl}}
文章标题:
{{titles}}

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
  * not_recommend: 非科技媒体 (techRelevance + aiRelevance < 30%)`,
    outputFormat: `{
  "feedType": "specific | general",
  "category": "string",
  "techRelevance": "number (0-100)",
  "aiRelevance": "number (0-100)",
  "confidence": "number (0-100)",
  "recommendation": "strongly_recommend | recommend | caution | not_recommend",
  "reasoning": "string"
}`,
    temperature: 0.3,
    useJsonMode: true
  },
  {
    key: 'content_filter',
    name: '内容智能过滤',
    description: '判断文章是否与科技/AI/互联网相关，过滤不相关内容',
    systemPrompt: '你是一个科技新闻过滤专家，精通识别科技、AI、互联网和商业相关内容。',
    userPromptTemplate: `你是一个科技新闻过滤专家。请根据**文章主题**判断是否相关，而不是仅看关键词。

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
{{articleList}}

请以 JSON 格式返回：
{
  "irrelevant": [需要过滤的文章索引数组],
  "reasoning": "简要说明过滤理由"
}`,
    outputFormat: `{
  "irrelevant": "array of numbers (文章索引)",
  "reasoning": "string"
}`,
    temperature: 0.3,
    useJsonMode: true
  },
  {
    key: 'trending_analysis',
    name: '热点话题分析',
    description: '聚合相似新闻，识别热点话题',
    systemPrompt: '你是一个专业的新闻分析专家，擅长识别热点话题和聚合相似新闻。',
    userPromptTemplate: `你是一个新闻分析专家，请分析以下新闻标题，找出最近{{hours}}小时内的热点话题。

规则：
1. 只返回被多个来源（≥2个）报道的话题
2. 将同一事件的不同报道聚合在一起
3. 识别语义相似的标题（如"AMD股价飙升"和"AMD爆炸性反弹"是同一话题）
4. 按讨论热度排序（来源数量 × 报道数量）
5. 只返回前 15 个最热话题

新闻列表：
{{articleList}}

请返回 JSON 格式（只返回 JSON，不要任何其他文字）：
{
  "hotTopics": [
    {
      "topic": "话题摘要（10-20字）",
      "articleIndexes": [0, 5, 12],
      "sources": ["TechCrunch", "The Verge"]
    }
  ]
}`,
    outputFormat: `{
  "hotTopics": [
    {
      "topic": "string (话题摘要)",
      "articleIndexes": "array of numbers",
      "sources": "array of strings"
    }
  ]
}`,
    temperature: 0.3,
    useJsonMode: true
  }
]

async function main() {
  console.log('[初始化] 开始初始化默认提示词...')

  for (const prompt of defaultPrompts) {
    try {
      const existing = await prisma.promptConfig.findUnique({
        where: { key: prompt.key }
      })

      if (existing) {
        console.log(`[跳过] ${prompt.name} 已存在`)
        continue
      }

      await prisma.promptConfig.create({
        data: prompt
      })

      console.log(`[创建] ${prompt.name} ✓`)
    } catch (error) {
      console.error(`[错误] 创建 ${prompt.name} 失败:`, error)
    }
  }

  console.log('[完成] 默认提示词初始化完成')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
