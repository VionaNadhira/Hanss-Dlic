import { NextRequest, NextResponse } from 'next/server'
import { getLatestPrice } from '@/lib/game/pyth'
import { addPriceTick } from '@/lib/game/memoryRounds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = searchParams.get('asset') || 'btc'

    const result = await getLatestPrice(asset)

    if (result && typeof result.price === 'number') {
      addPriceTick(asset, result.publishTime, result.price)
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch price'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
