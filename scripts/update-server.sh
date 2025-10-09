#!/bin/bash

# ============================================
# 科技日报项目 - 服务器代码更新脚本
# ============================================

set -e  # 遇到错误立即退出

echo "🚀 开始更新服务器代码..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目路径（根据实际情况修改）
PROJECT_DIR="$HOME/tech-news"
PM2_APP_NAME="tech-news"  # PM2 应用名称

echo "📁 项目路径: $PROJECT_DIR"
echo "📦 PM2 应用: $PM2_APP_NAME"
echo ""

# 步骤 1: 拉取最新代码
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 步骤 1/7: 拉取最新代码"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$PROJECT_DIR"
git fetch origin
echo -e "${GREEN}✓${NC} 获取远程更新完成"

# 显示将要拉取的更新
echo ""
echo "📋 本次更新包含以下提交:"
git log HEAD..origin/main --oneline --color=always | head -10
echo ""

read -p "是否继续拉取更新？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠${NC} 取消更新"
    exit 1
fi

git pull origin main
echo -e "${GREEN}✓${NC} 代码拉取完成"
echo ""

# 步骤 2: 安装/更新依赖
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 步骤 2/7: 检查并更新依赖"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm install --production
echo -e "${GREEN}✓${NC} 依赖更新完成"
echo ""

# 步骤 3: 生成 Prisma Client
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 步骤 3/7: 生成 Prisma Client"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx prisma generate
echo -e "${GREEN}✓${NC} Prisma Client 生成完成"
echo ""

# 步骤 4: 运行数据库迁移
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  步骤 4/7: 运行数据库迁移"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "是否需要运行数据库迁移？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma migrate deploy
    echo -e "${GREEN}✓${NC} 数据库迁移完成"
else
    echo -e "${YELLOW}⊘${NC} 跳过数据库迁移"
fi
echo ""

# 步骤 5: 构建项目
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  步骤 5/7: 构建生产版本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
rm -rf .next
npm run build
echo -e "${GREEN}✓${NC} 构建完成"
echo ""

# 步骤 6: 重启 PM2 应用
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 步骤 6/7: 重启 PM2 应用"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 PM2 应用是否存在
if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo "正在重启 PM2 应用..."
    pm2 restart "$PM2_APP_NAME"
    echo -e "${GREEN}✓${NC} PM2 应用重启完成"
else
    echo -e "${RED}✗${NC} PM2 应用 '$PM2_APP_NAME' 不存在"
    echo ""
    echo "请先启动应用："
    echo "  pm2 start npm --name '$PM2_APP_NAME' -- start"
    echo "  pm2 save"
    exit 1
fi
echo ""

# 步骤 7: 验证部署
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 步骤 7/7: 验证部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 3

# 显示应用状态
pm2 info "$PM2_APP_NAME"
echo ""

# 显示最新日志
echo "📝 最新日志 (最后 20 行):"
pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 服务器代码更新完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 有用的命令:"
echo "  查看应用状态: pm2 status"
echo "  查看实时日志: pm2 logs $PM2_APP_NAME"
echo "  重启应用:    pm2 restart $PM2_APP_NAME"
echo "  停止应用:    pm2 stop $PM2_APP_NAME"
echo ""
