import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'
import { hashPassword } from '@/lib/pinataDb'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const cleanUsername = String(username).trim().toLowerCase()
    const client = await pool.connect()

    try {
      const result = await client.query(
        `SELECT id, username, password_hash, salt, balance, last_login_at
         FROM users WHERE username = $1`,
        [cleanUsername]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
      }

      const user = result.rows[0]
      const hash = hashPassword(String(password), user.salt)

      if (hash !== user.password_hash) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
      }

      // Update last login timestamp
      await client.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])

      const res = NextResponse.json({
        success: true,
        user: {
          username: user.username,
          balance: Number(user.balance),
        },
      })
      res.cookies.set('dlicom_user', user.username, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
      return res
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
