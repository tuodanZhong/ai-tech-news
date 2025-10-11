import { NextRequest, NextResponse } from 'next/server'

// 验证管理员身份
export function verifyAdminAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_token')?.value
  const validToken = process.env.ADMIN_AUTH_TOKEN || 'default-secure-token-change-me'

  return token === validToken
}

// 从客户端验证管理员身份
export async function verifyAdminAuthClient(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'GET',
      credentials: 'include'
    })
    return response.ok
  } catch (error) {
    return false
  }
}

// 生成401未授权响应
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  )
}
