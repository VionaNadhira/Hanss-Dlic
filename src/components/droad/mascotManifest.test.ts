import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  MASCOT_CELL,
  MASCOT_MASTER,
  MASCOT_ANCHOR,
  MASCOT_SHEETS,
  MASCOT_STATES,
} from './mascotManifest'
import { knockTravel } from './RoadBoard'

/**
 * `public/droad/animations/manifest.json` is written by
 * `tools/droad/generate_frames.py`; `mascotManifest.ts` mirrors it for the
 * runtime. These assertions fail if the generator is re-run with different
 * frame counts or timings and the mirror is not updated with it.
 */
const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../public/droad/animations/manifest.json', import.meta.url)),
    'utf8',
  ),
) as {
  cell: number
  master: number
  anchor: { x: number; y: number }
  states: Record<string, { frames: number; fps: number; loop: boolean; loopFrom: number }>
}

describe('mascot manifest mirror', () => {
  it('matches the generated cell size, master size and anchor', () => {
    expect(MASCOT_CELL).toBe(manifest.cell)
    expect(MASCOT_MASTER).toBe(manifest.master)
    expect(MASCOT_ANCHOR).toEqual(manifest.anchor)
  })

  it('has an entry for every generated state, with identical timing', () => {
    expect(Object.keys(MASCOT_STATES).sort()).toEqual(Object.keys(manifest.states).sort())
    for (const [state, meta] of Object.entries(manifest.states)) {
      expect(MASCOT_STATES[state as keyof typeof MASCOT_STATES]).toEqual(meta)
    }
  })

  it('points every state at a sheet named after it', () => {
    for (const state of Object.keys(MASCOT_STATES)) {
      expect(MASCOT_SHEETS[state as keyof typeof MASCOT_SHEETS]).toBe(
        `/droad/animations/mascot-${state}.webp`,
      )
    }
  })
})

describe('knockTravel', () => {
  it('increases with the lane and never reaches the finish', () => {
    const values = [1, 2, 3, 4, 5].map(knockTravel)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
    // Being knocked down on the last lane still has to fall short of the win.
    expect(values[values.length - 1]).toBeLessThan(1)
    expect(knockTravel(1)).toBeGreaterThan(0)
  })
})
