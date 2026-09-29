import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'
import { hashPassword, generateSalt } from '@/lib/pinataDb'

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

    const salt = generateSalt()
    const passwordHash = hashPassword(String(password), salt)

    const client = await pool.connect()
    try {
      // Insert new user with starting balance 1000 pts
      const res = await client.query(
        `INSERT INTO users (username, password_hash, salt, balance, score, streak_days)
         VALUES ($1, $2, $3, 1000, 1000, 0)
         RETURNING id, username, balance`,
        [cleanUsername, passwordHash, salt]
      )

      const user = res.rows[0]
      const response = NextResponse.json({
        success: true,
        username: user.username,
        balance: Number(user.balance),
      })
      response.cookies.set('dlicom_user', user.username, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
      return response
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : ''
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
      }
      throw dbErr
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[register] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
