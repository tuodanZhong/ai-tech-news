# 智能 RSS 发现功能文档

## 概述

智能 RSS 发现功能是一个完整的自动化系统,用于从任何网站智能地发现、分析和推荐最合适的 RSS 源。该功能结合了 URL 模式识别和 DeepSeek AI 分析,确保只收集高质量的科技/AI 相关内容。

## 核心特性

### 1. 自动发现
- 从 HTML `<link>` 标签中提取 RSS 源
- 尝试常见的 RSS 路径 (`/feed`, `/rss`, `/atom.xml` 等)
- 支持平台特定的发现规则 (Ars Technica, Wired, Medium 等)

### 2. 智能分类
- **URL 模式快速分类**: 根据 URL 路径快速判断源类型
  - AI 相关: `/ai/`, `/artificial-intelligence/`, `/machine-learning/`
  - 科技相关: `/tech/`, `/science/`, `/gadgets/`
  - 通用内容: `/feed`, `/rss`

- **AI 内容分析**: 使用 DeepSeek API 分析实际文章标题
  - 采样前 10 篇文章
  - 分析科技相关性 (0-100%)
  - 分析 AI 相关性 (0-100%)
  - 给出推荐度和详细理由

### 3. 智能推荐
遵循"有好的就不要差的"原则:
- 如果发现专门的 AI/科技板块 RSS (90%+ 相关性)
  - ✅ 推荐这些专门板块
  - ❌ 忽略全站 RSS
- 如果没有专门板块
  - 推荐全站 RSS (需要后续 AI 过滤)

### 4. 采集限制
- **时间窗口**: 只采集最近 48 小时内的文章
- **数量限制**: 每个源最多采集 50 篇文章
- 按发布时间倒序排列,优先采集最新内容

## 数据库结构

### RSSSource 模型新增字段

```prisma
model RSSSource {
  // ... 原有字段

  feedType     String?  @default("unknown")  // "specific" | "general" | "unknown"
  websiteUrl   String?                       // 网站主页 URL
  aiAnalysis   String?                       // AI 分析结果 JSON

  @@index([feedType])
}
```

### aiAnalysis JSON 结构

```json
{
  "techRelevance": 100,          // 科技相关性 0-100
  "aiRelevance": 95,             // AI 相关性 0-100
  "confidence": 90,              // 置信度 0-100
  "recommendation": "strongly_recommend",  // 推荐度
  "reasoning": "详细的推荐理由",
  "sampleTitles": ["示例文章1", "示例文章2", ...]
}
```

## API 接口

### 1. 发现 RSS 源

**POST** `/api/sources/discover`

请求体:
```json
{
  "url": "https://example.com"
}
```

响应:
```json
{
  "success": true,
  "data": {
    "websiteName": "Example Site",
    "websiteUrl": "https://example.com",
    "feeds": [...],              // 所有发现的源
    "recommended": [...],         // AI 推荐的源
    "ignored": [...],            // 被忽略的源
    "reason": "推荐理由说明"
  }
}
```

### 2. 保存 RSS 源

**POST** `/api/sources/save`

请求体:
```json
{
  "feeds": [
    {
      "url": "https://example.com/ai/feed",
      "name": "AI Section",
      "category": "AI",
      "feedType": "specific",
      "websiteUrl": "https://example.com",
      "aiAnalysis": "{...}"      // JSON 字符串
    }
  ]
}
```

响应:
```json
{
  "success": true,
  "data": {
    "saved": 2,
    "total": 3,
    "sources": [...],
    "errors": [...]              // 保存失败的源(如已存在)
  }
}
```

## 前端使用

### 管理界面集成

在 `/app/admin/sources/page.tsx` 中已集成:

1. **智能发现按钮**: 位于页面顶部操作栏
   ```tsx
   🔍 智能发现
   ```

2. **发现模态框**: `IntelligentDiscoveryModal` 组件
   - URL 输入框
   - 自动发现和分析
   - 展示推荐结果
   - 多选保存功能

### 用户工作流

1. 点击"🔍 智能发现"按钮
2. 输入网站 URL (如 `https://techcrunch.com`)
3. 等待智能分析 (通常 10-30 秒)
4. 查看推荐结果:
   - ✅ 推荐的源 (绿色背景,默认已选中)
   - ⚪ 忽略的源 (灰色背景,可展开查看)
5. 选择要保存的源
6. 点击"保存选中的源"
7. 系统自动刷新源列表

## 测试

### 单元测试

#### 测试发现 API (TechCrunch)
```bash
npx tsx scripts/test-discover-api.ts
```

#### 测试发现 API (Ars Technica - 多板块)
```bash
npx tsx scripts/test-discover-api-arstechnica.ts
```

#### 测试完整工作流
```bash
npx tsx scripts/test-intelligent-discovery-flow.ts
```

### 测试结果示例

**Ars Technica 测试**:
- 发现 6 个 RSS 源
- 推荐 3 个专门板块:
  - AI (100% 科技相关性, 100% AI 相关性)
  - Gadgets (100% 科技相关性, 0% AI 相关性)
  - Tech Policy (100% 科技相关性, 10% AI 相关性)
- 忽略 1 个全站 RSS (因为有更好的专门板块)

## 核心代码

### lib/sources/intelligent-discovery.ts

主要函数:
- `findAllRSSFeeds(url)`: 发现所有 RSS 源
- `sampleRSSFeed(feedUrl, limit)`: 采样文章标题
- `analyzeRSSContentWithAI(titles, feedUrl)`: AI 分析内容
- `smartRecommendation(feeds, websiteUrl)`: 智能推荐
- `discoverRSSFeeds(url)`: 完整发现流程

### components/admin/IntelligentDiscoveryModal.tsx

React 组件,提供完整的 UI 交互:
- URL 输入和验证
- 发现进度展示
- 结果展示和选择
- 批量保存功能

## 最佳实践

### 1. 选择合适的源
- 优先选择 `specific` (专门板块) 源
- 如果没有专门板块,再选择 `general` (全站) 源
- 查看 AI 分析的示例文章,确认内容质量

### 2. 测试新源
保存后务必:
1. 点击"测试"按钮验证源可用性
2. 查看采集到的文章数量和质量
3. 只激活测试成功的源

### 3. 监控采集效果
- 定期检查采集的文章数量
- 如果数量异常少,可能需要:
  - 检查源是否还在更新
  - 调整采集规则
  - 考虑更换为其他源

## 故障排除

### 问题 1: 发现失败或超时
**可能原因**:
- 网站不响应或响应慢
- 网站没有 RSS 源
- DeepSeek API 超时

**解决方案**:
- 检查网站是否可访问
- 手动查看网站是否有 RSS 链接
- 查看服务器日志确认 API 状态

### 问题 2: 没有推荐的源
**可能原因**:
- 网站内容与科技/AI 不相关
- AI 分析判定相关性过低

**解决方案**:
- 确认网站是科技/AI 相关网站
- 查看"忽略的源"部分,了解原因
- 如果确实相关,可以手动添加源

### 问题 3: 保存时提示已存在
**原因**: 该 RSS URL 已在数据库中

**解决方案**:
- 正常现象,不影响功能
- 前往源列表查看已存在的源
- 如果需要更新,先删除旧源再重新保存

## 性能优化

### 1. URL 模式快速分类
通过 URL 路径快速判断源类型,避免不必要的 AI 调用:
```typescript
if (url.includes('/ai/') || url.includes('/artificial-intelligence/')) {
  return 'specific'  // 直接返回,不调用 AI
}
```

### 2. 采样限制
只采样前 10 篇文章进行分析,减少网络请求和处理时间

### 3. 并发发现
虽然当前是串行处理,但架构支持未来改为并发发现多个源

## 未来改进

### 1. 批量发现
支持一次输入多个 URL,批量发现和分析

### 2. 定期重新分析
对已保存的源定期重新采样分析,确保内容质量持续符合要求

### 3. 用户反馈学习
收集用户对推荐的反馈,优化 AI 分析模型

### 4. 更多平台支持
增加对更多平台的特定发现规则:
- Reddit subreddits
- YouTube channels
- Substack newsletters
- GitHub trending

## 相关文件

### 核心功能
- `lib/sources/intelligent-discovery.ts` - 核心发现逻辑
- `lib/unified-collector.ts` - 采集限制实现
- `lib/rss-parser.ts` - RSS 解析

### API 路由
- `app/api/sources/discover/route.ts` - 发现 API
- `app/api/sources/save/route.ts` - 保存 API

### 前端组件
- `components/admin/IntelligentDiscoveryModal.tsx` - 发现模态框
- `app/admin/sources/page.tsx` - 管理界面

### 类型定义
- `types/sources.ts` - TypeScript 类型

### 测试脚本
- `scripts/test-discover-api.ts`
- `scripts/test-discover-api-arstechnica.ts`
- `scripts/test-intelligent-discovery-flow.ts`

### 数据库
- `prisma/schema.prisma` - 数据库模型
- `prisma/migrations/` - 迁移文件

## 总结

智能 RSS 发现功能显著提升了源管理效率:
- ✅ 自动发现所有可用 RSS 源
- ✅ AI 智能分析和推荐最佳源
- ✅ 避免收集低质量或无关内容
- ✅ 支持同一网站多个专门板块
- ✅ 完整的前端交互界面
- ✅ 48 小时 + 50 篇的采集限制

这使得内容采集更加精准和高效,确保只收集真正有价值的科技/AI 资讯。
