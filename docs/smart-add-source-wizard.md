# 智能添加信息源向导

## 🎯 设计目标

**用户只需要傻瓜式操作，系统自动选择最佳采集方式**

### 之前的问题
- ❌ 用户需要理解 RSS vs 网页爬虫的区别
- ❌ 需要手动判断网站是否有 RSS
- ❌ 不知道该用哪种采集方式
- ❌ 有 RSS 的网站可能有多个源，不知道选哪个
- ❌ "添加信息源"和"智能发现"两个入口，概念混乱

### 现在的方案
- ✅ 只有一个"➕ 添加信息源"按钮
- ✅ 输入任何 URL，系统自动判断类型
- ✅ 自动选择最佳采集方式
- ✅ 有多个 RSS 源时，AI 智能推荐最佳的
- ✅ 找不到 RSS 自动降级到网页爬虫
- ✅ 全程引导式操作，零配置

---

## 🔄 工作流程

```
用户点击"添加信息源"
         ↓
    输入 URL
         ↓
    智能检测 URL 类型
         ↓
    ┌─────────────┬─────────────┬─────────────┐
    ↓             ↓             ↓             ↓
 RSS URL      网站(有RSS)   网站(无RSS)    错误URL
    ↓             ↓             ↓             ↓
 快速识别      智能发现      网页爬虫      提示重试
    ↓             ↓             ↓
 手动填写     推荐+多选     手动填写
    ↓             ↓             ↓
    └─────────────┴─────────────┘
                  ↓
              保存到数据库
                  ↓
              刷新列表
```

---

## 📋 三种处理场景

### 场景 1: 直接输入 RSS URL

**示例**: `https://techcrunch.com/feed`

**识别特征**:
- URL 包含 `/feed`、`/rss`、`/atom`
- 或以 `.xml` 结尾

**处理流程**:
1. ⚡ 快速识别（不调用 AI，节省时间）
2. 显示蓝色提示："检测到 RSS 地址"
3. 要求用户填写名称和分类
4. 保存为 RSS 类型

**优点**:
- 速度快（几秒）
- 不消耗 AI 配额
- 适合已知 RSS URL 的情况

---

### 场景 2: 输入网站首页（有 RSS 源）

**示例**: `https://arstechnica.com`

**识别特征**:
- 不匹配 RSS URL 特征
- 是一个网站首页地址

**处理流程**:
1. 🔍 执行智能发现（调用 `/api/sources/discover`）
2. 发现所有 RSS 源（如 6 个）
3. AI 分析每个源的内容质量
4. 推荐最优的源（如 3 个专门板块）
5. 忽略次优的源（如 1 个全站 RSS）
6. 展示推荐列表，默认全选
7. 用户可以取消某些选择
8. 批量保存选中的源

**优点**:
- 自动发现所有可能的源
- AI 智能推荐最佳源
- "有好的就不要差的"原则
- 支持同一网站多个板块
- 一次保存多个源

**时间**:
- 10-30 秒（取决于网站响应速度和 AI 分析）

---

### 场景 3: 输入网站首页（无 RSS 源）

**示例**: `https://some-site-without-rss.com`

**识别特征**:
- 智能发现未找到任何 RSS 源
- 或 RSS 源质量太低被 AI 忽略

**处理流程**:
1. 🔍 执行智能发现
2. 未发现推荐的 RSS 源
3. 显示黄色提示："未发现 RSS 源，将使用网页爬虫采集"
4. 要求用户填写名称和分类
5. 保存为 Web 类型
6. 提示用户后续需要测试采集效果

**优点**:
- 自动降级到备用方案
- 不会因为没有 RSS 就无法添加
- 提示用户需要测试

**注意**:
- 网页爬虫采集效果可能不如 RSS
- 需要在保存后立即测试
- 可能需要配置采集规则

---

## 🎨 UI/UX 设计

### 步骤指示器

向导标题会根据当前步骤变化：

1. **input**: ➕ 智能添加信息源
2. **detecting**: 🔍 智能检测中...
3. **rss-selection**: 📡 选择 RSS 源
4. **web-config**:
   - RSS URL: 📝 填写信息
   - 无 RSS: 🌐 配置网页采集
5. **complete**: ✅ 添加成功

### 颜色编码

- 🔵 蓝色: RSS URL 检测到
- 🟢 绿色: 发现优质 RSS 源
- 🟡 黄色: 无 RSS，使用网页爬虫
- 🔴 红色: 错误提示

### 用户操作

- **返回按钮**: 任何步骤都可以返回重新输入
- **自动选择**: 推荐的源默认全选
- **手动调整**: 可以取消不需要的源
- **自动关闭**: 成功后 2 秒自动关闭并刷新

---

## 💻 技术实现

### 核心组件

**文件**: `components/admin/SmartAddSourceWizard.tsx`

**主要状态**:
```typescript
type WizardStep = 'input' | 'detecting' | 'rss-selection' | 'web-config' | 'complete'

interface DetectionResult {
  type: 'rss-feed' | 'website-with-rss' | 'website-no-rss'
  rssUrl?: string
  discoveryResult?: RSSDiscoveryResult
  websiteUrl?: string
}
```

### 智能检测逻辑

```typescript
async function handleSmartDetect() {
  // 步骤 1: URL 模式快速识别
  const isRSSUrl = url.includes('/feed') || url.includes('/rss') || ...

  if (isRSSUrl) {
    // 场景 1: 直接 RSS URL
    setDetectionResult({ type: 'rss-feed', rssUrl: url })
    setStep('web-config')
    return
  }

  // 步骤 2: 执行智能发现
  const response = await fetch('/api/sources/discover', {
    method: 'POST',
    body: JSON.stringify({ url })
  })

  const data = await response.json()

  // 步骤 3: 分析发现结果
  if (data.data.recommended.length > 0) {
    // 场景 2: 发现了 RSS 源
    setDetectionResult({
      type: 'website-with-rss',
      discoveryResult: data.data
    })
    setStep('rss-selection')
  } else {
    // 场景 3: 没有 RSS 源
    setDetectionResult({
      type: 'website-no-rss',
      websiteUrl: url
    })
    setStep('web-config')
  }
}
```

### API 调用

**智能发现**: `POST /api/sources/discover`
- 发现所有 RSS 源
- AI 分析和推荐
- 返回推荐和忽略的源

**批量保存**: `POST /api/sources/save`
- 保存多个 RSS 源
- 处理重复源
- 返回成功和失败的源

**单个保存**: `POST /api/admin/sources`
- 保存单个源（RSS 或 Web）
- 用于直接 RSS URL 和网页爬虫

---

## 📊 数据流

### 输入
```json
{
  "url": "https://example.com"
}
```

### 智能检测输出
```typescript
// 场景 1: RSS URL
{
  "type": "rss-feed",
  "rssUrl": "https://example.com/feed"
}

// 场景 2: 有 RSS 的网站
{
  "type": "website-with-rss",
  "discoveryResult": {
    "websiteName": "Example",
    "recommended": [
      {
        "name": "AI Section",
        "url": "https://example.com/ai/feed",
        "feedType": "specific",
        "techRelevance": 100,
        "aiRelevance": 95,
        ...
      }
    ]
  }
}

// 场景 3: 无 RSS 的网站
{
  "type": "website-no-rss",
  "websiteUrl": "https://example.com"
}
```

### 保存输出
```json
{
  "success": true,
  "data": {
    "saved": 2,
    "total": 3,
    "sources": [...],
    "errors": [
      {
        "feed": "https://...",
        "error": "RSS source already exists"
      }
    ]
  }
}
```

---

## 🧪 测试

### 手动测试清单

1. ✅ 输入网站首页（Ars Technica）→ 发现多个推荐源
2. ✅ 输入 RSS URL (TechCrunch/feed) → 快速识别并添加
3. ✅ 输入无 RSS 网站 → 降级到网页爬虫
4. ✅ 选择部分推荐源保存 → 正确保存选中的
5. ✅ 保存已存在的源 → 提示已存在但不中断
6. ✅ 点击返回按钮 → 正确返回并重置
7. ✅ 成功后自动关闭 → 2 秒后关闭并刷新

### 测试文档

详细测试场景见: `scripts/test-smart-add-wizard.md`

---

## 🎁 用户收益

### 降低使用门槛
- **之前**: 需要理解 RSS、网页爬虫、采集配置等概念
- **现在**: 只需要输入 URL，其他都是自动的

### 提高采集质量
- **之前**: 可能添加了全站 RSS，包含很多无关内容
- **现在**: AI 自动推荐专门板块，内容更精准

### 节省时间
- **之前**: 手动查找 RSS URL、逐个测试、手动添加
- **现在**: 一次输入，批量添加，全自动

### 避免错误
- **之前**: 可能添加错误的 RSS URL、重复添加、遗漏优质源
- **现在**: 系统自动验证、去重、推荐最优

---

## 🔧 配置和扩展

### 添加新的 URL 模式

在 `SmartAddSourceWizard.tsx` 中修改：

```typescript
const isRSSUrl =
  url.includes('/feed') ||
  url.includes('/rss') ||
  url.includes('/atom') ||
  url.endsWith('.xml') ||
  // 添加新模式
  url.includes('/your-pattern/')
```

### 自定义检测逻辑

可以在智能检测函数中添加更复杂的逻辑：

```typescript
// 检查特定网站
if (url.includes('specific-site.com')) {
  // 特殊处理
}

// 检查 URL 参数
const urlObj = new URL(url)
if (urlObj.searchParams.has('feed')) {
  // 参数中有 feed
}
```

---

## 📈 未来改进

### 1. 批量输入
支持一次输入多个 URL，批量处理：
```
https://site1.com
https://site2.com/feed
https://site3.com
```

### 2. 导入功能
支持从 OPML 文件导入 RSS 源（RSS 阅读器标准格式）

### 3. 推荐源库
维护一个优质科技/AI 源的推荐库，用户可以直接选择

### 4. 定时重新发现
对已保存的网站，定期重新发现是否有新的优质板块

### 5. 更详细的进度
显示具体的检测步骤：
- ⏳ 正在连接网站...
- 🔍 正在查找 RSS 链接...
- 🤖 AI 正在分析内容...
- ✅ 分析完成!

---

## 🏗️ 架构优势

### 模块化设计
- 向导组件独立，易于测试和维护
- 可以单独优化 UI 而不影响后端逻辑

### 渐进增强
- 基本功能：手动添加（总是可用）
- 增强功能：智能发现（可能失败但不影响基本功能）
- 优雅降级：找不到 RSS 就用网页爬虫

### 可扩展性
- 易于添加新的检测规则
- 易于添加新的采集方式
- 易于添加新的智能分析功能

---

## 📝 总结

智能添加向导成功实现了"傻瓜式操作"的目标：

✅ **统一入口**: 从 2 个按钮简化为 1 个按钮
✅ **自动检测**: 智能判断 URL 类型
✅ **智能推荐**: AI 选择最佳采集方式
✅ **零配置**: 大部分情况无需手动配置
✅ **容错性强**: 找不到 RSS 自动降级
✅ **引导式**: 每一步都有清晰的说明
✅ **可返回**: 可以随时修改
✅ **批量操作**: 一次保存多个源

用户体验从"需要专业知识"变成"输入 URL 即可"，大大降低了使用门槛，同时保证了采集质量。
