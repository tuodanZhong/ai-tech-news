# 项目规则和约定

## 数据库操作规则

### 清理数据库流程
当用户要求"清理数据库"或"清空数据库"时，**必须按以下顺序执行**：

1. **步骤1：清空所有数据**
   ```bash
   npx tsx -e "
   import { prisma } from './lib/db'

   async function clearAllData() {
     const deletedHotTopics = await prisma.hotTopic.deleteMany({})
     const deletedFiltered = await prisma.filteredArticle.deleteMany({})
     const deletedArticles = await prisma.article.deleteMany({})
     const deletedRSS = await prisma.rSSSource.deleteMany({})

     console.log('已删除:', deletedHotTopics.count, '条热点话题')
     console.log('已删除:', deletedFiltered.count, '条过滤历史')
     console.log('已删除:', deletedArticles.count, '篇文章')
     console.log('已删除:', deletedRSS.count, '个RSS源')

     await prisma.\$disconnect()
   }
   clearAllData()
   "
   ```

2. **步骤2：同步数据库表结构（必须执行）**
   ```bash
   npx prisma db push
   ```

**重要：这两个步骤必须一起执行，不能只执行第一步！**

## 快捷命令

用户也可以直接运行：
```bash
npm run db:clear
```
此命令会自动执行上述两个步骤。
