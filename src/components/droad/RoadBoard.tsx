'use client'

import React from 'react'
import type { MascotState } from '@/lib/droad/game'
import MascotAnimation from './MascotAnimation'
import { MASCOT_ANCHOR, MASCOT_CELL, VEHICLE_SOURCES } from './mascotManifest'

export type Phase = 'waiting' | 'running' | 'knocked' | 'crossed'

interface RoadBoardProps {
  mascotState: MascotState
  phase: Phase
  /** 0..1 progress from the near kerb to the far kerb. */
  travel: number
  /** 1-based lane the mascot was knocked down on; null unless phase is knocked. */
  hitLane: number | null
  /** how many lanes are live this round, 1..5 */
  lanes: number
  /** Status copy drawn over the road. It does not contribute to the road's height. */
  children?: React.ReactNode
}

/**
 * The road always reserves five lanes so the board never resizes when the
 * lane count changes. Shoulders stay proportional to the road: the finish
 * shoulder keeps the mascot on screen at the far kerb, and the start
 * shoulder holds the mascot plus the instruction overlay.
 *
 * Percents of the road height. 10 + 14*5 + 20 = 100.
 */
const ROAD_LANES = 5
const FAR_PCT = 10
const LANE_PCT = 14
const NEAR_PCT = 20

/** Highest mascot pixel above the foot anchor, as a fraction of the cell. */
const MASCOT_BODY = MASCOT_ANCHOR.y - 31 / MASCOT_CELL
/** Cell scale that makes the mascot's body about 2.0 lanes tall. */
const MASCOT_LANE_SCALE = 2.0 / MASCOT_BODY
/**
 * Vehicle files are square with the car painted in roughly the middle half.
 * 1.25 × the lane paints that car at about 65% of the lane without stretching.
 */
const VEHICLE_LANE_SCALE = 1.25

const KERB = 'rgba(255,255,255,0.07)'
const MUTED = 'rgba(154,167,180,0.7)'

/** Lane centre as a fraction of the road height. Lane 0 is nearest. */
function laneCenterFrac(lane: number): number {
  return (FAR_PCT + (ROAD_LANES - 0.5 - lane) * LANE_PCT) / 100
}

const START_FRAC = (100 - NEAR_PCT / 2) / 100
const FINISH_FRAC = laneCenterFrac(ROAD_LANES - 1)

interface Lane {
  index: number
  vehicle: string
  offset: number
  speed: number
}

/** Deterministic layout, so a replayed round looks the same every time.
 *  Traffic flows one way only (left to right); no lane ever reverses, so cars
 *  read as a steady stream instead of bouncing back across the road. */
function buildLanes(): Lane[] {
  return Array.from({ length: ROAD_LANES }, (_, i) => {
    const r = ((i * 2654435761) % 997) / 997
    return {
      index: i,
      vehicle: VEHICLE_SOURCES[i % VEHICLE_SOURCES.length],
      offset: r,
      speed: 0.5 + ((i * 37) % 5) * 0.14,
    }
  })
}

/** 0..1 travel at which the mascot is knocked down on a given lane. It stops
 *  partway into the lane, so a loss on the last lane is visibly short of the
 *  far kerb. */
export function knockTravel(lane: number): number {
  const y = laneCenterFrac(lane - 1) + (LANE_PCT / 100) * 0.35
  return (y - START_FRAC) / (FINISH_FRAC - START_FRAC)
}

function pct(fraction: number): string {
  return `${fraction * 100}%`
}

export default function RoadBoard({
  mascotState,
  phase,
  travel,
  hitLane,
  lanes,
  children,
}: RoadBoardProps) {
  const all = React.useMemo(buildLanes, [])
  const [scroll, setScroll] = React.useState(0)
  const live = phase === 'running'

  // Traffic only moves while the round is live, at a fixed rate so the scene
  // reads identically on every device.
  React.useEffect(() => {
    if (!live) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) {
        last = now
        return
      }
      if (!last) {
        last = now
        return
      }
      const dt = Math.min(now - last, 64)
      last = now
      setScroll((prev) => prev + dt * 0.055)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live])

  const groundFrac = START_FRAC + (FINISH_FRAC - START_FRAC) * travel
  const down = phase === 'knocked'

  return (
    <div
      className="road-game absolute inset-0 h-full w-full overflow-hidden select-none"
      style={{
        ['--lane-height' as string]: `${LANE_PCT}cqh`,
        containerType: 'size',
      }}
    >
      <div
        className="road-background pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* finish shoulder marker, aligned to the road */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: pct(FAR_PCT / 100),
          height: 4,
          opacity: live ? 0.65 : 0.25,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 28px, transparent 28px 64px)',
          backgroundPositionX: `${-((scroll * 2) % 64)}px`,
        }}
      />

      {/* kerbs at the edges of the lane band */}
      {[FAR_PCT, FAR_PCT + ROAD_LANES * LANE_PCT].map((top) => (
        <div
          key={top}
          className="pointer-events-none absolute inset-x-0"
          style={{ top: `${top}%`, height: 2, background: KERB }}
        />
      ))}

      {all.map((lane) => {
        const active = lane.index < lanes
        const top = FAR_PCT + (ROAD_LANES - 1 - lane.index) * LANE_PCT
        const span = 108
        let position = (lane.offset * span + scroll * lane.speed) % span
        position = ((position % span) + span) % span
        const naturalX = position
        const isHitLane = hitLane !== null && lane.index + 1 === hitLane
        const hitTravel = hitLane !== null ? knockTravel(hitLane) : 1
        let x = naturalX
        if (lanes > 0) {
          if (phase === 'running' && isHitLane && hitTravel > 0.001) {
            const progress = Math.max(0, Math.min(1, travel / hitTravel))
            if (progress > 0.62) {
              const lerp = Math.min(1, (progress - 0.62) / 0.38)
              const eased = 1 - Math.pow(1 - lerp, 3)
              x = naturalX * (1 - eased) + 50 * eased
            }
          } else if ((phase === 'knocked' || phase === 'crossed') && isHitLane) {
            x = 50
          }
        }
        const struck = down && isHitLane
        return (
          <div
            key={lane.index}
            className="pointer-events-none absolute inset-x-0"
            style={{ top: `${top}%`, height: `${LANE_PCT}%` }}
          >
            {active && (
              <div
                className="absolute inset-x-0 top-0"
                style={{ height: 2, background: KERB }}
              />
            )}
            {active && (
              <img
                src={lane.vehicle}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute object-contain"
                style={{
                  height: `calc(var(--lane-height) * ${VEHICLE_LANE_SCALE})`,
                  width: 'auto',
                  
                  maxWidth: 'none',
                  top: '50%',
                  left: `${x}%`,
                  transform: `translate(-50%, -50%)`,
                  opacity: down && !struck ? 0.7 : 1,
                  filter: struck
                    ? 'drop-shadow(0 0 12px rgba(255,77,79,0.85))'
                    : 'drop-shadow(0 5px 9px rgba(0,0,0,0.55))',
                }}
              />
            )}
          </div>
        )
      })}

      {/* mascot: feet on the travel line, body fitted to one lane */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: pct(groundFrac),
          left: '50%',
          height: `calc(var(--lane-height) * ${MASCOT_LANE_SCALE})`,
          width: `calc(var(--lane-height) * ${MASCOT_LANE_SCALE})`,
          transform: `translate(-50%, -${MASCOT_ANCHOR.y * 100}%)`,
          zIndex: 4,
          opacity: down ? 0.94 : 1,
          filter: down
            ? 'grayscale(0.4) brightness(0.75) drop-shadow(0 6px 8px rgba(0,0,0,0.6))'
            : 'drop-shadow(0 9px 12px rgba(0,0,0,0.6))',
        }}
      >
        <MascotAnimation
          state={mascotState}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div
        className="pointer-events-none absolute font-bold uppercase"
        style={{
          top: pct(laneCenterFrac(0)),
          left: 12,
          transform: 'translateY(-50%)',
          zIndex: 5,
          fontSize: 'clamp(9px, 2.2cqh, 12px)',
          letterSpacing: 1,
          color: MUTED,
        }}
      >
        Start
      </div>
      <div
        className="pointer-events-none absolute font-bold uppercase"
        style={{
          top: pct(FAR_PCT / 200),
          right: 12,
          transform: 'translateY(-50%)',
          zIndex: 5,
          fontSize: 'clamp(9px, 2.2cqh, 12px)',
          letterSpacing: 1,
          color: MUTED,
        }}
      >
        Finish
      </div>

      {children != null && (
        <div
          className="road-instruction pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-2 px-3 text-center"
          style={{ bottom: 'clamp(10px, 2.6cqh, 28px)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
