#!/bin/bash

# ============================================
# 修复信息源"停用"按钮不显示的问题
# ============================================

set -e  # 遇到错误立即退出

echo "🔧 修复信息源按钮显示问题"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}✗${NC} 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    if [ -f ".env" ]; then
        export $(cat .env | grep DATABASE_URL | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗${NC} 未找到 DATABASE_URL 环境变量"
    echo "请确保 .env 文件中包含 DATABASE_URL"
    exit 1
fi

echo -e "${BLUE}📊 步骤 1/4: 检查当前状态${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" << 'EOF'
SELECT
  name AS "名称",
  "isActive" AS "已激活",
  "isTested" AS "已测试",
  "testStatus" AS "测试状态",
  CASE
    WHEN "isTested" = true AND "testStatus" = 'success' THEN '✅ 显示'
    ELSE '❌ 不显示'
  END AS "停用按钮"
FROM "RSSSource"
ORDER BY "createdAt";
EOF

echo ""
echo -e "${BLUE}📊 统计信息:${NC}"
psql "$DATABASE_URL" << 'EOF'
SELECT
  '总信息源数' AS "统计项",
  COUNT(*)::text AS "数量"
FROM "RSSSource"
UNION ALL
SELECT
  '可显示停用按钮',
  COUNT(*)::text
FROM "RSSSource"
WHERE "isTested" = true AND "testStatus" = 'success'
UNION ALL
SELECT
  '不显示停用按钮',
  COUNT(*)::text
FROM "RSSSource"
WHERE NOT ("isTested" = true AND "testStatus" = 'success');
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  问题说明:${NC}"
echo "「停用」按钮只在满足以下条件时显示:"
echo "  1. isTested = true  (已测试)"
echo "  2. testStatus = 'success'  (测试成功)"
echo ""
echo "如果你的信息源没有显示「停用」按钮,"
echo "说明这些字段的值不满足条件。"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 询问用户选择修复方式
echo -e "${BLUE}请选择修复方式:${NC}"
echo "1) 更新所有已激活的信息源 (推荐)"
echo "2) 更新所有信息源"
echo "3) 只更新特定的信息源"
echo "4) 仅查看问题，不修复"
echo "5) 退出"
echo ""
read -p "请输入选项 (1-5): " choice

case $choice in
  1)
    echo ""
    echo -e "${BLUE}📝 步骤 2/4: 更新已激活的信息源${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 显示将要更新的源
    echo "将要更新以下信息源:"
    psql "$DATABASE_URL" << 'EOF'
SELECT name AS "名称", "isActive" AS "已激活"
FROM "RSSSource"
WHERE "isActive" = true;
EOF

    echo ""
    read -p "确认更新这些信息源? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⊘${NC} 操作已取消"
        exit 0
    fi

    # 执行更新
    psql "$DATABASE_URL" << 'EOF'
UPDATE "RSSSource"
SET
  "isTested" = true,
  "testStatus" = 'success',
  "lastTested" = NOW()
WHERE "isActive" = true;
EOF

    echo -e "${GREEN}✓${NC} 更新完成"
    ;;

  2)
    echo ""
    echo -e "${BLUE}📝 步骤 2/4: 更新所有信息源${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 统计数量
    COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"RSSSource\";")
    echo "将要更新 $COUNT 个信息源"
    echo ""
    read -p "确认更新所有信息源? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⊘${NC} 操作已取消"
        exit 0
    fi

    # 执行更新
    psql "$DATABASE_URL" << 'EOF'
UPDATE "RSSSource"
SET
  "isTested" = true,
  "testStatus" = 'success',
  "lastTested" = NOW();
EOF

    echo -e "${GREEN}✓${NC} 更新完成"
    ;;

  3)
    echo ""
    echo -e "${BLUE}📝 步骤 2/4: 更新特定信息源${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 显示所有源
    echo "可用的信息源:"
    psql "$DATABASE_URL" << 'EOF'
SELECT
  ROW_NUMBER() OVER (ORDER BY "createdAt") AS "序号",
  name AS "名称",
  "isActive" AS "已激活",
  "isTested" AS "已测试",
  "testStatus" AS "状态"
FROM "RSSSource"
ORDER BY "createdAt";
EOF

    echo ""
    read -p "请输入要更新的信息源名称: " SOURCE_NAME

    if [ -z "$SOURCE_NAME" ]; then
        echo -e "${RED}✗${NC} 名称不能为空"
        exit 1
    fi

    # 检查源是否存在
    EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"RSSSource\" WHERE name = '$SOURCE_NAME';")
    if [ "$EXISTS" -eq 0 ]; then
        echo -e "${RED}✗${NC} 未找到名为 '$SOURCE_NAME' 的信息源"
        exit 1
    fi

    # 执行更新
    psql "$DATABASE_URL" << EOF
UPDATE "RSSSource"
SET
  "isTested" = true,
  "testStatus" = 'success',
  "lastTested" = NOW()
WHERE name = '$SOURCE_NAME';
EOF

    echo -e "${GREEN}✓${NC} 已更新信息源: $SOURCE_NAME"
    ;;

  4)
    echo ""
    echo -e "${BLUE}📊 仅查看模式 - 不执行任何修改${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "问题信息源列表 (不显示停用按钮):"
    psql "$DATABASE_URL" << 'EOF'
SELECT
  name AS "名称",
  url AS "URL",
  "isActive" AS "已激活",
  "isTested" AS "已测试",
  "testStatus" AS "测试状态"
FROM "RSSSource"
WHERE NOT ("isTested" = true AND "testStatus" = 'success')
ORDER BY "createdAt";
EOF
    echo ""
    echo -e "${YELLOW}💡 提示:${NC} 重新运行此脚本并选择修复选项来解决问题"
    exit 0
    ;;

  5)
    echo -e "${YELLOW}⊘${NC} 已退出"
    exit 0
    ;;

  *)
    echo -e "${RED}✗${NC} 无效选项"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}📊 步骤 3/4: 验证修复结果${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" << 'EOF'
SELECT
  name AS "名称",
  "isActive" AS "已激活",
  "isTested" AS "已测试",
  "testStatus" AS "测试状态",
  CASE
    WHEN "isTested" = true AND "testStatus" = 'success' THEN '✅ 显示'
    ELSE '❌ 不显示'
  END AS "停用按钮"
FROM "RSSSource"
ORDER BY "createdAt";
EOF

echo ""
echo -e "${BLUE}📊 最终统计:${NC}"
psql "$DATABASE_URL" << 'EOF'
SELECT
  '总信息源数' AS "统计项",
  COUNT(*)::text AS "数量"
FROM "RSSSource"
UNION ALL
SELECT
  '可显示停用按钮',
  COUNT(*)::text
FROM "RSSSource"
WHERE "isTested" = true AND "testStatus" = 'success';
EOF

echo ""
echo -e "${BLUE}🔄 步骤 4/4: 重启应用${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查是否使用 PM2
if command -v pm2 &> /dev/null; then
    read -p "是否重启 PM2 应用? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 restart tech-news
        echo -e "${GREEN}✓${NC} PM2 应用已重启"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 修复完成!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}📝 接下来的步骤:${NC}"
echo "1. 打开浏览器访问管理页面"
echo "   http://your-server/admin/sources"
echo ""
echo "2. 现在应该能看到「停用」按钮了"
echo ""
echo "3. 如果仍然看不到按钮,请:"
echo "   - 刷新浏览器 (Ctrl+Shift+R 强制刷新)"
echo "   - 清除浏览器缓存"
echo "   - 检查浏览器控制台是否有错误"
echo ""
echo -e "${BLUE}💡 提示:${NC}"
echo "以后添加新的信息源后,需要先点击「测试」按钮"
echo "测试成功后,「停用」按钮才会自动出现"
echo ""
