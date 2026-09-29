import { NextRequest, NextResponse } from 'next/server'
import { runLazySync } from '@/lib/game/rounds'
import { MARKETS } from '@/lib/game/markets'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || req.headers.get('x-cron-secret')
    const secret = process.env.CRON_SECRET || 'hanss_cron_secret_key_123'

    if (!token || token !== secret) {
      return NextResponse.json({ error: 'Unauthorized cron tick' }, { status: 401 })
    }

    // Run sync for all supported markets
    const assets = Object.keys(MARKETS)
    await Promise.all(assets.map((asset) => runLazySync(asset)))

    return NextResponse.json({
      success: true,
      syncedAssets: assets,
      serverTime: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron tick failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
