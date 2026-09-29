import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'
import { randomUUID } from 'crypto'
import { computeOdds } from '@/lib/game/math'

export const dynamic = 'force-dynamic'

// Rate limiter: Map<userId, timestamp[]>
const userBetTimestamps = new Map<number, number[]>()

function checkRateLimit(userId: number): boolean {
  const now = Date.now()
  const timestamps = userBetTimestamps.get(userId) || []
  const recent = timestamps.filter((t) => now - t < 60000)
  if (recent.length >= 10) return false
  recent.push(now)
  userBetTimestamps.set(userId, recent)
  return true
}

export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ error: 'Please log in to place a bet' }, { status: 401 })
  }

  let body: { roundId?: string; side?: string; amount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { roundId, side, amount } = body

  if (!roundId || typeof roundId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid roundId' }, { status: 400 })
  }

  if (side !== 'up' && side !== 'down') {
    return NextResponse.json({ error: 'Side must be "up" or "down"' }, { status: 400 })
  }

  // Bet amount in $ (minimum $1, maximum $10,000)
  const amountNum = Math.floor(Number(amount))
  if (isNaN(amountNum) || amountNum < 1) {
    return NextResponse.json({ error: 'Minimum bet amount is $1' }, { status: 400 })
  }
  if (amountNum > 10000) {
    return NextResponse.json({ error: 'Maximum bet amount is $10,000' }, { status: 400 })
  }

  const betAmountBigInt = BigInt(amountNum)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const userRes = await client.query(
      `SELECT * FROM users WHERE username = $1 FOR UPDATE`,
      [username.toLowerCase()]
    )

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = userRes.rows[0]
    const userId = user.id

    if (!checkRateLimit(userId)) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Rate limit exceeded: maximum 10 bets per minute' },
        { status: 429 }
      )
    }

    // User balance in $
    const userBalance = BigInt(user.balance)

    if (userBalance < betAmountBigInt) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: `Insufficient balance. Available: $${userBalance.toString()}` },
        { status: 400 }
      )
    }

    const roundRes = await client.query(
      `SELECT * FROM rounds WHERE id = $1 FOR UPDATE`,
      [roundId]
    )

    if (roundRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    const round = roundRes.rows[0]
    const nowSec = Math.floor(Date.now() / 1000)

    if (round.status !== 'scheduled' && round.status !== 'live') {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: `Round is ${round.status}. Betting is closed.` },
        { status: 400 }
      )
    }

    const cutoffSec = round.end_at - 10
    if (nowSec >= cutoffSec) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Betting is closed for this round (closes 10s before round ends)' },
        { status: 400 }
      )
    }

    // Opposite sides check: user cannot bet opposite side in same round
    const oppositeSide = side === 'up' ? 'down' : 'up'
    const oppositeBetRes = await client.query(
      `SELECT id FROM bets WHERE round_id = $1 AND user_id = $2 AND side = $3 LIMIT 1`,
      [roundId, userId, oppositeSide]
    )

    if (oppositeBetRes.rows.length > 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: `You already bet on ${oppositeSide.toUpperCase()} this round. Hedging is not allowed.` },
        { status: 400 }
      )
    }

    // Insert bet record
    const betId = randomUUID()
    await client.query(
      `INSERT INTO bets (id, user_id, round_id, side, amount, status)
       VALUES ($1, $2, $3, $4, $5, 'open')`,
      [betId, userId, roundId, side, betAmountBigInt.toString()]
    )

    // Deduct user balance in $
    const newBalance = userBalance - betAmountBigInt
    await client.query(
      `UPDATE users SET balance = $1 WHERE id = $2`,
      [newBalance.toString(), userId]
    )

    // Ledger entry
    await client.query(
      `INSERT INTO ledger (id, user_id, delta, reason, ref_id)
       VALUES ($1, $2, $3, 'bet', $4)`,
      [randomUUID(), userId, (-betAmountBigInt).toString(), roundId]
    )

    // Update round pools
    if (side === 'up') {
      await client.query(
        `UPDATE rounds SET pool_up = pool_up + $1 WHERE id = $2`,
        [betAmountBigInt.toString(), roundId]
      )
    } else {
      await client.query(
        `UPDATE rounds SET pool_down = pool_down + $1 WHERE id = $2`,
        [betAmountBigInt.toString(), roundId]
      )
    }

    // Streak tracking
    const todayUtc = new Date().toISOString().slice(0, 10)
    if (user.last_bet_day !== todayUtc) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const nextStreak = user.last_bet_day === yesterday ? (user.streak_days || 0) + 1 : 1
      await client.query(
        `UPDATE users SET streak_days = $1, last_bet_day = $2 WHERE id = $3`,
        [nextStreak, todayUtc, userId]
      )
    }

    // Return updated odds
    const updatedRoundRes = await client.query(`SELECT * FROM rounds WHERE id = $1`, [roundId])
    const updatedRound = updatedRoundRes.rows[0]

    const odds = computeOdds(
      { poolUp: BigInt(updatedRound.pool_up), poolDown: BigInt(updatedRound.pool_down) },
      { houseSeedUp: BigInt(updatedRound.house_seed_up), houseSeedDown: BigInt(updatedRound.house_seed_down) },
      updatedRound.fee_bps
    )

    const estimatedMultiplier = side === 'up' ? odds.multiplierUp : odds.multiplierDown

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      betId,
      newBalance: Number(newBalance),
      estimatedMultiplier,
      side,
      amount: amountNum,
    })
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Server error while placing bet'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
