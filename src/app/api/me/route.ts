import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername, getUserRank } from '@/lib/db/queries'
import { getUserTier } from '@/lib/game/tiers'

export const dynamic = 'force-dynamic'

const FAUCET_COOLDOWN_HOURS = Number(process.env.FAUCET_COOLDOWN_HOURS) || 1
const FAUCET_COOLDOWN_MS = FAUCET_COOLDOWN_HOURS * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ user: null })
  }

  try {
    const user = await getUserByUsername(username)
    if (!user) {
      return NextResponse.json({ user: null })
    }

    const rank = await getUserRank(user.username, user.balance)
    const score = user.score || Math.floor(user.balance)
    const tierProgress = getUserTier(score)

    const lastClaim = user.lastFaucetAt ? new Date(user.lastFaucetAt).getTime() : 0
    const elapsed = Date.now() - lastClaim
    const canClaimFaucet = elapsed >= FAUCET_COOLDOWN_MS
    const faucetRemainingMs = canClaimFaucet ? 0 : FAUCET_COOLDOWN_MS - elapsed

    return NextResponse.json({
      user: {
        id: user.username,
        username: user.username,
        balance: user.balance.toString(),
        score,
        rank: rank > 0 ? rank : 1,
        streakDays: user.streakDays || 1,
        streakSecondsLeft: 86400,
        canClaimFaucet,
        faucetRemainingMs,
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
