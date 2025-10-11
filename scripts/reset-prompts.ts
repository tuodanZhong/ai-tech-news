// 重置提示词配置（删除所有现有配置）
import { prisma } from '../lib/db'

async function main() {
  console.log('[重置] 开始重置提示词配置...')

  // 删除所有现有配置
  const deleted = await prisma.promptConfig.deleteMany({})
  console.log(`[删除] 已删除 ${deleted.count} 条记录`)

  console.log('[完成] 提示词已清空')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
