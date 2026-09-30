import { describe, it, expect } from 'vitest'
import {
  LANE_OPTIONS,
  SURVIVE_P,
  RTP,
  MAX_BET,
  multiplierFor,
  payoutFor,
  resolveRun,
  uniformFromSeed,
  newRoundSeed,
  resolveFromSeed,
} from './game'

/** Fraction of the [0,1) range that clears a crossing of `lanes`. */
function clearFraction(lanes: number, samples = 200000): number {
  let clear = 0
  for (let i = 0; i < samples; i++) {
    if (resolveRun(i / samples, lanes).won) clear++
  }
  return clear / samples
}

describe('Dlicom Road multipliers', () => {
  it('offers five lane tiers', () => {
    expect(LANE_OPTIONS).toEqual([1, 2, 3, 4, 5])
  })

  it('pays RTP on every tier', () => {
    for (const lanes of LANE_OPTIONS) {
      const p = Math.pow(SURVIVE_P, lanes)
      expect(multiplierFor(lanes) * p).toBeCloseTo(RTP, 2)
    }
  })

  it('rewards longer crossings', () => {
    const mults = LANE_OPTIONS.map(multiplierFor)
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1])
    }
  })

  it('clamps out-of-range lane counts', () => {
    expect(multiplierFor(0)).toBe(multiplierFor(1))
    expect(multiplierFor(99)).toBe(multiplierFor(5))
  })

  it('pays the bet times the multiplier on a win and nothing on a loss', () => {
    expect(payoutFor(20, 3, true)).toBe(round2ish(20 * multiplierFor(3)))
    expect(payoutFor(20, 3, false)).toBe(0)
  })
})

function round2ish(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

describe('Dlicom Road outcome resolution', () => {
  it('is decided by the draw alone, with no animation input', () => {
    const a = resolveRun(0.1, 3)
    const b = resolveRun(0.1, 3)
    expect(a).toEqual(b)
  })

  it('matches the advertised clear chance at every tier', () => {
    for (const lanes of LANE_OPTIONS) {
      expect(clearFraction(lanes)).toBeCloseTo(Math.pow(SURVIVE_P, lanes), 2)
    }
  })

  it('always reports a hit lane inside the crossing, or a clean finish', () => {
    for (let i = 0; i < 5000; i++) {
      const u = i / 5000
      for (const lanes of LANE_OPTIONS) {
        const r = resolveRun(u, lanes)
        if (r.won) {
          expect(r.hitLane).toBeNull()
        } else {
          expect(r.hitLane).not.toBeNull()
          expect(r.hitLane!).toBeGreaterThanOrEqual(1)
          expect(r.hitLane!).toBeLessThanOrEqual(lanes)
        }
      }
    }
  })

  it('fails on lane 1 for any draw above the first threshold', () => {
    for (let i = 0; i < 1000; i++) {
      const u = SURVIVE_P + (i / 1000) * (1 - SURVIVE_P)
      const r = resolveRun(u, 5)
      expect(r.hitLane).toBe(1)
    }
  })

  it('treats the extremes of the draw range', () => {
    expect(resolveRun(0, 5).won).toBe(true)
    expect(resolveRun(0.9999999999, 5).won).toBe(false)
    expect(resolveRun(-5, 1).won).toBe(true)
  })
})

describe('Dlicom Road seeds', () => {
  it('reproduces a round from its seed', () => {
    const seed = newRoundSeed()
    expect(resolveFromSeed(seed, 4)).toEqual(resolveFromSeed(seed, 4))
  })

  it('produces draws inside [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const u = uniformFromSeed(newRoundSeed())
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
    }
  })

  it('spreads seeds across the whole range', () => {
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 5000; i++) {
      buckets[Math.floor(uniformFromSeed(newRoundSeed()) * 10)]++
    }
    for (const b of buckets) expect(b).toBeGreaterThan(200)
  })

  it('gives different results for different seeds', () => {
    const seeds = Array.from({ length: 20 }, () => newRoundSeed())
    const results = new Set(seeds.map((s) => JSON.stringify(resolveFromSeed(s, 3))))
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('Dlicom Road bet limits', () => {
  it('keeps the maximum bet at the platform limit', () => {
    expect(MAX_BET).toBe(10000)
  })
})
