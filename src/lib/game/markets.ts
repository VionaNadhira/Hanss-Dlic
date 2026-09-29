import { getPriceAt } from './pyth'
import type { Round } from '../db/schema'

export type SettleMode = 'spot' | 'twap60'

export interface MarketConfig {
  id: string
  label: string
  asset: string
  pythFeedId: string
  durationSec: number
  settleMode: SettleMode
}

export const MARKETS: Record<string, MarketConfig> = {
  btc: {
    id: 'btc',
    asset: 'btc',
    label: 'BTC/USD',
    // Verified official Pyth Hermes feed ID for Bitcoin / US Dollar
    pythFeedId: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    durationSec: 300,
    settleMode: 'spot',
  },
  eth: {
    id: 'eth',
    asset: 'eth',
    label: 'ETH/USD',
    // Verified official Pyth Hermes feed ID for Ethereum / US Dollar
    pythFeedId: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    durationSec: 300,
    settleMode: 'spot',
  },
  sol: {
    id: 'sol',
    asset: 'sol',
    label: 'SOL/USD',
    // Verified official Pyth Hermes feed ID for Solana / US Dollar
    pythFeedId: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    durationSec: 300,
    settleMode: 'spot',
  },
}

export function getMarket(asset: string): MarketConfig {
  const m = MARKETS[asset.toLowerCase()]
  if (!m) {
    throw new Error(`Unsupported market asset: ${asset}`)
  }
  return m
}

export async function resolveFinalPrice(market: MarketConfig, round: Round): Promise<number | null> {
  if (market.settleMode === 'spot') {
    return await getPriceAt(market.pythFeedId, round.endAt)
  }
  if (market.settleMode === 'twap60') {
    // Pluggable TWAP 60-second window if enabled in future
    const timestamps = [
      round.endAt - 60,
      round.endAt - 40,
      round.endAt - 20,
      round.endAt,
    ]
    const prices = await Promise.all(timestamps.map((t) => getPriceAt(market.pythFeedId, t)))
    const valid = prices.filter((p): p is number => p !== null)
    if (valid.length === 0) return null
    return valid.reduce((a, b) => a + b, 0) / valid.length
  }
  throw new Error(`Unknown settleMode: ${market.settleMode}`)
}
