import { NextRequest, NextResponse } from 'next/server'
import { getLatestPrice } from '@/lib/game/pyth'
import { runLazySync } from '@/lib/game/rounds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const asset = searchParams.get('asset') || 'btc'

    // Run lazy sync in background without blocking
    void runLazySync(asset)

    const result = await getLatestPrice(asset)

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch price'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
