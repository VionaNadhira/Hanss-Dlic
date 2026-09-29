import { NextResponse } from 'next/server'
import { pool } from '@/lib/db/client'
import { getUserTier } from '@/lib/game/tiers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT 
        u.id,
        u.username,
        u.score,
        COUNT(b.id) AS total_bets,
        COUNT(CASE WHEN b.status = 'won' THEN 1 END) AS won_bets
      FROM users u
      LEFT JOIN bets b ON b.user_id = u.id
      GROUP BY u.id, u.username, u.score
      ORDER BY u.score DESC, u.created_at ASC
      LIMIT 50
    `)

    const leaderboard = res.rows.map((row, index) => {
      const totalBets = parseInt(row.total_bets, 10) || 0
      const wonBets = parseInt(row.won_bets, 10) || 0
      const winRate = totalBets > 0 ? +((wonBets / totalBets) * 100).toFixed(1) : 0
      const tier = getUserTier(row.score)

      return {
        rank: index + 1,
        username: row.username,
        score: row.score,
        totalBets,
        wonBets,
        winRate,
        tier: tier.currentTier,
        tierColor: tier.currentTierColor,
      }
    })

    return NextResponse.json({
      leaderboard,
      serverTime: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch leaderboard'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
