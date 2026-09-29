import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'
import { getUserTier, getStreakSecondsLeft } from '@/lib/game/tiers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ user: null })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT id, username, balance, score, streak_days, last_bet_day, last_faucet_at FROM users WHERE username = $1`,
      [username.toLowerCase()]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ user: null })
    }

    const u = res.rows[0]

    // Calculate user rank (count how many users have higher score)
    const rankRes = await client.query(
      `SELECT COUNT(*) + 1 AS rank FROM users WHERE score > $1`,
      [u.score]
    )
    const rank = parseInt(rankRes.rows[0].rank, 10)

    // Tier info
    const tierProgress = getUserTier(u.score)

    // Streak info
    const streakSecondsLeft = getStreakSecondsLeft(u.last_bet_day)

    // Faucet cooldown
    const COOLDOWN_MS = 60 * 60 * 1000
    const lastFaucetAt = u.last_faucet_at ? new Date(u.last_faucet_at).getTime() : null
    let faucetRemainingMs = 0
    let canClaimFaucet = true

    if (lastFaucetAt) {
      const elapsed = Date.now() - lastFaucetAt
      if (elapsed < COOLDOWN_MS) {
        canClaimFaucet = false
        faucetRemainingMs = COOLDOWN_MS - elapsed
      }
    }

    return NextResponse.json({
      user: {
        id: u.id,
        username: u.username,
        balance: u.balance.toString(),
        score: u.score,
        rank,
        streakDays: u.streak_days || 0,
        streakSecondsLeft,
        tier: tierProgress,
        faucet: {
          canClaim: canClaimFaucet,
          remainingMs: faucetRemainingMs,
          amount: 200,
        },
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user profile'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
