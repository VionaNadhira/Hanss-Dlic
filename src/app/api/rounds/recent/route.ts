import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { rounds } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = (searchParams.get('asset') || 'btc').toLowerCase()
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const rows = await db
      .select({
        id: rounds.id,
        asset: rounds.asset,
        startAt: rounds.startAt,
        endAt: rounds.endAt,
        targetPrice: rounds.targetPrice,
        finalPrice: rounds.finalPrice,
        status: rounds.status,
        result: rounds.result,
        poolUp: rounds.poolUp,
        poolDown: rounds.poolDown,
      })
      .from(rounds)
      .where(and(eq(rounds.asset, asset), inArray(rounds.status, ['resolved', 'void'])))
      .orderBy(desc(rounds.endAt))
      .limit(limit)

    const mapped = rows.map((r) => ({
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
