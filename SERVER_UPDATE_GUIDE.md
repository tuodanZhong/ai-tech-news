# 服务器代码更新指南

## 📋 本次更新内容

### 更新 1: 清理项目垃圾文件 (ffbe0e4)
- ✅ 删除测试文件和重复脚本
- ✅ 整理文档结构到 `docs/` 目录
- ✅ 删除多余的 `pnpm-lock.yaml`

### 更新 2: 修复 RSS 解析器 (f5d6ed4)
- 🐛 修复 XML 特殊字符解析错误
- ✨ 添加 `sanitizeXML()` 函数处理无效字符
- ✅ 解决 RunDown 等源的采集失败问题

---

## 🚀 快速更新（推荐）

### 方法一：使用自动化脚本

```bash
# 1. SSH 登录到服务器
ssh your-server

# 2. 进入项目目录
cd ~/tech-news

# 3. 下载并运行更新脚本
curl -O https://raw.githubusercontent.com/tuodanZhong/ai-tech-news/main/scripts/update-server.sh
chmod +x update-server.sh
./update-server.sh
```

---

## 📝 手动更新步骤（详细版）

如果自动脚本不适用，可以按以下步骤手动操作：

### 步骤 1: 连接服务器
```bash
ssh your-server-user@your-server-ip
# 或使用你的 SSH 配置别名
ssh your-server
```

### 步骤 2: 进入项目目录
```bash
cd ~/tech-news  # 根据你的实际路径调整
```

### 步骤 3: 备份当前版本（可选但推荐）
```bash
# 创建备份分支
git branch backup/before-update-$(date +%Y%m%d-%H%M%S)

# 或者创建完整备份
cp -r ~/tech-news ~/tech-news-backup-$(date +%Y%m%d)
```

### 步骤 4: 拉取最新代码
```bash
# 查看远程更新
git fetch origin
git log HEAD..origin/main --oneline

# 拉取更新
git pull origin main
```

### 步骤 5: 安装/更新依赖
```bash
# 注意：不要使用 --production，因为构建需要 devDependencies
npm install
```

### 步骤 6: 生成 Prisma Client
```bash
npx prisma generate
```

### 步骤 7: 数据库迁移（如果有 schema 变更）
```bash
# 检查是否有新的迁移
ls prisma/migrations/

# 运行迁移（本次更新无需此步骤）
# npx prisma migrate deploy
```

### 步骤 8: 清理构建缓存
```bash
rm -rf .next
```

### 步骤 9: 构建生产版本
```bash
npm run build
```

### 步骤 10: 重启 PM2 应用
```bash
# 查看当前 PM2 应用列表
pm2 list

# 重启应用（替换 tech-news 为你的实际应用名）
pm2 restart tech-news

# 查看应用状态
pm2 status

# 查看日志确认无错误
pm2 logs tech-news --lines 50
```

### 步骤 11: 验证部署
```bash
# 检查应用是否正常运行
pm2 info tech-news

# 测试首页
curl -I http://localhost:8765

# 测试 API
curl http://localhost:8765/api/sources
```

---

## 🔍 常见问题排查

### 问题 1: Git 拉取失败
```bash
# 如果有本地修改冲突
git stash                    # 暂存本地修改
git pull origin main         # 拉取更新
git stash pop                # 恢复本地修改（可选）

# 或者强制覆盖本地修改
git fetch origin
git reset --hard origin/main
```

### 问题 2: 依赖安装失败
```bash
# 清理 npm 缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules
npm install
```

### 问题 3: 构建失败
```bash
# 检查 Node.js 版本（需要 18.17+）
node -v

# 查看详细构建日志
npm run build 2>&1 | tee build.log
```

### 问题 4: PM2 应用无法启动
```bash
# 查看错误日志
pm2 logs tech-news --err --lines 100

# 删除并重新创建 PM2 应用
pm2 delete tech-news
pm2 start npm --name tech-news -- start
pm2 save
```

### 问题 5: 数据库连接失败
```bash
# 检查环境变量
cat .env | grep DATABASE_URL

# 测试数据库连接
npx prisma db pull
```

---

## 📊 PM2 常用命令

```bash
# 查看所有应用
pm2 list

# 查看应用详情
pm2 info tech-news

# 查看实时日志
pm2 logs tech-news

# 查看最近 100 行日志
pm2 logs tech-news --lines 100

# 只查看错误日志
pm2 logs tech-news --err

# 重启应用
pm2 restart tech-news

# 重载应用（零停机）
pm2 reload tech-news

# 停止应用
pm2 stop tech-news

# 删除应用
pm2 delete tech-news

# 保存 PM2 配置
pm2 save

# 查看 PM2 启动列表
pm2 startup

# 监控所有应用
pm2 monit
```

---

## 🎯 验证清单

更新完成后，请验证以下功能：

- [ ] 首页可以访问 (http://your-domain)
- [ ] 文章列表正常显示
- [ ] 热点话题正常显示
- [ ] 信息源管理页面正常 (/admin/sources)
- [ ] RSS 采集功能正常（包括之前失败的 RunDown）
- [ ] 定时任务正常运行
- [ ] 日志中无错误信息

---

## 📞 回滚步骤（如果更新失败）

```bash
# 方法 1: 使用 Git 回滚
cd ~/tech-news
git reset --hard fba56a8  # 回到上一个稳定版本
npm install
npm run build
pm2 restart tech-news

# 方法 2: 恢复备份
cd ~
rm -rf tech-news
mv tech-news-backup-YYYYMMDD tech-news
cd tech-news
pm2 restart tech-news
```

---

## 🔐 安全建议

1. **环境变量检查**
   ```bash
   # 确保敏感信息不在 Git 仓库中
   cat .env
   ```

2. **权限检查**
   ```bash
   # 确保文件权限正确
   chmod 600 .env
   chmod +x scripts/*.sh
   ```

3. **防火墙确认**
   ```bash
   # 确保端口已开放（如果使用防火墙）
   sudo ufw status
   ```

---

## 📈 性能监控

更新后建议监控以下指标：

```bash
# CPU 和内存使用
pm2 monit

# 应用响应时间
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8765

# 数据库性能
# 查看慢查询日志（如果配置了）
```

---

## 📝 本次更新不需要的操作

以下操作在本次更新中**不需要**执行：

- ❌ 不需要修改环境变量
- ❌ 不需要运行数据库迁移
- ❌ 不需要修改 Nginx 配置
- ❌ 不需要重启数据库
- ❌ 不需要修改防火墙规则

---

## 📚 相关文档

- 部署指南: [deploy-guide.md](./deploy-guide.md)
- 配置说明: [docs/guides/SCRAPE-CONFIG-GUIDE.md](./docs/guides/SCRAPE-CONFIG-GUIDE.md)
- 智能检测: [docs/guides/SMART-DETECTION.md](./docs/guides/SMART-DETECTION.md)

---

## 💡 提示

- 建议在低峰期（如凌晨）进行更新
- 更新前先备份数据库
- 保持 PM2 日志以便问题排查
- 更新后观察日志 24 小时确保稳定

---

**更新日期**: 2025-10-09
**版本**: ffbe0e4 → f5d6ed4
**更新类型**: Bug 修复 + 代码清理
