/**
 * Dlicom Road - round rules.
 *
 * The mascot has to cross a run of traffic lanes. Every lane is an independent
 * "is there a gap" check; the player clears the whole crossing or is knocked
 * down at the first lane that catches them.
 *
 * Everything in this module is pure. The round outcome is resolved from a
 * single uniform random value the moment the bet is placed, well before any
 * animation runs, so the mascot's frames are a *replay* of a decision that has
 * already been made rather than a thing that decides the payout.
 */

export const LANE_OPTIONS = [1, 2, 3, 4, 5] as const
export type Lanes = (typeof LANE_OPTIONS)[number]

/** Chance of clearing one lane. */
export const SURVIVE_P = 0.62
/** Share of every bet returned on a win. The rest is the margin. */
export const RTP = 0.97

export const MAX_BET = 10000
export const MIN_BET = 0.1

export type MascotState = 'idle' | 'run' | 'step' | 'hit' | 'win'

export interface RunOutcome {
  /** Lane the mascot was knocked down on, or null when it crossed cleanly. */
  hitLane: number | null
  lanes: number
  multiplier: number
  won: boolean
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function clampLanes(n: number): number {
  return Math.min(LANE_OPTIONS[LANE_OPTIONS.length - 1], Math.max(1, Math.round(n)))
}

/**
 * Payout multiplier for a crossing of `lanes` lanes.
 *
 * Derived from the odds rather than picked by hand, so the advertised return
 * is exactly RTP at every tier: multiplier = RTP / P(clear all lanes).
 */
export function multiplierFor(lanes: number): number {
  return round2(RTP / Math.pow(SURVIVE_P, clampLanes(lanes)))
}

export function payoutFor(bet: number, lanes: number, won: boolean): number {
  return won ? round2(bet * multiplierFor(lanes)) : 0
}

/**
 * Resolve a crossing from one uniform draw in [0, 1).
 *
 * Inverse-transform sampling: each lane consumes the draw, and clearing a lane
 * rescales what is left back to a fresh uniform. So the chance of getting
 * through lane 1 is P, through lanes 1-2 is P^2, and so on, and the lane the
 * mascot actually falls on is known up front.
 */
export function resolveRun(u: number, lanes: number): RunOutcome {
  const n = clampLanes(lanes)
  const mult = multiplierFor(n)
  let t = Math.min(Math.max(u, 0), 0.9999999999)

  for (let lane = 1; lane <= n; lane++) {
    if (t < SURVIVE_P) {
      // Conditioned on having cleared, the draw is uniform in [0, SURVIVE_P);
      // rescaling it back to [0, 1) leaves every later lane independent.
      t /= SURVIVE_P
      continue
    }
    return { hitLane: lane, lanes: n, multiplier: mult, won: false }
  }
  return { hitLane: null, lanes: n, multiplier: mult, won: true }
}

/** Uniform draw in [0, 1) from a hex seed, so a round can be re-checked. */
export function uniformFromSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** A fresh round seed from the platform CSPRNG. */
export function newRoundSeed(): string {
  const buf = new Uint32Array(2)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    buf[0] = Math.floor(Math.random() * 0xffffffff)
    buf[1] = Math.floor(Math.random() * 0xffffffff)
  }
  return buf[0].toString(16).padStart(8, '0') + buf[1].toString(16).padStart(8, '0')
}

export function resolveFromSeed(seed: string, lanes: number): RunOutcome {
  return resolveRun(uniformFromSeed(seed), lanes)
}
