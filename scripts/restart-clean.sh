#!/bin/bash

# 重启服务器脚本

echo "🔄 正在停止开发服务器..."

# 查找并终止所有 Next.js 进程
pkill -f "next dev" || true
pkill -f "node.*next" || true

# 检查并清理 3000 端口
PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
  echo "🔌 检测到端口 3000 被占用（PID: $PORT_PID），正在清理..."
  kill -9 $PORT_PID 2>/dev/null || true
  sleep 1
  echo "✅ 端口 3000 已清理"
else
  echo "✅ 端口 3000 可用"
fi

echo ""
echo "🚀 正在启动开发服务器..."
echo ""

# 启动开发服务器
npm run dev
