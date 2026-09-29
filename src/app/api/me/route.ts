import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/pinataDb'
import { getUserTier } from '@/lib/game/tiers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ user: null })
  }

  try {
    const users = await getAllUsers()
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase())
    if (!user) {
      return NextResponse.json({ user: null })
    }

    const sorted = [...users].sort((a, b) => (b.balance || 0) - (a.balance || 0))
    const rank = sorted.findIndex((u) => u.username.toLowerCase() === username.toLowerCase()) + 1

    const score = Math.floor(user.balance || 0)
    const tierProgress = getUserTier(score)

    return NextResponse.json({
      user: {
        id: user.username,
        username: user.username,
        balance: user.balance.toString(),
        score,
        rank: rank > 0 ? rank : 1,
        streakDays: 1,
        streakSecondsLeft: 86400,
        canClaimFaucet: true,
        faucetRemainingMs: 0,
        tier: tierProgress.currentTier,
        tierColor: tierProgress.currentTierColor,
        tierProgress: tierProgress.progressPercent,
        nextTier: tierProgress.nextTier,
      },
      serverTime: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user profile'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
