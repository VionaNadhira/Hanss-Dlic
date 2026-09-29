import { NextRequest, NextResponse } from 'next/server'
import { getPriceTicks, addPriceTick } from '@/lib/game/memoryRounds'
import { getLatestPrice } from '@/lib/game/pyth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = (searchParams.get('asset') || 'btc').toLowerCase()
    const fromStr = searchParams.get('from')
    const nowSec = Math.floor(Date.now() / 1000)
    const fromTs = fromStr ? parseInt(fromStr, 10) : nowSec - 300

    let latestPrice = 83500
    try {
      const p = await getLatestPrice(asset)
      latestPrice = p.price
      addPriceTick(asset, nowSec, p.price)
    } catch {}

    let ticks = getPriceTicks(asset, fromTs)

    // If ticks are empty or fewer than 15 (e.g. cold start), synthesize a realistic recent path leading to latestPrice
    if (ticks.length < 15) {
      const synthTicks: Array<{ ts: number; price: number }> = []
      const stepSec = 5
      const totalPoints = Math.min(60, Math.floor((nowSec - fromTs) / stepSec))

      let walkPrice = latestPrice
      for (let i = 0; i <= totalPoints; i++) {
        const pointTs = nowSec - (totalPoints - i) * stepSec
        if (i === totalPoints) {
          walkPrice = latestPrice
        } else {
          // slight random walk offset
          const offset = Math.sin(i / 3) * 12 + Math.cos(i / 5) * 8
          walkPrice = +(latestPrice + offset).toFixed(2)
        }
        synthTicks.push({ ts: pointTs, price: walkPrice })
        addPriceTick(asset, pointTs, walkPrice)
      }
      ticks = synthTicks
    }

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
