import { db } from '../db/client'
import { priceTicks } from '../db/schema'
import { and, eq, gte, lte, sql } from 'drizzle-orm'

export interface PriceResult {
  asset: string
  price: number
  publishTime: number
  serverTime: number
}

// In-memory cache for 1 second to avoid upstream multi-calls
interface CacheEntry {
  price: number
  publishTime: number
  fetchedAt: number
}

const memoryCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 1000

// In-memory timestamp to throttle database tick writes to at most once per second per asset
const lastTickSaved = new Map<string, number>()

const ASSET_TO_FEED: Record<string, string> = {
  btc: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  eth: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  sol: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
}

const FEED_TO_ASSET: Record<string, string> = {
  e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43: 'btc',
  ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace: 'eth',
  ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d: 'sol',
}

/**
 * Fetch latest price for asset ('btc', 'eth', 'sol').
 * Checks 1s in-memory cache first.
 * Saves price tick to DB at most once per second.
 */
export async function getLatestPrice(assetInput: string): Promise<PriceResult> {
  const asset = assetInput.toLowerCase()
  const now = Date.now()
  const cached = memoryCache.get(asset)

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      asset,
      price: cached.price,
      publishTime: cached.publishTime,
      serverTime: now,
    }
  }

  const feedId = ASSET_TO_FEED[asset] || asset
  let price: number | null = null
  let publishTime = Math.floor(now / 1000)

  // 1. Try Pyth Hermes endpoint
  const pythKey = process.env.PYTH_API_KEY
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (pythKey) {
      headers.Authorization = `Bearer ${pythKey}`
    }
    const res = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}&parsed=true`,
      { headers, signal: AbortSignal.timeout(3000), cache: 'no-store' }
    )
    if (res.ok) {
      const data = await res.json()
      const item = data.parsed?.[0] || data[0]
      if (item?.price) {
        const raw = Number(item.price.price)
        const expo = Number(item.price.expo)
        price = +(raw * Math.pow(10, expo)).toFixed(4)
        publishTime = Number(item.price.publish_time) || publishTime
      }
    }
  } catch {}

  // 2. High-precision live fallback to public spot feed (Coinbase API) if Pyth key is absent
  if (price === null) {
    try {
      const symbolMap: Record<string, string> = {
        btc: 'BTC-USD',
        eth: 'ETH-USD',
        sol: 'SOL-USD',
      }
      const pair = symbolMap[asset] || `${asset.toUpperCase()}-USD`
      const res = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`, {
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        const rawAmount = parseFloat(json?.data?.amount)
        if (!isNaN(rawAmount) && rawAmount > 0) {
          price = +rawAmount.toFixed(4)
          publishTime = Math.floor(Date.now() / 1000)
        }
      }
    } catch {}
  }

  // 3. Last fallback: most recent recorded price tick in database
  if (price === null) {
    try {
      const row = await db.query.priceTicks.findFirst({
        where: eq(priceTicks.asset, asset),
        orderBy: (p, { desc }) => [desc(p.ts)],
      })
      if (row) {
        price = Number(row.price)
        publishTime = row.ts
      }
    } catch {}
  }

  if (price === null) {
    throw new Error(`Failed to retrieve price for ${asset}`)
  }

  // Update memory cache
  memoryCache.set(asset, {
    price,
    publishTime,
    fetchedAt: now,
  })

  // Opportunistically write tick to database at most once per second
  const lastSaved = lastTickSaved.get(asset) || 0
  if (now - lastSaved >= 1000) {
    lastTickSaved.set(asset, now)
    void recordTick(asset, publishTime, price)
  }

  return {
    asset,
    price,
    publishTime,
    serverTime: now,
  }
}

/**
 * Record a price tick to the database and purge ticks older than 2 hours.
 */
async function recordTick(asset: string, ts: number, price: number) {
  try {
    await db.insert(priceTicks).values({
      asset,
      ts,
      price: price.toString(),
    })

    // Opportunistically delete rows older than 2 hours (7200 seconds)
    const cutoff = ts - 7200
    // Run cleanup occasionally (1 in 50 chance per tick write)
    if (Math.random() < 0.02) {
      await db.delete(priceTicks).where(lte(priceTicks.ts, cutoff))
    }
  } catch (err) {
    // Non-blocking tick recording
    console.error(`[recordTick] Error writing tick for ${asset}:`, err)
  }
}

/**
 * Helper getPriceAt(feedId, unixSeconds) using Pyth historical endpoint with retries and DB fallback.
 */
export async function getPriceAt(feedId: string, unixSeconds: number): Promise<number | null> {
  const asset = FEED_TO_ASSET[feedId] || 'btc'
  const pythKey = process.env.PYTH_API_KEY

  // Retry up to 3 times with short backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (pythKey) {
        headers.Authorization = `Bearer ${pythKey}`
      }
      const res = await fetch(
        `https://hermes.pyth.network/v2/updates/price/${unixSeconds}?ids[]=${feedId}&parsed=true`,
        { headers, signal: AbortSignal.timeout(3000), cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        const item = data.parsed?.[0] || data[0]
        if (item?.price) {
          const raw = Number(item.price.price)
          const expo = Number(item.price.expo)
          return +(raw * Math.pow(10, expo)).toFixed(4)
        }
      }
    } catch {}

    // Backoff wait (100ms, 250ms, 500ms)
    await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)))
  }

  // Fallback: check local price_ticks table within ±30 seconds of unixSeconds
  try {
    const ticks = await db
      .select()
      .from(priceTicks)
      .where(
        and(
          eq(priceTicks.asset, asset),
          gte(priceTicks.ts, unixSeconds - 30),
          lte(priceTicks.ts, unixSeconds + 30)
        )
      )
      .orderBy(sql`ABS(ts - ${unixSeconds})`)
      .limit(1)

    if (ticks.length > 0) {
      return Number(ticks[0].price)
    }
  } catch {}

  // If timestamp is recent (within last 3 minutes), get latest live price
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - unixSeconds) < 180) {
    try {
      const latest = await getLatestPrice(asset)
      return latest.price
    } catch {}
  }

  return null
}
