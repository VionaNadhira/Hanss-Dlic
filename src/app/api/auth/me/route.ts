import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const username = req.cookies.get('dlicom_user')?.value
    if (!username) {
      return NextResponse.json({ user: null })
    }

    const client = await pool.connect()
    try {
      const res = await client.query(
        `SELECT id, username, balance FROM users WHERE username = $1`,
        [username.toLowerCase()]
      )
      if (res.rows.length === 0) {
        return NextResponse.json({ user: null })
      }
      const u = res.rows[0]
      return NextResponse.json({
        user: {
          username: u.username,
          balance: Number(u.balance),
          history: [], // history is in ledger/bets tables now
        },
      })
    } finally {
      client.release()
    }
  } catch {
    return NextResponse.json({ user: null })
  }
}
