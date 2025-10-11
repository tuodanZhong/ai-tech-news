# DeepSeek 提示词目录

本文档整理了系统中所有使用 DeepSeek API 的地方及其提示词，便于统一管理和优化。

---

## 📋 提示词清单

系统共有 **3 个核心功能** 使用 DeepSeek API：

| 序号 | 功能模块 | 文件位置 | 用途 | 提示词 ID |
|------|---------|---------|------|-----------|
| 1 | RSS 源智能分析 | `lib/sources/intelligent-discovery.ts` | 分析 RSS 源内容相关性 | `rss_analysis` |
| 2 | 内容智能过滤 | `lib/content-filter.ts` | 过滤不相关的文章 | `content_filter` |
| 3 | 热点话题分析 | `lib/trending-analyzer-v2.ts` | 聚合和识别热点话题 | `trending_analysis` |

---

## 1️⃣ RSS 源智能分析 (`rss_analysis`)

**功能**: 分析 RSS 源采样标题，判断内容类型和相关性

**位置**: `lib/sources/intelligent-discovery.ts` (第 287-313 行)

**调用参数**:
- `model`: `deepseek-chat`
- `temperature`: `0.3`
- `response_format`: `{ type: 'json_object' }`

### System 提示词

```
你是一个RSS源分类专家，精通识别科技、AI、互联网内容的特征。
```

### User 提示词模板

```
你是一个RSS源分类专家。请分析以下RSS源采样的{N}篇文章标题:

RSS URL: {feedUrl}
文章标题:
1. {title1}
2. {title2}
...

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
  * not_recommend: 非科技媒体 (techRelevance + aiRelevance < 30%)
```

**输出格式**: JSON

**调用频率**: 每次发现新 RSS 源时调用（有 500ms 延迟限流）

---

## 2️⃣ 内容智能过滤 (`content_filter`)

**功能**: 判断文章是否与科技/AI/互联网相关，过滤不相关内容

**位置**: `lib/content-filter.ts` (第 84-113 行)

**调用参数**:
- `model`: `deepseek-chat`
- `temperature`: `0.3`
- `response_format`: `{ type: 'json_object' }`
- `batch_size`: 每批最多 50 篇文章

### System 提示词

```
你是一个科技新闻过滤专家，精通识别科技、AI、互联网和商业相关内容。
```

### User 提示词模板

```
你是一个科技新闻过滤专家。请根据**文章主题**判断是否相关，而不是仅看关键词。

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
0. [{source}] {title}
1. [{source}] {title}
...

请以 JSON 格式返回：
{
  "irrelevant": [需要过滤的文章索引数组],
  "reasoning": "简要说明过滤理由"
}
```

**输出格式**: JSON

**调用频率**: 每次新采集文章后调用（每批延迟 1 秒）

---

## 3️⃣ 热点话题分析 (`trending_analysis`)

**功能**: 聚合相似新闻，识别热点话题

**位置**: `lib/trending-analyzer-v2.ts` (第 74-95 行)

**调用参数**:
- `model`: `deepseek-chat`
- `temperature`: 默认 (未指定)
- `response_format`: 未指定（返回普通文本/JSON）

### System 提示词

```
你是一个专业的新闻分析专家，擅长识别热点话题和聚合相似新闻。
```

### User 提示词模板

```
你是一个新闻分析专家，请分析以下新闻标题，找出最近{hours}小时内的热点话题。

规则：
1. 只返回被多个来源（≥2个）报道的话题
2. 将同一事件的不同报道聚合在一起
3. 识别语义相似的标题（如"AMD股价飙升"和"AMD爆炸性反弹"是同一话题）
4. 按讨论热度排序（来源数量 × 报道数量）
5. 只返回前 15 个最热话题

新闻列表：
[0] {source} | {title}
[1] {source} | {title}
...

请返回 JSON 格式（只返回 JSON，不要任何其他文字）：
{
  "hotTopics": [
    {
      "topic": "话题摘要（10-20字）",
      "articleIndexes": [0, 5, 12],
      "sources": ["TechCrunch", "The Verge"]
    }
  ]
}
```

**输出格式**: JSON (但需要从文本中提取)

**调用频率**:
- 12 小时热点：每次定时任务执行（约每小时）
- 24 小时热点：每次定时任务执行（约每小时）

---

## 🔧 技术实现细节

### API 调用方式

所有模块使用相同的 DeepSeek API 调用方式：

```typescript
const response = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3, // RSS分析和内容过滤使用
    response_format: { type: 'json_object' } // RSS分析和内容过滤使用
  })
})
```

### 环境变量

- `DEEPSEEK_API_KEY`: DeepSeek API 密钥（必需）

### 限流策略

1. **RSS 分析**: 每次调用后延迟 500ms
2. **内容过滤**: 每批次（50篇）延迟 1 秒
3. **热点分析**: 无明确限流（每小时执行 2 次）

---

## 📊 提示词统计

| 模块 | System 长度 | User 模板长度 | Temperature | JSON 模式 |
|------|------------|--------------|-------------|-----------|
| RSS 分析 | 33 字 | ~580 字 | 0.3 | ✅ |
| 内容过滤 | 32 字 | ~520 字 | 0.3 | ✅ |
| 热点分析 | 26 字 | ~280 字 | 默认 | ❌ |

---

## 🎯 优化建议

### 短期优化

1. **统一 Temperature 参数**: 热点分析模块未设置 temperature，建议统一为 0.3
2. **统一 JSON 格式**: 热点分析模块未使用 `response_format`，建议启用以提高解析稳定性
3. **添加 Retry 机制**: 所有模块在 API 失败时应有重试逻辑

### 长期优化

1. **提示词可配置化**: 将所有提示词移至数据库或配置文件，支持在线编辑
2. **A/B 测试**: 对不同提示词版本进行效果对比
3. **Token 优化**: 监控各模块的 token 使用量，优化提示词长度
4. **多模型支持**: 支持切换到其他 LLM（如 GPT-4, Claude）

---

## 📝 版本历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| 1.0 | 2025-10-11 | 初始版本，整理所有现有提示词 |

---

## 🔗 相关文档

- [智能 RSS 发现功能文档](./intelligent-rss-discovery.md)
- [智能添加向导文档](./smart-add-source-wizard.md)
- [数据库同步指南](./DATABASE_SYNC_GUIDE.md)
