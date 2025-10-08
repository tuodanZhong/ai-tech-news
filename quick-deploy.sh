#!/bin/bash
# Tech News 快速部署脚本
# 使用方法：bash quick-deploy.sh

set -e

echo "======================================"
echo "🚀 Tech News 项目快速部署"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

PROJECT_DIR=$(pwd)
echo -e "${GREEN}📁 项目目录: $PROJECT_DIR${NC}"
echo ""

# 2. 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env 文件不存在，正在创建...${NC}"
    cat > .env << 'EOF'
# 数据库连接（请修改为你的实际配置）
DATABASE_URL="postgresql://username:password@host:5432/database?schema=public"

# DeepSeek API
DEEPSEEK_API_KEY="your-deepseek-api-key"

# 腾讯云翻译 API
TENCENTCLOUD_SECRET_ID="your-secret-id"
TENCENTCLOUD_SECRET_KEY="your-secret-key"

# Firecrawl API（可选）
FIRECRAWL_API_KEY="your-firecrawl-api-key"

# 应用 URL
NEXT_PUBLIC_APP_URL="http://localhost:8765"
EOF
    echo -e "${RED}❌ 请先编辑 .env 文件，填入真实的环境变量${NC}"
    echo -e "${YELLOW}   nano .env${NC}"
    exit 1
fi

echo -e "${GREEN}✓ .env 文件已存在${NC}"

# 3. 检查必要的环境变量
source .env
if [[ "$DATABASE_URL" == *"username:password"* ]] || [[ "$DEEPSEEK_API_KEY" == "your-deepseek-api-key" ]]; then
    echo -e "${RED}❌ 请先配置 .env 文件中的环境变量${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 环境变量配置正确${NC}"
echo ""

# 4. 安装依赖
echo -e "${YELLOW}📥 安装依赖...${NC}"
npm install
echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# 5. 同步数据库
echo -e "${YELLOW}🗄️  同步数据库...${NC}"
npx prisma generate
npx prisma db push
echo -e "${GREEN}✓ 数据库同步完成${NC}"
echo ""

# 6. 构建项目
echo -e "${YELLOW}🔨 构建项目...${NC}"
npm run build
echo -e "${GREEN}✓ 项目构建完成${NC}"
echo ""

# 7. 创建日志目录
mkdir -p logs
echo -e "${GREEN}✓ 日志目录已创建${NC}"
echo ""

# 8. 创建 PM2 配置文件
echo -e "${YELLOW}⚙️  创建 PM2 配置...${NC}"
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'tech-news',
    script: 'npm',
    args: 'start',
    cwd: '$PROJECT_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8765
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF
echo -e "${GREEN}✓ PM2 配置已创建${NC}"
echo ""

# 9. 停止旧服务
echo -e "${YELLOW}🛑 停止旧服务...${NC}"
pm2 delete tech-news 2>/dev/null || echo -e "${YELLOW}   (没有运行中的服务)${NC}"

# 10. 启动服务
echo -e "${YELLOW}🚀 启动服务...${NC}"
pm2 start ecosystem.config.js

# 11. 保存配置
echo -e "${YELLOW}💾 保存 PM2 配置...${NC}"
pm2 save

# 12. 显示状态
echo ""
echo "======================================"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "======================================"
echo ""
pm2 status
echo ""
echo -e "${GREEN}访问地址:${NC} http://localhost:8765"
echo ""
echo -e "${YELLOW}常用命令:${NC}"
echo "  pm2 logs tech-news      # 查看日志"
echo "  pm2 restart tech-news   # 重启服务"
echo "  pm2 stop tech-news      # 停止服务"
echo "  pm2 monit               # 监控资源"
echo ""
echo -e "${YELLOW}配置定时任务 (可选):${NC}"
echo "  crontab -e"
echo "  添加: 0 * * * * curl -X GET \"http://localhost:8765/api/cron-job\" >> $PROJECT_DIR/logs/cron.log 2>&1"
echo ""
echo -e "${YELLOW}设置开机自启 (首次部署):${NC}"
echo "  pm2 startup"
echo "  (复制输出的命令并执行)"
echo ""
