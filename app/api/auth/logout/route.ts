import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: '已登出'
  })

  // 删除认证cookie
  response.cookies.delete('admin_token')

  return response
}
