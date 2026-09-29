import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/sync
 * Kept for backward compatibility with BalanceContext.
 * The authoritative balance now lives in Postgres (updated by /api/bets and /api/faucet).
 * This endpoint simply returns the current DB balance — it does NOT allow client-side balance writes.
 */
export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT balance FROM users WHERE username = $1`,
      [username.toLowerCase()]
    )
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const balance = Number(res.rows[0].balance)
    return NextResponse.json({ success: true, balance })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
