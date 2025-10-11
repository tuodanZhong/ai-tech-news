# 测试按钮完整运转逻辑和数据库操作分析

## 📋 目录
1. [前端流程](#前端流程)
2. [后端 API 流程](#后端-api-流程)
3. [数据库操作](#数据库操作)
4. [智能测试策略](#智能测试策略)
5. [测试结果展示](#测试结果展示)
6. [完整流程图](#完整流程图)

---

## 🎯 前端流程

### 用户操作
```
用户在源列表中点击"测试"按钮
    ↓
触发 testSource(sourceId, sourceName) 函数
```

### 前端代码逻辑

**文件**: `app/admin/sources/page.tsx:85-111`

```typescript
const testSource = async (sourceId: string, sourceName: string) => {
  // 1. 设置 UI 状态：显示"测试中..."
  setTestingSourceId(sourceId)

  try {
    // 2. 调用后端测试 API
    const response = await fetch(`/api/admin/sources/${sourceId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await response.json()

    if (data.success) {
      // 3. 测试成功：显示测试结果弹窗
      setTestResultModal({
        show: true,
        sourceName: sourceName,
        sourceId: sourceId,
        result: data.testResult
      })

      // 4. 刷新源列表（因为数据库已更新）
      loadSources()
    } else {
      // 5. 测试失败：显示错误提示
      alert('测试失败: ' + (data.error || '未知错误'))
    }
  } catch (error) {
    console.error('测试失败:', error)
    alert('测试失败')
  } finally {
    // 6. 清除"测试中..."状态
    setTestingSourceId(null)
  }
}
```

### 前端状态变化

| 阶段 | testingSourceId | testResultModal.show | 源列表 |
|------|-----------------|---------------------|--------|
| 点击前 | null | false | 显示当前状态 |
| 测试中 | sourceId | false | 按钮显示"测试中..." |
| 成功后 | null | true | 更新为最新状态 |
| 失败后 | null | false | 保持原状态 |

---

## 🔧 后端 API 流程

### API 路由
**文件**: `app/api/admin/sources/[id]/test/route.ts`

### 智能测试策略

后端会根据源的 `type` 字段采用不同的测试策略：

#### 策略 1: type = 'rss'
```
1. 尝试 RSS 采集
   ├─ 如果 URL 不像 RSS (/feed, .xml, .rss)
   │  └─ 自动发现网页中的 RSS 链接
   ├─ 解析 RSS feed
   │  ├─ 成功 → 保存结果
   │  └─ 失败 → 降级到网页爬虫
   └─ 网页爬虫
      ├─ 成功 → 自动切换类型为 'web'
      └─ 失败 → 测试失败
```

#### 策略 2: type = 'web'
```
1. 优先尝试 RSS（因为 RSS 更稳定）
   ├─ 检测网页中的 RSS 链接
   │  ├─ 发现 RSS → 尝试解析
   │  │  ├─ 成功 → 自动切换类型为 'rss'
   │  │  └─ 失败 → 使用网页爬虫
   │  └─ 未发现 RSS → 使用网页爬虫
   └─ 网页爬虫
      ├─ 成功 → 保存结果
      └─ 失败 → 测试失败
```

#### 策略 3: type = 其他/未知
```
1. 完整自动检测
   ├─ 检测网页中的 RSS 链接
   │  ├─ 发现 RSS → 尝试解析
   │  │  ├─ 成功 → 类型设为 'rss'
   │  │  └─ 失败 → 尝试网页爬虫
   │  │     ├─ 成功 → 类型设为 'web'
   │  │     └─ 失败 → 测试失败
   │  └─ 未发现 RSS → 尝试网页爬虫
   │     ├─ 成功 → 类型设为 'web'
   │     └─ 失败 → 测试失败
```

### 测试日志记录

整个测试过程会记录详细的尝试日志：

```typescript
let attemptLog: string[] = []

// 测试过程中不断添加日志
attemptLog.push('尝试 RSS 采集...')
attemptLog.push('✓ 发现 RSS: https://example.com/feed')
attemptLog.push('✓ RSS 采集成功')
```

---

## 💾 数据库操作

### 读取操作

#### 1. 获取源信息
```typescript
const source = await prisma.rSSSource.findUnique({
  where: { id }
})
```

**查询字段**:
- `id`: 源 ID
- `url`: 源 URL
- `type`: 源类型 (rss/web)
- `scrapeConfig`: 爬虫配置 (JSON)

#### 2. 检查 URL 重复
```typescript
const existingSource = await prisma.rSSSource.findFirst({
  where: {
    url: finalCollectionUrl,
    id: { not: id }
  }
})
```

**目的**: 防止自动发现的 RSS URL 与其他源重复

### 写入操作

#### 测试成功后更新源
```typescript
const updatedSource = await prisma.rSSSource.update({
  where: { id },
  data: {
    url: finalCollectionUrl,        // 更新为真正的采集 URL
    type: finalType,                 // 更新为最终成功的类型
    isTested: true,                  // 标记为已测试
    testStatus: 'success',           // 测试状态：成功
    testResult: JSON.stringify({     // 测试结果（JSON）
      ...testResult,
      attemptLog,                    // 尝试日志
      detectedType: finalType,       // 检测到的类型
      originalType: source.type,     // 原始类型
      collectionUrl: finalCollectionUrl
    }),
    lastTested: new Date()           // 最后测试时间
  }
})
```

### 数据库字段变化

**测试前**:
```json
{
  "id": "abc123",
  "name": "TechCrunch",
  "url": "https://techcrunch.com",     // 用户输入的 URL
  "type": "rss",                        // 用户指定或默认
  "isTested": false,                    // 未测试
  "testStatus": null,                   // 无状态
  "testResult": null,                   // 无结果
  "lastTested": null                    // 从未测试
}
```

**测试后（RSS 成功）**:
```json
{
  "id": "abc123",
  "name": "TechCrunch",
  "url": "https://techcrunch.com/feed", // ✅ 更新为发现的 RSS URL
  "type": "rss",                        // ✅ 确认为 RSS
  "isTested": true,                     // ✅ 已测试
  "testStatus": "success",              // ✅ 成功
  "testResult": "{...}",                // ✅ 包含文章列表和日志
  "lastTested": "2024-01-15T10:30:00Z"  // ✅ 测试时间
}
```

**测试后（自动降级到 Web）**:
```json
{
  "id": "abc123",
  "name": "Some Site",
  "url": "https://somesite.com",        // 保持原 URL
  "type": "web",                        // ✅ 自动切换为 web
  "isTested": true,                     // ✅ 已测试
  "testStatus": "success",              // ✅ 成功
  "testResult": "{...}",                // ✅ 包含采集文章和策略
  "lastTested": "2024-01-15T10:30:00Z"  // ✅ 测试时间
}
```

---

## 🤖 智能测试策略

### RSS 测试函数

**文件**: `lib/sources/testers.ts` (推测)

```typescript
testRSSFeed(url: string) => {
  success: boolean
  count: number          // 采集到的文章数
  articles: Article[]    // 文章列表
  error?: string         // 错误信息
}
```

**测试内容**:
1. 解析 RSS XML
2. 提取文章列表
3. 应用时间窗口限制 (48小时)
4. 应用数量限制 (最多50篇)
5. 提取字段: title, link, description, pubDate, imageUrl

### Web 爬虫测试函数

```typescript
testWebScrape(url: string, config?: WebScrapeConfig) => {
  success: boolean
  count: number
  articles: Article[]
  extractStrategy: string  // 使用的提取策略
  error?: string
}
```

**提取策略**:
1. `heading-link`: 从 `<h1-h3>` 标签中提取链接
2. `generic-link`: 从所有 `<a>` 标签中提取
3. `article-container`: 从带有 post/article 类名的容器中提取

**过滤规则** (scrapeConfig):
```typescript
interface WebScrapeConfig {
  excludePatterns?: string[]  // 排除 URL 模式
  includePatterns?: string[]  // 只包含 URL 模式
}
```

---

## 📊 测试结果展示

### 成功结果

**testResult 数据结构**:
```typescript
{
  success: true,
  count: 15,              // 采集到 15 篇文章
  articles: [
    {
      title: "文章标题",
      link: "https://...",
      description: "摘要",
      pubDate: "2024-01-15T...",
      imageUrl: "https://...",
      extractStrategy: "heading-link" // 仅 Web 类型有此字段
    },
    // ... 更多文章
  ],
  attemptLog: [           // 测试日志
    "尝试 RSS 采集...",
    "检测网页中的 RSS 链接...",
    "✓ 发现 RSS: https://...",
    "✓ RSS 采集成功"
  ],
  detectedType: "rss",    // 最终检测到的类型
  originalType: "rss",    // 原始类型
  collectionUrl: "https://..."  // 最终采集 URL
}
```

### 前端展示内容

1. **成功状态卡片**
   - ✅ 绿色背景
   - 显示采集文章数量
   - 显示测试日志

2. **提取策略提示** (仅 Web 类型)
   - 🔍 紫色背景
   - 说明使用的提取策略
   - 如果数量少 (<5)，提示可能需要配置规则

3. **文章列表**
   - 显示前 10 篇
   - 每篇显示: 序号、标题、摘要、链接、日期、图片
   - 超过 10 篇显示"还有 X 篇未显示"

4. **警告提示** (Web 类型 + 数量 <3)
   - ⚠️ 黄色背景
   - 列出可能的原因
   - 建议配置采集规则

---

## 🔄 完整流程图

```
用户点击"测试"
    ↓
[前端] testSource()
    ├─ setTestingSourceId(sourceId)  → UI显示"测试中..."
    └─ POST /api/admin/sources/{id}/test
        ↓
    [后端] API Handler
        ├─ [读] prisma.findUnique({id})  → 获取源信息
        ├─ 解析 scrapeConfig (如果有)
        ├─ 执行智能测试策略
        │   ├─ type='rss'
        │   │   ├─ findRSSInPage() → 发现 RSS 链接
        │   │   ├─ testRSSFeed()
        │   │   │   ├─ 成功 → finalType='rss', finalUrl=rssUrl
        │   │   │   └─ 失败 → testWebScrape()
        │   │   │       ├─ 成功 → finalType='web', finalUrl=原URL
        │   │   │       └─ 失败 → 返回错误
        │   │
        │   ├─ type='web'
        │   │   ├─ findRSSInPage() → 优先尝试 RSS
        │   │   │   ├─ 发现 → testRSSFeed()
        │   │   │   │   ├─ 成功 → finalType='rss'
        │   │   │   │   └─ 失败 → testWebScrape()
        │   │   │   └─ 未发现 → testWebScrape()
        │   │   └─ testWebScrape() (应用 scrapeConfig)
        │   │       ├─ 成功 → finalType='web'
        │   │       └─ 失败 → 返回错误
        │   │
        │   └─ type=其他
        │       └─ 完整自动检测流程
        │
        ├─ [读] prisma.findFirst() → 检查 URL 是否重复
        │   └─ 如果重复 → 返回 409 冲突
        │
        ├─ [写] prisma.update()
        │   └─ 更新字段:
        │       ├─ url: finalCollectionUrl
        │       ├─ type: finalType
        │       ├─ isTested: true
        │       ├─ testStatus: 'success'
        │       ├─ testResult: JSON 结果
        │       └─ lastTested: 当前时间
        │
        └─ 返回 {success: true, source, testResult}
            ↓
    [前端] 接收响应
        ├─ 如果成功
        │   ├─ setTestResultModal() → 显示测试结果弹窗
        │   └─ loadSources() → 刷新源列表
        │
        └─ 如果失败
            └─ alert(错误信息)
            ↓
    setTestingSourceId(null)  → UI恢复正常
```

---

## 📝 关键要点总结

### 1. 智能自适应
- ✅ 自动检测 RSS，优先使用 RSS
- ✅ RSS 失败自动降级到网页爬虫
- ✅ 自动更新源类型和 URL

### 2. 防重复机制
- ✅ 检查发现的 RSS URL 是否已存在
- ✅ 避免同一个 RSS 被添加多次

### 3. 详细日志
- ✅ 记录每一步尝试
- ✅ 成功/失败都有清晰的日志
- ✅ 前端展示日志供用户查看

### 4. 数据持久化
- ✅ 测试结果保存到数据库
- ✅ 包含完整的文章列表
- ✅ 记录测试时间和状态

### 5. 用户体验
- ✅ 实时反馈测试进度
- ✅ 弹窗展示详细结果
- ✅ 失败时给出建议
- ✅ 支持配置采集规则后重新测试

---

## 🎯 数据库 Schema 相关字段

```prisma
model RSSSource {
  id           String    @id @default(cuid())
  url          String    @unique           // ✅ 测试后可能更新为 RSS URL
  type         SourceType @default("rss")  // ✅ 测试后可能自动切换
  isTested     Boolean   @default(false)   // ✅ 测试后设为 true
  testStatus   TestStatus?                 // ✅ success/failed
  testResult   String?   @db.Text          // ✅ JSON 格式的测试结果
  lastTested   DateTime?                   // ✅ 最后测试时间
  scrapeConfig String?   @db.Text          // 🔧 Web 爬虫配置

  // 其他字段...
}

enum SourceType {
  rss
  web
}

enum TestStatus {
  success
  failed
}
```

---

## 🔍 扩展阅读

相关文件:
- 前端逻辑: `app/admin/sources/page.tsx`
- 后端 API: `app/api/admin/sources/[id]/test/route.ts`
- RSS 测试: `lib/sources/testers.ts`
- RSS 发现: `lib/sources/detector.ts`
- 类型定义: `lib/sources/types.ts`
