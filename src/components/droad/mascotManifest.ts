import type { MascotState } from '@/lib/droad/game'

/**
 * Dlicom Road - mascot frame metadata.
 *
 * Mirrors `public/droad/animations/manifest.json`, which is written by
 * `tools/droad/generate_frames.py`. Keep the two in step: the generator is the
 * source of truth for frame counts, cell size and the ground anchor.
 */
export interface StateMeta {
  frames: number
  fps: number
  /** false = play once and hold the final frame */
  loop: boolean
  /** first frame of the seamless cycle, for one-shot lead-ins */
  loopFrom: number
}

export const MASCOT_CELL = 448
export const MASCOT_MASTER = 1280
/** anchor inside a cell: where the mascot's feet meet the road */
export const MASCOT_ANCHOR = { x: 0.5, y: 0.734375 }

export const MASCOT_STATES: Record<MascotState, StateMeta> = {
  idle: { frames: 8, fps: 12, loop: true, loopFrom: 0 },
  run: { frames: 12, fps: 14, loop: true, loopFrom: 0 },
  step: { frames: 7, fps: 12, loop: false, loopFrom: 7 },
  hit: { frames: 14, fps: 12, loop: false, loopFrom: 14 },
  win: { frames: 10, fps: 12, loop: true, loopFrom: 2 },
}

export const MASCOT_SHEETS: Record<MascotState, string> = {
  idle: '/droad/animations/mascot-idle.webp',
  run: '/droad/animations/mascot-run.webp',
  step: '/droad/animations/mascot-step.webp',
  hit: '/droad/animations/mascot-hit.webp',
  win: '/droad/animations/mascot-win.webp',
}

export const VEHICLE_SOURCES = [
  '/droad/vehicles/vehicle-01.webp',
  '/droad/vehicles/vehicle-02.webp',
  '/droad/vehicles/vehicle-03.webp',
] as const

/** Frames the road is scrolling before the first bet - the common case. */
export const PRELOAD_EARLY: MascotState[] = ['idle', 'run']
/** Only needed once a bet is live, so they are held back until then. */
export const PRELOAD_LATE: MascotState[] = ['step', 'hit', 'win']

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load ${src}`))
    img.src = src
  })
}

/**
 * Warm the sprite sheets. Callers should not block on this: every sheet decodes
 * into the same Image element pool, and a state that has not loaded yet simply
 * renders its first frame rather than stalling the board.
 */
export function preloadMascot(states: MascotState[]): Promise<void> {
  return Promise.all(
    states.map((state) => loadImage(MASCOT_SHEETS[state]).catch(() => undefined)),
  ).then(() => undefined)
}
