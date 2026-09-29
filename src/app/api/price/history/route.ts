import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { priceTicks } from '@/lib/db/schema'
import { and, eq, gte } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = (searchParams.get('asset') || 'btc').toLowerCase()
    const fromStr = searchParams.get('from')
    const fromTs = fromStr ? parseInt(fromStr, 10) : Math.floor(Date.now() / 1000) - 300

    const rows = await db
      .select({
        ts: priceTicks.ts,
        price: priceTicks.price,
      })
      .from(priceTicks)
      .where(and(eq(priceTicks.asset, asset), gte(priceTicks.ts, fromTs)))
      .orderBy(priceTicks.ts)
      .limit(350)

    const ticks = rows.map((r) => ({
      ts: r.ts,
      price: Number(r.price),
    }))

    return NextResponse.json({
      asset,
      from: fromTs,
      ticks,
      serverTime: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch price history'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
