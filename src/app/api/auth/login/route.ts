import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveAllUsers, hashPassword } from '@/lib/pinataDb'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }
    const cleanUsername = String(username).trim().toLowerCase()
    const users = await getAllUsers()
    const user = users.find((u) => u.username === cleanUsername)
    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }
    const hash = hashPassword(String(password), user.salt)
    if (hash !== user.passwordHash) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    user.lastLogin = Date.now()
    await saveAllUsers(users)

    const res = NextResponse.json({
      success: true,
      user: { username: user.username, balance: user.balance },
    })
    res.cookies.set('dlicom_user', user.username, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
