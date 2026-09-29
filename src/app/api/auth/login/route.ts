import { NextRequest, NextResponse } from 'next/server'
import {
  getUserByUsername,
  hashPassword,
  updateLastLogin,
} from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const cleanUsername = decodeURIComponent(String(username)).trim().toLowerCase()
    const user = await getUserByUsername(cleanUsername)

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const hash = hashPassword(String(password), user.salt)
    if (hash !== user.passwordHash) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Update last login
    await updateLastLogin(user.username)

    const res = NextResponse.json({
      success: true,
      user: {
        username: user.username,
        balance: user.balance,
        history: [],
      },
    })
    res.cookies.set('dlicom_user', user.username, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
