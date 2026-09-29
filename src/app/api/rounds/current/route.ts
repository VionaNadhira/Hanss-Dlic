import { NextRequest, NextResponse } from 'next/server'
import { getOrUpdateRounds, getUserBetsForRounds } from '@/lib/game/memoryRounds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = (searchParams.get('asset') || 'btc').toLowerCase()
    const nowSec = Math.floor(Date.now() / 1000)

    const { liveRound, presaleRounds } = await getOrUpdateRounds(asset, nowSec)

    // Check if user is logged in
    const username = req.cookies.get('dlicom_user')?.value
    const activeRoundIds = [liveRound.id, ...presaleRounds.map((r) => r.id)]
    const userBets = username ? getUserBetsForRounds(username, activeRoundIds) : []

    return NextResponse.json({
      asset,
      liveRound: {
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
        odds: liveRound.odds,
      },
      presaleRounds: presaleRounds.map((r) => ({
        id: r.id,
        asset: r.asset,
        startAt: r.startAt,
        endAt: r.endAt,
        targetPrice: r.targetPrice ? Number(r.targetPrice) : null,
        status: r.status,
        poolUp: r.poolUp.toString(),
        poolDown: r.poolDown.toString(),
        odds: r.odds,
      })),
      userBets,
      serverTime: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch current rounds'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
