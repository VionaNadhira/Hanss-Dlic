import { describe, it, expect } from 'vitest'
import { getUserTier, getStreakSecondsLeft } from './tiers'

describe('Tier and Streak Logic', () => {
  it('correctly maps scores to tiers', () => {
    const bronze = getUserTier(1000)
    expect(bronze.currentTier).toBe('Bronze')
    expect(bronze.nextTier).toBe('Silver')
    expect(bronze.pointsToNextTier).toBe(300) // 1300 - 1000

    const silver = getUserTier(1300)
    expect(silver.currentTier).toBe('Silver')
    expect(silver.nextTier).toBe('Gold')
    expect(silver.pointsToNextTier).toBe(500) // 1800 - 1300

    const diamond = getUserTier(6000)
    expect(diamond.currentTier).toBe('Diamond')
    expect(diamond.nextTier).toBeNull()
    expect(diamond.pointsToNextTier).toBe(0)
    expect(diamond.progressPercent).toBe(100)
  })

  it('handles negative or zero score gracefully', () => {
    const zero = getUserTier(0)
    expect(zero.currentTier).toBe('Bronze')
    expect(zero.pointsToNextTier).toBe(1300)

    const neg = getUserTier(-50)
    expect(neg.currentTier).toBe('Bronze')
    expect(neg.pointsToNextTier).toBe(1300)
  })

  it('calculates streak seconds left until UTC midnight', () => {
    const seconds = getStreakSecondsLeft('2026-09-29')
    expect(seconds).toBeGreaterThanOrEqual(0)
    expect(seconds).toBeLessThanOrEqual(86400)

    expect(getStreakSecondsLeft(null)).toBe(0)
  })
})
