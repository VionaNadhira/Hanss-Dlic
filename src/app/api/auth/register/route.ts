import { NextRequest, NextResponse } from 'next/server'
import {
  getUserByUsername,
  createUser,
  hashPassword,
  generateSalt,
} from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const cleanUsername = String(username).trim().toLowerCase()
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return NextResponse.json({ error: 'Username must be 3–20 characters' }, { status: 400 })
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      return NextResponse.json({ error: 'Username only allows a-z, 0-9 and underscore' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const existing = await getUserByUsername(cleanUsername)
    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    const salt = generateSalt()
    const passwordHash = hashPassword(String(password), salt)

    const user = await createUser({
      username: cleanUsername,
      passwordHash,
      salt,
      balance: 1000,
    })

    const response = NextResponse.json({
      success: true,
      username: user.username,
      balance: user.balance,
    })
    response.cookies.set('dlicom_user', cleanUsername, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch (err) {
    console.error('[register] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
