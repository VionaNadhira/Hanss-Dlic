import { NextRequest, NextResponse } from 'next/server'
import { getRecentResolvedRounds, getOrUpdateRounds } from '@/lib/game/memoryRounds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = (searchParams.get('asset') || 'btc').toLowerCase()
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Trigger update/check first so resolved rounds are populated
    const nowSec = Math.floor(Date.now() / 1000)
    await getOrUpdateRounds(asset, nowSec)

    const resolved = getRecentResolvedRounds(asset, limit)

    const mapped = resolved.map((r) => ({
      id: r.id,
      asset: r.asset,
      startAt: r.startAt,
      endAt: r.endAt,
      targetPrice: r.targetPrice ? Number(r.targetPrice) : null,
      finalPrice: r.finalPrice ? Number(r.finalPrice) : null,
      status: r.status,
      result: r.result as 'up' | 'down' | null,
      poolUp: r.poolUp.toString(),
      poolDown: r.poolDown.toString(),
    }))

    return NextResponse.json({
      asset,
      rounds: mapped,
      serverTime: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch recent rounds'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
