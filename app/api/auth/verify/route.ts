import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const isAuthenticated = verifyAdminAuth(request)

  if (isAuthenticated) {
    return NextResponse.json({ success: true, authenticated: true })
  } else {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401 }
    )
  }
}
