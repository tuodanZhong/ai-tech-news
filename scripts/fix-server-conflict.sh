#!/bin/bash

# ============================================
# 修复服务器 Git 冲突脚本
# ============================================

echo "🔧 修复 Git 冲突..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查当前状态
echo "📋 当前状态:"
git status
echo ""

# 方案选择
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "请选择解决方案："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1) 保存本地修改后拉取（推荐）"
echo "2) 放弃本地修改，强制同步远程"
echo "3) 手动处理（退出脚本）"
echo ""
read -p "请输入选项 (1/2/3): " choice

case $choice in
  1)
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 方案 1: 暂存本地修改"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 暂存本地修改
    echo "正在暂存本地修改..."
    git stash push -m "server-local-changes-$(date +%Y%m%d-%H%M%S)"
    echo -e "${GREEN}✓${NC} 本地修改已暂存"
    echo ""

    # 拉取远程更新
    echo "正在拉取远程更新..."
    git pull origin main
    echo -e "${GREEN}✓${NC} 远程代码已拉取"
    echo ""

    # 询问是否恢复本地修改
    read -p "是否需要恢复暂存的本地修改？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在恢复本地修改..."
        git stash pop
        echo -e "${GREEN}✓${NC} 本地修改已恢复"
        echo ""
        echo -e "${YELLOW}⚠${NC} 如有冲突，请手动解决"
    else
        echo -e "${GREEN}✓${NC} 本地修改保留在 stash 中"
        echo ""
        echo "💡 如需查看暂存内容: git stash list"
        echo "💡 如需恢复暂存内容: git stash pop"
    fi
    ;;

  2)
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  方案 2: 强制同步远程（会丢失本地修改）"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo -e "${RED}警告: 这将丢失所有本地修改！${NC}"
    read -p "确定要继续吗？(yes/no) " confirm

    if [ "$confirm" = "yes" ]; then
        echo "正在获取远程代码..."
        git fetch origin
        echo ""

        echo "正在强制同步..."
        git reset --hard origin/main
        echo -e "${GREEN}✓${NC} 已强制同步到远程版本"
        echo ""

        # 清理未跟踪的文件（可选）
        read -p "是否清理未跟踪的文件？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git clean -fd
            echo -e "${GREEN}✓${NC} 未跟踪的文件已清理"
        fi
    else
        echo -e "${YELLOW}⊘${NC} 操作已取消"
        exit 1
    fi
    ;;

  3)
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔧 手动处理提示"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "方案 A - 暂存后拉取:"
    echo "  git stash"
    echo "  git pull origin main"
    echo "  git stash pop  # 如需恢复修改"
    echo ""
    echo "方案 B - 直接放弃本地修改:"
    echo "  git checkout -- pnpm-lock.yaml"
    echo "  git pull origin main"
    echo ""
    echo "方案 C - 强制同步远程:"
    echo "  git fetch origin"
    echo "  git reset --hard origin/main"
    echo ""
    exit 0
    ;;

  *)
    echo -e "${RED}✗${NC} 无效选项"
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ 冲突已解决${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 当前状态:"
git status
echo ""
echo "💡 下一步: 运行更新脚本"
echo "  ./scripts/update-server.sh"
echo ""
