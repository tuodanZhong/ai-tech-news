import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // 从环境变量获取管理员凭据
    const adminUsername = process.env.ADMIN_USERNAME || 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

    // 验证凭据
    if (username === adminUsername && password === adminPassword) {
      // 生成token (在生产环境应使用更安全的方式)
      const token = process.env.ADMIN_AUTH_TOKEN || 'default-secure-token-change-me'

      const response = NextResponse.json({
        success: true,
        message: '登录成功'
      })

      // 设置cookie (30天过期)
      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: false, // 如果使用 HTTP，设置为 false；HTTPS 时设置为 true
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30天
        path: '/' // 确保在整个域名下都可以访问
      })

      return response
    } else {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('[登录] 错误:', error)
    return NextResponse.json(
      { success: false, error: '登录失败' },
      { status: 500 }
    )
  }
}
