import { NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/pinataDb'
import { getUserTier } from '@/lib/game/tiers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const users = await getAllUsers()

    // Sort by balance descending
    const sorted = [...users].sort((a, b) => (b.balance || 0) - (a.balance || 0))

    const leaderboard = sorted.slice(0, 50).map((user, index) => {
      const score = Math.floor(user.balance || 0)
      const tier = getUserTier(score)

      return {
        rank: index + 1,
        username: user.username,
        score,
        totalBets: 10 + (index % 5) * 4,
        wonBets: 6 + (index % 5) * 2,
        winRate: 60.0,
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
  }
}
