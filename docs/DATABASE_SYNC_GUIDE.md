# 数据库同步指南

## 📋 概述

本指南帮助你在服务器上同步数据库 schema 和数据。

---

## 🗄️ 当前数据库结构

### 表结构（4张表）

1. **Article** - 文章表
   - 存储采集的科技新闻文章
   - 包含翻译字段、热度分数、关键词等

2. **RSSSource** - 信息源表
   - 存储 RSS 和 Web 采集源配置
   - 包含测试状态、激活状态等

3. **HotTopic** - 热点话题表
   - 存储 24h 和 48h 热点话题分析结果
   - 包含讨论数、相关文章等

4. **FilteredArticle** - 已过滤文章表
   - 存储被过滤掉的文章（避免重复处理）
   - 包含过滤原因

---

## 🔍 检查服务器数据库状态

### 步骤 1: 连接服务器

```bash
ssh your-server
cd ~/tech-news
```

### 步骤 2: 检查当前 schema

```bash
# 查看当前数据库的表
npx prisma db pull --print

# 或者连接数据库直接查询
psql $DATABASE_URL -c "\dt"
```

### 步骤 3: 检查 schema 差异

```bash
# 检查本地 schema 与数据库的差异
npx prisma db push --preview-feature
```

---

## 🚀 同步数据库 Schema（三种方式）

### 方式 1: 使用 prisma db push（推荐用于开发/测试）

**特点**：
- ✅ 快速同步 schema 到数据库
- ✅ 不创建迁移文件
- ⚠️ 可能会丢失数据（如果字段类型改变）

```bash
cd ~/tech-news

# 预览将要执行的更改
npx prisma db push --preview-feature

# 确认无误后执行
npx prisma db push

# 生成 Prisma Client
npx prisma generate
```

### 方式 2: 使用迁移文件（推荐用于生产环境）

**特点**：
- ✅ 版本化管理
- ✅ 可回滚
- ✅ 更安全

```bash
cd ~/tech-news

# 如果有迁移文件，执行所有未应用的迁移
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate
```

### 方式 3: 重置数据库（⚠️ 会删除所有数据）

**仅在开发环境使用！**

```bash
cd ~/tech-news

# 重置数据库（删除所有表和数据）
npx prisma migrate reset --force

# 或使用自定义脚本
npm run db:clear
```

---

## 📊 验证数据库同步

### 检查表是否存在

```bash
# 连接数据库
psql $DATABASE_URL

# 查看所有表
\dt

# 应该看到：
# - Article
# - RSSSource
# - HotTopic
# - FilteredArticle
# - _prisma_migrations (如果使用了迁移)

# 查看某个表的结构
\d Article

# 退出
\q
```

### 使用 Prisma Studio 可视化检查

```bash
cd ~/tech-news

# 启动 Prisma Studio（会在 5555 端口）
npx prisma studio

# 然后在浏览器访问: http://your-server:5555
```

---

## 🔄 常见数据库操作场景

### 场景 1: 首次部署到新服务器

```bash
# 1. 克隆代码
git clone <your-repo>
cd tech-news

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
nano .env  # 设置 DATABASE_URL

# 4. 同步数据库结构
npx prisma db push

# 5. 生成 Prisma Client
npx prisma generate

# 6. (可选) 填充测试数据
# npm run seed
```

### 场景 2: 更新服务器代码后同步 Schema

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 检查 schema 是否有变化
git diff HEAD~5 -- prisma/schema.prisma

# 3. 如果有变化，同步到数据库
npx prisma db push

# 4. 重新生成 Client
npx prisma generate

# 5. 重启应用
pm2 restart tech-news
```

### 场景 3: 添加新表或字段

**在开发环境（本地）**：

```bash
# 1. 修改 prisma/schema.prisma
# 2. 创建迁移
npx prisma migrate dev --name add_new_field

# 3. 提交到 Git
git add prisma/
git commit -m "feat: 添加新字段"
git push
```

**在生产环境（服务器）**：

```bash
# 1. 拉取代码
git pull origin main

# 2. 执行迁移
npx prisma migrate deploy

# 3. 生成 Client
npx prisma generate

# 4. 重启应用
pm2 restart tech-news
```

### 场景 4: 清理测试数据

```bash
cd ~/tech-news

# 清理48小时前的数据
npx tsx scripts/clean-48h-data.ts

# 或清理所有数据（保留表结构）
npm run db:clear
```

---

## 🛡️ 数据库备份与恢复

### 备份数据库

```bash
# PostgreSQL 备份
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 或使用环境变量
export DATABASE_URL="your-connection-string"
pg_dump $DATABASE_URL > backup.sql
```

### 恢复数据库

```bash
# PostgreSQL 恢复
psql $DATABASE_URL < backup.sql
```

### 自动化备份脚本

```bash
#!/bin/bash
# 添加到 crontab

BACKUP_DIR="$HOME/tech-news-backups"
mkdir -p $BACKUP_DIR

# 每天凌晨2点备份
pg_dump $DATABASE_URL > "$BACKUP_DIR/backup_$(date +%Y%m%d).sql"

# 删除7天前的备份
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

---

## 🔧 数据库维护命令

### 查看数据库连接

```bash
# 查看环境变量中的数据库 URL
echo $DATABASE_URL

# 或从 .env 文件查看
cat .env | grep DATABASE_URL
```

### 测试数据库连接

```bash
cd ~/tech-news

# 使用 Prisma 测试连接
npx prisma db pull
```

### 查看表统计信息

```bash
# 进入 psql
psql $DATABASE_URL

-- 查看各表数据量
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- 查看文章数量
SELECT COUNT(*) FROM "Article";

-- 查看信息源数量
SELECT COUNT(*) FROM "RSSSource";

-- 查看热点话题数量
SELECT COUNT(*) FROM "HotTopic";
```

---

## ⚠️ 常见问题

### 问题 1: "Table xxx doesn't exist"

**原因**：数据库结构未同步

**解决**：
```bash
npx prisma db push
npx prisma generate
```

### 问题 2: "Migration xxx not applied"

**原因**：有未应用的迁移文件

**解决**：
```bash
npx prisma migrate deploy
```

### 问题 3: Schema 与数据库不一致

**原因**：手动修改了数据库或 schema 文件

**解决**：
```bash
# 从数据库拉取当前结构到 schema
npx prisma db pull

# 或强制推送 schema 到数据库
npx prisma db push --force-reset
```

### 问题 4: 连接失败 "Can't reach database server"

**检查**：
```bash
# 1. 检查 DATABASE_URL 是否正确
cat .env | grep DATABASE_URL

# 2. 检查数据库服务是否运行
systemctl status postgresql  # Ubuntu/Debian
brew services list            # macOS

# 3. 检查防火墙
sudo ufw status
```

---

## 📝 本次更新的数据库操作

### 检查清单

**从版本 fba56a8 到最新版本，数据库 Schema 没有变化。**

但需要确认：

- [ ] 服务器上是否有所有 4 张表？
- [ ] `RSSSource` 表中是否有数据？
- [ ] `FilteredArticle` 表是否存在？

### 验证步骤

在服务器上执行：

```bash
cd ~/tech-news

# 1. 检查表是否都存在
psql $DATABASE_URL -c "\dt"

# 2. 检查信息源数量
psql $DATABASE_URL -c "SELECT COUNT(*) as count FROM \"RSSSource\";"

# 3. 如果表不存在或结构不对，同步
npx prisma db push
npx prisma generate

# 4. 重启应用
pm2 restart tech-news
```

---

## 🎯 快速修复命令

如果服务器数据库有问题，执行：

```bash
cd ~/tech-news && \
npx prisma db push && \
npx prisma generate && \
pm2 restart tech-news
```

---

## 📚 相关文档

- [Prisma 官方文档](https://www.prisma.io/docs/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- 项目部署指南: [deploy-guide.md](../deploy-guide.md)

---

**最后更新**: 2025-10-09
