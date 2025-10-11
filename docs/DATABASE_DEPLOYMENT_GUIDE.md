# 数据库部署和同步指南

## 📋 最新数据库变更 (截至 2025-10-11)

### 新增表：PromptConfig
用于管理 DeepSeek AI 提示词配置的数据表。

```sql
CREATE TABLE "PromptConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "useJsonMode" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "PromptConfig_key_idx" ON "PromptConfig"("key");
CREATE INDEX "PromptConfig_isActive_idx" ON "PromptConfig"("isActive");
```

---

## 🚀 服务器部署步骤

### 方案 1: 使用 Prisma DB Push (推荐 - 快速且安全)

这种方法会自动对比本地 schema 和线上数据库，只应用差异部分，**不会删除现有数据**。

```bash
# 1. 连接到服务器
ssh your-server

# 2. 进入项目目录
cd /path/to/tech-news

# 3. 拉取最新代码
git pull origin main

# 4. 安装依赖（如果有新的）
npm install

# 5. 同步数据库 schema (不会删除数据)
npx prisma db push

# 6. 初始化提示词配置
npx tsx scripts/init-prompts.ts

# 7. 重新生成 Prisma Client
npx prisma generate

# 8. 重启应用
pm2 restart tech-news
# 或者
systemctl restart tech-news
```

---

### 方案 2: 手动执行 SQL (更精确的控制)

如果你想更精确地控制，可以手动执行 SQL：

```bash
# 1. 连接到数据库
psql "$DATABASE_URL"

# 2. 执行以下 SQL
```

```sql
-- 创建 PromptConfig 表
CREATE TABLE IF NOT EXISTS "PromptConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "useJsonMode" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "PromptConfig_key_idx" ON "PromptConfig"("key");
CREATE INDEX IF NOT EXISTS "PromptConfig_isActive_idx" ON "PromptConfig"("isActive");

-- 验证表是否创建成功
\d "PromptConfig"
```

```bash
# 3. 退出数据库
\q

# 4. 初始化提示词数据
npx tsx scripts/init-prompts.ts

# 5. 重新生成 Prisma Client
npx prisma generate

# 6. 重启应用
pm2 restart tech-news
```

---

## 🔍 部署前检查清单

### 1. 备份现有数据库 (⚠️ 非常重要!)

```bash
# 方式 1: 使用 pg_dump (PostgreSQL)
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# 方式 2: 使用 Vercel Postgres 的备份功能
# 在 Vercel 控制台手动创建快照
```

### 2. 验证本地 Schema

```bash
# 检查 schema 文件是否正确
npx prisma validate

# 预览将要执行的变更（不会实际执行）
npx prisma db push --preview-feature
```

### 3. 检查环境变量

确保服务器上的 `.env` 文件包含正确的数据库连接信息：

```bash
# 检查环境变量
cat .env | grep DATABASE_URL
```

---

## ⚠️ 常见问题和解决方案

### Q1: `prisma db push` 报错 "Database schema is not empty"

**原因：** Prisma 检测到数据库已有数据，担心覆盖。

**解决：**
```bash
# 添加 --accept-data-loss 标志（仅新增表，不会删除现有数据）
npx prisma db push --accept-data-loss
```

### Q2: "Column already exists" 错误

**原因：** 某些列已经存在（可能是之前手动添加的）。

**解决：**
```sql
-- 先检查表结构
\d "PromptConfig"

-- 如果表已存在但结构不对，删除后重建
DROP TABLE IF EXISTS "PromptConfig";
```

### Q3: Prisma Client 版本不匹配

**原因：** 本地和服务器的 Prisma 版本不一致。

**解决：**
```bash
# 重新安装 Prisma
npm install prisma@latest @prisma/client@latest

# 重新生成 Client
npx prisma generate
```

### Q4: 初始化提示词失败

**原因：** `PromptConfig` 表不存在或没有权限。

**解决：**
```bash
# 1. 确认表已创建
psql "$DATABASE_URL" -c "SELECT * FROM \"PromptConfig\" LIMIT 1;"

# 2. 手动运行初始化脚本
npx tsx scripts/init-prompts.ts

# 3. 查看日志确认是否成功
```

---

## 🔄 数据库迁移最佳实践

### 建议：启用 Prisma Migrate (未来部署)

为了更好地管理数据库变更，建议在开发环境启用 Prisma Migrate：

```bash
# 开发环境初始化 migrate
npx prisma migrate dev --name init

# 生产环境应用 migrate
npx prisma migrate deploy
```

这样会在 `prisma/migrations/` 目录生成 SQL 文件，便于版本控制和回滚。

---

## 📊 部署后验证

### 1. 验证表结构

```bash
# 连接数据库
psql "$DATABASE_URL"

# 查看所有表
\dt

# 查看 PromptConfig 表结构
\d "PromptConfig"

# 查看提示词数据
SELECT key, name, version, "isActive" FROM "PromptConfig";
```

### 2. 验证应用功能

```bash
# 测试采集功能
curl http://your-server/api/cron-job

# 查看日志
pm2 logs tech-news
```

### 3. 验证提示词加载

```bash
# 运行测试脚本
npx tsx -e "
import { loadPrompt } from './lib/prompt-loader'

async function test() {
  const prompt = await loadPrompt('content_filter')
  console.log('✅ 提示词加载成功:', prompt?.name)
}
test()
"
```

---

## 🚨 回滚方案

如果部署出现问题，立即回滚：

```bash
# 1. 恢复代码
git reset --hard HEAD~2  # 回退到更新前的版本

# 2. 恢复数据库
psql "$DATABASE_URL" < backup_YYYYMMDD_HHMMSS.sql

# 3. 重新生成 Client
npx prisma generate

# 4. 重启应用
pm2 restart tech-news
```

---

## 📝 部署清单

- [ ] 1. 备份现有数据库
- [ ] 2. 拉取最新代码 (`git pull`)
- [ ] 3. 安装新依赖 (`npm install`)
- [ ] 4. 同步数据库 (`npx prisma db push`)
- [ ] 5. 初始化提示词 (`npx tsx scripts/init-prompts.ts`)
- [ ] 6. 重新生成 Client (`npx prisma generate`)
- [ ] 7. 重启应用 (`pm2 restart`)
- [ ] 8. 验证功能正常
- [ ] 9. 检查日志无报错

---

## 💡 快速部署脚本

创建一个自动化部署脚本 `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 开始部署..."

# 1. 备份数据库
echo "📦 备份数据库..."
pg_dump "$DATABASE_URL" > "backup_$(date +%Y%m%d_%H%M%S).sql"

# 2. 拉取代码
echo "📥 拉取最新代码..."
git pull origin main

# 3. 安装依赖
echo "📦 安装依赖..."
npm install

# 4. 同步数据库
echo "🗄️  同步数据库 schema..."
npx prisma db push --accept-data-loss

# 5. 初始化提示词
echo "⚙️  初始化提示词配置..."
npx tsx scripts/init-prompts.ts

# 6. 生成 Client
echo "🔧 生成 Prisma Client..."
npx prisma generate

# 7. 构建项目
echo "🏗️  构建项目..."
npm run build

# 8. 重启应用
echo "♻️  重启应用..."
pm2 restart tech-news

echo "✅ 部署完成！"
echo "📊 查看日志: pm2 logs tech-news"
```

使用方式：
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📞 需要帮助？

如果部署过程中遇到问题，请检查：
1. 服务器日志: `pm2 logs tech-news`
2. 数据库连接: `psql "$DATABASE_URL" -c "SELECT 1"`
3. Prisma 状态: `npx prisma db pull` 查看实际数据库结构

祝部署顺利！🎉
