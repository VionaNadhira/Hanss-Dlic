import { describe, it, expect } from 'vitest'
import { computeOdds, computePayouts, determineWinner } from './math'

describe('Math & Payout Pure Logic', () => {
  it('determines winner where tie goes to Up', () => {
    expect(determineWinner(50000, 50001)).toBe('up')
    expect(determineWinner(50000, 50000)).toBe('up') // tie is up
    expect(determineWinner(50000, 49999.99)).toBe('down')
  })

  it('computes parimutuel odds correctly with house seeds', () => {
    // Empty user pools: 1000 seed each side => 50/50 chance, 1.96x multiplier (2% fee)
    const emptyOdds = computeOdds({ poolUp: 0n, poolDown: 0n }, { houseSeedUp: 1000n, houseSeedDown: 1000n }, 200)
    expect(emptyOdds.chanceUp).toBe(0.5)
    expect(emptyOdds.chanceDown).toBe(0.5)
    expect(emptyOdds.multiplierUp).toBe(1.96)
    expect(emptyOdds.multiplierDown).toBe(1.96)

    // Asymmetric pools
    const asymOdds = computeOdds({ poolUp: 3000n, poolDown: 1000n }, { houseSeedUp: 1000n, houseSeedDown: 1000n }, 200)
    // effectiveUp = 4000, effectiveDown = 2000, total = 6000
    // chanceUp = 4000/6000 = 0.6667
    // multUp = floor(6000 * 9800 / 4000) / 10000 = 14700 / 10000 = 1.47x
    // multDown = floor(6000 * 9800 / 2000) / 10000 = 29400 / 10000 = 2.94x
    expect(+asymOdds.chanceUp.toFixed(2)).toBe(0.67)
    expect(asymOdds.multiplierUp).toBe(1.47)
    expect(asymOdds.multiplierDown).toBe(2.94)
  })

  it('handles void rounds with 100% refund for all users', () => {
    const bets = [
      { id: 'b1', userId: 1, side: 'up' as const, amount: 250n },
      { id: 'b2', userId: 2, side: 'down' as const, amount: 500n },
    ]
    const payouts = computePayouts(bets, 'void', { poolUp: 250n, poolDown: 500n })
    expect(payouts).toHaveLength(2)
    expect(payouts[0].status).toBe('refunded')
    expect(payouts[0].payout).toBe(250n)
    expect(payouts[1].status).toBe('refunded')
    expect(payouts[1].payout).toBe(500n)
  })

  it('refunds all users if winning side has zero user stake (one-sided pool edge case)', () => {
    // Only Down has user bets, but Up won
    const bets = [
      { id: 'b1', userId: 1, side: 'down' as const, amount: 1000n },
    ]
    const payouts = computePayouts(bets, 'up', { poolUp: 0n, poolDown: 1000n })
    expect(payouts).toHaveLength(1)
    expect(payouts[0].status).toBe('refunded')
    expect(payouts[0].payout).toBe(1000n)
  })

  it('calculates winning payouts and ensures payouts do not exceed total pool after fee', () => {
    const bets = [
      { id: 'b1', userId: 1, side: 'up' as const, amount: 600n },
      { id: 'b2', userId: 2, side: 'up' as const, amount: 400n },
      { id: 'b3', userId: 3, side: 'down' as const, amount: 1000n },
    ]
    const pools = { poolUp: 1000n, poolDown: 1000n }
    const seeds = { houseSeedUp: 1000n, houseSeedDown: 1000n }
    const feeBps = 200

    const payouts = computePayouts(bets, 'up', pools, seeds, feeBps)
    expect(payouts[0].status).toBe('won')
    expect(payouts[1].status).toBe('won')
    expect(payouts[2].status).toBe('lost')
    expect(payouts[2].payout).toBe(0n)

    // total user pool = 2000
    // total with seed = 4000
    // effectiveUp = 2000
    // mult = 4000 * 9800 / 2000 / 10000 = 1.96
    // b1: 600 * 1.96 = 1176
    // b2: 400 * 1.96 = 784
    expect(payouts[0].payout).toBe(1176n)
    expect(payouts[1].payout).toBe(784n)

    const totalPaidToUsers = payouts.reduce((acc, p) => acc + p.payout, 0n)
    const totalUserPool = pools.poolUp + pools.poolDown
    // Total paid should never exceed user pool plus whatever house seed contributes
    expect(totalPaidToUsers).toBe(1960n)
    expect(totalPaidToUsers).toBeLessThanOrEqual(totalUserPool)
  })

  it('handles empty round bets list safely', () => {
    const payouts = computePayouts([], 'up', { poolUp: 0n, poolDown: 0n })
    expect(payouts).toEqual([])
  })
})
