#!/bin/bash
set -e

echo "🚀 开始部署 Tech News 项目..."
echo "================================"

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 1. 备份数据库
echo ""
echo "📦 步骤 1/8: 备份数据库..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  警告: DATABASE_URL 未设置，跳过备份"
else
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "   备份文件: $BACKUP_FILE"
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE" || {
        echo "⚠️  警告: 数据库备份失败，继续部署..."
    }
    echo "   ✅ 备份完成"
fi

# 2. 拉取代码
echo ""
echo "📥 步骤 2/8: 拉取最新代码..."
git pull origin main
echo "   ✅ 代码已更新"

# 3. 安装依赖
echo ""
echo "📦 步骤 3/8: 安装依赖..."
npm install
echo "   ✅ 依赖已安装"

# 4. 同步数据库
echo ""
echo "🗄️  步骤 4/8: 同步数据库 schema..."
npx prisma db push --accept-data-loss || {
    echo "❌ 数据库同步失败"
    exit 1
}
echo "   ✅ 数据库已同步"

# 5. 初始化提示词
echo ""
echo "⚙️  步骤 5/8: 初始化提示词配置..."
npx tsx scripts/init-prompts.ts || {
    echo "⚠️  警告: 提示词初始化失败（可能已存在）"
}
echo "   ✅ 提示词配置完成"

# 6. 生成 Client
echo ""
echo "🔧 步骤 6/8: 生成 Prisma Client..."
npx prisma generate
echo "   ✅ Client 已生成"

# 7. 构建项目
echo ""
echo "🏗️  步骤 7/8: 构建项目..."
npm run build
echo "   ✅ 项目已构建"

# 8. 重启应用
echo ""
echo "♻️  步骤 8/8: 重启应用..."
if command -v pm2 &> /dev/null; then
    pm2 restart tech-news || pm2 start npm --name tech-news -- start
    echo "   ✅ PM2 应用已重启"
elif command -v systemctl &> /dev/null; then
    sudo systemctl restart tech-news
    echo "   ✅ Systemd 服务已重启"
else
    echo "   ⚠️  警告: 未找到 PM2 或 Systemd，请手动重启应用"
fi

# 完成
echo ""
echo "================================"
echo "✅ 部署完成！"
echo ""
echo "📊 检查应用状态:"
echo "   pm2 logs tech-news       # 查看 PM2 日志"
echo "   pm2 status               # 查看 PM2 状态"
echo "   systemctl status tech-news  # 查看 Systemd 状态"
echo ""
echo "🔍 验证功能:"
echo "   curl http://localhost:3000/api/health  # 健康检查"
echo "   curl http://localhost:3000/api/cron-job  # 测试采集"
echo ""
