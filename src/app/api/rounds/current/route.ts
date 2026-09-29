import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { users, bets } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { ensureRounds, lockTarget, settleDueRounds } from '@/lib/game/rounds'
import { computeOdds, type OddsResult } from '@/lib/game/math'

export const dynamic = 'force-dynamic'

/** Strip BigInt fields so the object is JSON-serializable */
function serializeOdds(odds: OddsResult) {
  return {
    chanceUp: odds.chanceUp,
    chanceDown: odds.chanceDown,
    multiplierUp: odds.multiplierUp,
    multiplierDown: odds.multiplierDown,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = (searchParams.get('asset') || 'btc').toLowerCase()
    const nowSec = Math.floor(Date.now() / 1000)

    // 1. First settle any rounds that have reached endAt + 5s
    await settleDueRounds(nowSec)

    // 2. Ensure current round and presale rounds are created and loaded fresh
    const activeRounds = await ensureRounds(asset, nowSec)
    for (const r of activeRounds) {
      if (r.targetPrice === null && nowSec >= r.startAt) {
        await lockTarget(r, nowSec)
      }
    }

    // Find the current live/scheduled round
    const liveRound = activeRounds.find((r) => nowSec >= r.startAt && nowSec < r.endAt) || activeRounds[0]
    const presaleRounds = activeRounds.filter((r) => r.id !== liveRound?.id && r.startAt > nowSec)

    // Calculate odds for the live round
    const odds = liveRound
      ? computeOdds(
          { poolUp: liveRound.poolUp, poolDown: liveRound.poolDown },
          { houseSeedUp: liveRound.houseSeedUp, houseSeedDown: liveRound.houseSeedDown },
          liveRound.feeBps
        )
      : null

    // Check if user is logged in to return their bets for these rounds
    const username = req.cookies.get('dlicom_user')?.value
    let userBets: Array<{
      id: string
      roundId: string
      side: 'up' | 'down'
      amount: string
      payout: string | null
      status: string
    }> = []

    if (username) {
      const user = await db.query.users.findFirst({
        where: eq(users.username, username.toLowerCase()),
      })
      if (user && activeRounds.length > 0) {
        const roundIds = activeRounds.map((r) => r.id)
        const userBetRows = await db
          .select()
          .from(bets)
          .where(inArray(bets.roundId, roundIds))
        userBets = userBetRows
          .filter((b) => b.userId === user.id)
          .map((b) => ({
            id: b.id,
            roundId: b.roundId,
            side: b.side as 'up' | 'down',
            amount: b.amount.toString(),
            payout: b.payout?.toString() || null,
            status: b.status,
          }))
      }
    }

    return NextResponse.json({
      asset,
      liveRound: liveRound
        ? {
            id: liveRound.id,
            asset: liveRound.asset,
            startAt: liveRound.startAt,
            endAt: liveRound.endAt,
            targetPrice: liveRound.targetPrice ? Number(liveRound.targetPrice) : null,
            finalPrice: liveRound.finalPrice ? Number(liveRound.finalPrice) : null,
            status: liveRound.status,
            result: liveRound.result,
            poolUp: liveRound.poolUp.toString(),
            poolDown: liveRound.poolDown.toString(),
            odds: odds ? serializeOdds(odds) : null,
          }
        : null,
      presaleRounds: presaleRounds.map((r) => ({
        id: r.id,
        asset: r.asset,
        startAt: r.startAt,
        endAt: r.endAt,
        targetPrice: r.targetPrice ? Number(r.targetPrice) : null,
        finalPrice: r.finalPrice ? Number(r.finalPrice) : null,
        status: r.status,
        result: r.result,
        poolUp: r.poolUp.toString(),
        poolDown: r.poolDown.toString(),
      odds: serializeOdds(computeOdds(
          { poolUp: r.poolUp, poolDown: r.poolDown },
          { houseSeedUp: r.houseSeedUp, houseSeedDown: r.houseSeedDown },
          r.feeBps
        )),
      })),
      odds: odds ? serializeOdds(odds) : null,
      userBets,
      serverTime: Math.floor(Date.now() / 1000),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch current rounds'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
