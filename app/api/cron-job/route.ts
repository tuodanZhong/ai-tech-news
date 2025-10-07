import { NextResponse } from 'next/server'
import { executeCronJob } from '@/lib/cron-executor'

// 配置路由属性
export const maxDuration = 300 // 300秒（5分钟），自部署时可以设置更长
export const dynamic = 'force-dynamic' // 强制动态渲染，不缓存

export async function GET(request: Request) {
  // 直接调用核心执行函数，避免 HTTP 调用超时问题
  const result = await executeCronJob()
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
