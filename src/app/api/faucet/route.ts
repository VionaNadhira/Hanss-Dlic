import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const FAUCET_AMOUNT = 200
const COOLDOWN_MS = 60 * 60 * 1000 // 60 minutes

export async function GET(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ canClaim: false, remainingMs: 0, requiresLogin: true }, { status: 401 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(`SELECT last_faucet_at FROM users WHERE username = $1`, [
      username.toLowerCase(),
    ])

    if (res.rows.length === 0) {
      return NextResponse.json({ canClaim: false, remainingMs: 0, requiresLogin: true }, { status: 401 })
    }

    const lastFaucetAt = res.rows[0].last_faucet_at ? new Date(res.rows[0].last_faucet_at).getTime() : null
    if (!lastFaucetAt) {
      return NextResponse.json({ canClaim: true, remainingMs: 0, amount: FAUCET_AMOUNT })
    }

    const elapsed = Date.now() - lastFaucetAt
    if (elapsed >= COOLDOWN_MS) {
      return NextResponse.json({ canClaim: true, remainingMs: 0, amount: FAUCET_AMOUNT })
    }

    const remainingMs = COOLDOWN_MS - elapsed
    return NextResponse.json({ canClaim: false, remainingMs, amount: FAUCET_AMOUNT })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ success: false, error: 'Please log in to claim faucet' }, { status: 401 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const res = await client.query(`SELECT id, balance, last_faucet_at FROM users WHERE username = $1 FOR UPDATE`, [
      username.toLowerCase(),
    ])

    if (res.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const user = res.rows[0]
    const lastFaucetAt = user.last_faucet_at ? new Date(user.last_faucet_at).getTime() : null

    if (lastFaucetAt) {
      const elapsed = Date.now() - lastFaucetAt
      if (elapsed < COOLDOWN_MS) {
        const remainingMs = COOLDOWN_MS - elapsed
        await client.query('ROLLBACK')
        return NextResponse.json(
          { success: false, error: 'Faucet cooldown active', remainingMs },
          { status: 429 }
        )
      }
    }

    const newBalance = BigInt(user.balance) + BigInt(FAUCET_AMOUNT)
    const now = new Date()

    // Update user balance & last_faucet_at
    await client.query(
      `UPDATE users SET balance = $1, last_faucet_at = $2 WHERE id = $3`,
      [newBalance.toString(), now, user.id]
    )

    // Record in ledger
    await client.query(
      `INSERT INTO ledger (id, user_id, delta, reason, ref_id) VALUES ($1, $2, $3, 'faucet', $4)`,
      [randomUUID(), user.id, FAUCET_AMOUNT.toString(), 'faucet-hourly']
    )

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      amount: FAUCET_AMOUNT,
      newBalance: newBalance.toString(),
      nextClaimMs: COOLDOWN_MS,
    })
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Faucet claim failed'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
