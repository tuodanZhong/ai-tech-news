# 设计系统快速参考指南

## 配色速查表

### 主要颜色
```css
/* 蓝色系（主色） */
--primary-blue: #2563eb       /* 主要按钮、链接 */
--primary-blue-dark: #1e40af  /* Hover 状态 */
--primary-blue-light: #3b82f6 /* 浅色变体 */

/* 紫色系（辅助色） */
--accent-purple: #7c3aed      /* 特殊功能 */
--accent-purple-dark: #6d28d9 /* Hover 状态 */

/* 功能色 */
--success-green: #10b981      /* 成功提示 */
--warning-amber: #f59e0b      /* 警告提示 */
--error-red: #ef4444          /* 错误提示 */
```

### 渐变组合
```tsx
/* 主标题渐变 */
"bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600"

/* 按钮渐变 - 蓝色 */
"bg-gradient-to-r from-blue-600 to-indigo-600"

/* 按钮渐变 - 绿色 */
"bg-gradient-to-r from-green-500 to-emerald-600"

/* 按钮渐变 - 紫色 */
"bg-gradient-to-r from-purple-600 to-indigo-600"

/* 页面背景 */
"bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
```

---

## 间距系统

```tsx
/* 8px 基础网格 */
gap-2   // 8px
gap-3   // 12px
gap-4   // 16px
gap-5   // 20px
gap-6   // 24px

/* 内边距 */
p-4     // 16px
p-6     // 24px
p-8     // 32px

/* 外边距 */
mb-3    // 12px
mb-4    // 16px
mb-6    // 24px
mb-8    // 32px
```

---

## 圆角系统

```tsx
rounded-lg    // 8px  - 小组件
rounded-xl    // 12px - 按钮、输入框
rounded-2xl   // 16px - 卡片
rounded-full  // 完全圆形 - 徽章、FAB
```

---

## 阴影系统

```tsx
/* 基础阴影 */
shadow-sm   // 细微阴影 - 默认卡片
shadow-md   // 中等阴影 - 徽章
shadow-lg   // 大阴影 - 按钮
shadow-xl   // 超大阴影 - Hover 卡片
shadow-2xl  // 最大阴影 - FAB

/* 彩色阴影 */
shadow-blue-500/30    // 蓝色阴影 30% 透明度
shadow-green-500/40   // 绿色阴影 40% 透明度
shadow-purple-500/40  // 紫色阴影 40% 透明度
```

---

## 按钮样式

### 主要按钮（蓝色）
```tsx
className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600
           text-white rounded-xl hover:from-blue-700 hover:to-indigo-700
           transition-all shadow-lg shadow-blue-500/30
           hover:shadow-xl hover:shadow-blue-500/40 font-semibold"
```

### 成功按钮（绿色）
```tsx
className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600
           text-white rounded-xl hover:from-green-600 hover:to-emerald-700
           transition-all shadow-lg shadow-green-500/30
           hover:shadow-xl hover:shadow-green-500/40 font-semibold"
```

### 次要按钮（白色边框）
```tsx
className="px-6 py-3 bg-white text-gray-700 rounded-xl
           border-2 border-gray-200 hover:bg-gray-50
           hover:border-gray-300 transition-all font-semibold
           shadow-sm hover:shadow"
```

### 筛选按钮（激活态）
```tsx
className="px-5 py-2.5 rounded-xl transition-all font-medium
           bg-gradient-to-r from-blue-600 to-indigo-600
           text-white shadow-lg shadow-blue-500/30"
```

### 筛选按钮（未激活）
```tsx
className="px-5 py-2.5 rounded-xl transition-all font-medium
           bg-gray-50 text-gray-700 hover:bg-gray-100
           border border-gray-200"
```

---

## 卡片样式

### 文章卡片
```tsx
className="group bg-white rounded-2xl shadow-sm hover:shadow-xl
           border border-gray-100 hover:border-blue-200
           transition-all duration-300 overflow-hidden hover-lift"
```

### 筛选器卡片
```tsx
className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
```

---

## 输入框样式

### 搜索框
```tsx
className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200
           rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500
           focus:border-transparent text-gray-900 placeholder-gray-400
           shadow-sm hover:border-gray-300 transition-all"
```

### 页码输入框
```tsx
className="w-16 px-3 py-2 text-center border-2 border-gray-300
           rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
           focus:border-transparent font-bold text-gray-900 bg-white"
```

---

## 徽章样式

### 来源徽章（渐变）
```tsx
className="inline-flex items-center px-3 py-1 rounded-full
           text-xs font-semibold bg-gradient-to-r from-blue-500
           to-indigo-500 text-white shadow-sm"
```

### 分类徽章（灰色）
```tsx
className="inline-flex items-center px-3 py-1 rounded-full
           text-xs font-medium bg-gray-100 text-gray-700"
```

### 状态徽章（警告）
```tsx
className="inline-flex items-center px-2.5 py-1 rounded-full
           text-xs font-medium bg-gradient-to-r from-amber-100
           to-yellow-100 text-amber-800 border border-amber-200"
```

---

## 消息提示样式

### 成功消息
```tsx
className="p-4 rounded-xl font-medium animate-fade-in
           bg-gradient-to-r from-green-50 to-emerald-50
           text-green-800 border border-green-200"
```

### 错误消息
```tsx
className="p-4 rounded-xl font-medium animate-fade-in
           bg-gradient-to-r from-red-50 to-rose-50
           text-red-800 border border-red-200"
```

### 信息消息
```tsx
className="p-4 rounded-xl font-medium animate-fade-in
           bg-gradient-to-r from-purple-50 to-indigo-50
           text-purple-800 border border-purple-200"
```

---

## 字体样式

### 主标题
```tsx
className="text-4xl font-bold bg-gradient-to-r from-blue-600
           via-purple-600 to-indigo-600 bg-clip-text text-transparent"
```

### 文章标题
```tsx
className="text-2xl font-bold text-gray-900 mb-3
           group-hover:text-blue-600 transition-colors leading-tight"
```

### 正文
```tsx
className="text-gray-600 line-clamp-3 mb-4 leading-relaxed"
```

### 小字
```tsx
className="text-sm text-gray-500"
```

---

## 动画类

### 淡入动画
```tsx
className="animate-fade-in"
```

### 滑入动画
```tsx
className="animate-slide-in"
```

### 旋转加载
```tsx
className="animate-spin rounded-full border-4 border-solid
           border-blue-600 border-r-transparent"
```

### Hover 提升效果
```tsx
className="hover-lift"
```

---

## 图标尺寸

```tsx
/* 小图标 */
className="w-4 h-4"

/* 中等图标 */
className="w-5 h-5"

/* 大图标 */
className="w-6 h-6"

/* 超大图标（空状态） */
className="w-16 h-16"
```

---

## 响应式断点

```tsx
/* 移动端默认 */
className="px-4"

/* 小屏幕（≥640px） */
className="sm:px-6"

/* 中等屏幕（≥768px） */
className="md:px-8"

/* 大屏幕（≥1024px） */
className="lg:px-8"
```

---

## 常用组合

### 加载器
```tsx
<div className="text-center py-20">
  <div className="inline-block h-12 w-12 animate-spin rounded-full
       border-4 border-solid border-blue-600 border-r-transparent"></div>
  <p className="mt-6 text-gray-600 font-medium text-lg">加载中...</p>
</div>
```

### 空状态
```tsx
<div className="text-center py-20 bg-white rounded-2xl shadow-sm
     border border-gray-100">
  <svg className="mx-auto h-16 w-16 text-gray-400" />
  <p className="mt-4 text-gray-600 font-medium text-lg">暂无数据</p>
  <p className="mt-2 text-sm text-gray-500">提示信息</p>
</div>
```

### 浮动操作按钮
```tsx
<button className="group fixed bottom-8 right-8 px-7 py-4
       bg-gradient-to-r from-purple-600 to-indigo-600 text-white
       rounded-full shadow-2xl shadow-purple-500/40
       hover:shadow-purple-500/60 hover:from-purple-700
       hover:to-indigo-700 transition-all font-semibold
       hover:scale-105">
  {/* 内容 */}
</button>
```

---

## 设计原则

1. **一致性**：使用统一的设计语言
2. **层次性**：通过字体、颜色、间距创造视觉层次
3. **反馈性**：所有交互都有明确的视觉反馈
4. **流畅性**：使用平滑的过渡和动画
5. **可读性**：确保文本有足够的对比度和间距

---

## 实施建议

- 复制粘贴上述类名，避免手动输入错误
- 保持渐变方向一致（通常是 `to-r` 或 `to-br`）
- 始终配对使用阴影和 hover 效果
- 移动端优先，然后添加响应式类
- 使用语义化的 HTML 标签
