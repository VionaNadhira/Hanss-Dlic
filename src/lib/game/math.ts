export interface Pools {
  poolUp: bigint
  poolDown: bigint
}

export interface Seeds {
  houseSeedUp: bigint
  houseSeedDown: bigint
}

export interface OddsResult {
  chanceUp: number // 0.0 to 1.0
  chanceDown: number // 0.0 to 1.0
  multiplierUp: number // e.g. 1.96
  multiplierDown: number // e.g. 1.96
  effectiveUp: bigint
  effectiveDown: bigint
  total: bigint
}

export interface BetRecord {
  id: string
  userId: number
  side: 'up' | 'down'
  amount: bigint
}

export interface PayoutResult {
  betId: string
  userId: number
  side: 'up' | 'down'
  amount: bigint
  payout: bigint
  status: 'won' | 'lost' | 'refunded'
}

/**
 * Parimutuel odds calculation with virtual house seed.
 */
export function computeOdds(
  pools: Pools,
  seeds: Seeds = { houseSeedUp: 1000n, houseSeedDown: 1000n },
  feeBps = 200
): OddsResult {
  const effectiveUp = pools.poolUp + seeds.houseSeedUp
  const effectiveDown = pools.poolDown + seeds.houseSeedDown
  const total = effectiveUp + effectiveDown

  if (total <= 0n) {
    return {
      chanceUp: 0.5,
      chanceDown: 0.5,
      multiplierUp: 1.0,
      multiplierDown: 1.0,
      effectiveUp: 0n,
      effectiveDown: 0n,
      total: 0n,
    }
  }

  const chanceUp = Number(effectiveUp) / Number(total)
  const chanceDown = Number(effectiveDown) / Number(total)

  const feeFactor = BigInt(Math.max(0, 10000 - feeBps))

  // multiplier * 10000 = floor(total * (10000 - feeBps) / effectiveSide)
  const rawMultUp = effectiveUp > 0n ? (total * feeFactor) / effectiveUp : 10000n
  const rawMultDown = effectiveDown > 0n ? (total * feeFactor) / effectiveDown : 10000n

  const multUp = Math.max(1.0, Number(rawMultUp) / 10000)
  const multDown = Math.max(1.0, Number(rawMultDown) / 10000)

  return {
    chanceUp,
    chanceDown,
    multiplierUp: +multUp.toFixed(2),
    multiplierDown: +multDown.toFixed(2),
    effectiveUp,
    effectiveDown,
    total,
  }
}

/**
 * Settlement payouts calculation.
 * All math in integer points (BigInt).
 */
export function computePayouts(
  bets: BetRecord[],
  result: 'up' | 'down' | 'void' | null,
  pools: Pools,
  seeds: Seeds = { houseSeedUp: 1000n, houseSeedDown: 1000n },
  feeBps = 200
): PayoutResult[] {
  if (bets.length === 0) {
    return []
  }

  // 1. If round is void, refund all user bets in full
  if (result === 'void' || result === null) {
    return bets.map((b) => ({
      betId: b.id,
      userId: b.userId,
      side: b.side,
      amount: b.amount,
      payout: b.amount,
      status: 'refunded',
    }))
  }

  const winningUserPool = result === 'up' ? pools.poolUp : pools.poolDown

  // 2. Edge case: If winning side has 0 user stake, refund all user stakes
  if (winningUserPool === 0n) {
    return bets.map((b) => ({
      betId: b.id,
      userId: b.userId,
      side: b.side,
      amount: b.amount,
      payout: b.amount,
      status: 'refunded',
    }))
  }

  const effectiveUp = pools.poolUp + seeds.houseSeedUp
  const effectiveDown = pools.poolDown + seeds.houseSeedDown
  const total = effectiveUp + effectiveDown
  const effectiveWinningSide = result === 'up' ? effectiveUp : effectiveDown
  const feeFactor = BigInt(Math.max(0, 10000 - feeBps))

  // Payout per winning bet:
  // floor(amount * total * (10000 - feeBps) / (10000 * effectiveWinningSide))
  return bets.map((bet) => {
    if (bet.side !== result) {
      return {
        betId: bet.id,
        userId: bet.userId,
        side: bet.side,
        amount: bet.amount,
        payout: 0n,
        status: 'lost',
      }
    }

    const numerator = bet.amount * total * feeFactor
    const denominator = 10000n * effectiveWinningSide
    const payout = denominator > 0n ? numerator / denominator : bet.amount

    return {
      betId: bet.id,
      userId: bet.userId,
      side: bet.side,
      amount: bet.amount,
      payout,
      status: 'won',
    }
  })
}

/**
 * Determine round winner given target price and final settled price.
 * Rule: finalPrice >= targetPrice => "up" (a tie is Up), else "down".
 */
export function determineWinner(targetPrice: number, finalPrice: number): 'up' | 'down' {
  return finalPrice >= targetPrice ? 'up' : 'down'
}
