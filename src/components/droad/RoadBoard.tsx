'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { MascotState } from '@/lib/droad/game'
import MascotAnimation from './MascotAnimation'
import { MASCOT_ANCHOR, VEHICLE_SOURCES } from './mascotManifest'

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
}

/** Road geometry, in CSS pixels. The road always reserves five lanes so the
 *  board never resizes when the lane count changes. */
const LANE_H = 40
const FAR_H = 76
const NEAR_H = 56
const ROAD_LANES = 5
const BOARD_H = FAR_H + ROAD_LANES * LANE_H + NEAR_H

/** On-screen size of one sprite cell. The tallest state reaches 0.725 of the
 *  cell, and the mascot has to clear the far kerb by that much, so 116 keeps a
 *  ~84px character (just over two lanes) fully on screen at the finish line. */
const CELL = 116
/** Anchor offset: how far above the cell bottom the mascot's feet sit. */
const ANCHOR_PX = MASCOT_ANCHOR.y * CELL

const VEHICLE_H = 60

const KERB = 'rgba(255,255,255,0.07)'
const MUTED = 'rgba(154,167,180,0.7)'

/** Ground line for a lane, counted from the far kerb down. Lane 0 is nearest. */
function laneCenterY(lane: number): number {
  return FAR_H + (ROAD_LANES - 0.5 - lane) * LANE_H
}

const START_Y = BOARD_H - NEAR_H / 2
const FINISH_Y = FAR_H + LANE_H / 2

interface Lane {
  index: number
  y: number
  vehicle: string
  offset: number
  speed: number
}

/** Deterministic layout, so a replayed round looks the same every time. */
function buildLanes(): Lane[] {
  return Array.from({ length: ROAD_LANES }, (_, i) => {
    const r = ((i * 2654435761) % 997) / 997
    return {
      index: i,
      y: laneCenterY(i),
      vehicle: VEHICLE_SOURCES[i % VEHICLE_SOURCES.length],
      offset: r,
      speed: (0.5 + ((i * 37) % 5) * 0.14) * (i % 2 === 0 ? -1 : 1),
    }
  })
}

/** 0..1 travel at which the mascot is knocked down on a given lane. It stops
 *  partway into the lane, so a loss on the last lane is visibly short of the
 *  far kerb. */
export function knockTravel(lane: number): number {
  const y = laneCenterY(lane - 1) + LANE_H * 0.35
  return (y - START_Y) / (FINISH_Y - START_Y)
}

export default function RoadBoard({
  mascotState,
  phase,
  travel,
  hitLane,
  lanes,
}: RoadBoardProps) {
  const all = useMemo(buildLanes, [])
  const [scroll, setScroll] = useState(0)
  const live = phase === 'running'

  // Traffic only moves while the round is live, at a fixed rate so the scene
  // reads identically on every device.
  useEffect(() => {
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

  const groundY = START_Y + (FINISH_Y - START_Y) * travel
  const down = phase === 'knocked'

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        height: BOARD_H,
        background: 'linear-gradient(180deg, #16202e 0%, #1d2836 100%)',
        borderBottom: `1px solid ${KERB}`,
      }}
    >
      {/* horizon glow above the far kerb */}
      <div
        className="absolute inset-x-0"
        style={{
          top: 0,
          height: FAR_H,
          background:
            'radial-gradient(120% 130% at 50% 100%, rgba(59,184,242,0.20) 0%, rgba(8,13,19,0) 72%)',
        }}
      />

      {/* kerbs */}
      {[FAR_H, FAR_H + ROAD_LANES * LANE_H].map((y) => (
        <div
          key={y}
          className="absolute inset-x-0"
          style={{ top: y, height: 2, background: KERB }}
        />
      ))}

      {/* live lanes only; the rest stays plain asphalt */}
      {all.slice(0, lanes).map((lane) => (
        <div
          key={lane.index}
          className="absolute inset-x-0"
          style={{ top: lane.y - LANE_H / 2, height: 2, background: KERB }}
        />
      ))}

      {/* scrolling centre line, on the far kerb */}
      <div
        className="absolute inset-x-0"
        style={{
          top: FAR_H - 5,
          height: 4,
          opacity: live ? 0.65 : 0.25,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 28px, transparent 28px 64px)',
          backgroundPositionX: `${-((scroll * 2) % 64)}px`,
        }}
      />

{/* traffic — hit lane vehicle is forced to converge on mascot at collision, never random miss */}
       {all.slice(0, lanes).map((lane) => {
         // Continuous movement with wrapping
         const span = 108;
         // Position moves continuously based on speed and scroll
         let position = (lane.offset * span + scroll * lane.speed) % span;
         // Ensure positive position (JavaScript % can be negative)
         position = ((position % span) + span) % span;
         let naturalX = position; // 0 to span
         
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
           <img
             key={lane.index}
             src={lane.vehicle}
             alt=""
             aria-hidden
             className="absolute object-contain"
             style={{
               top: lane.y - VEHICLE_H / 2,
               left: `${x}%`,
               // Reduced width multiplier since we increased VEHICLE_H
               width: VEHICLE_H * 1.2,
               height: VEHICLE_H,
               marginLeft: -(VEHICLE_H * 1.2) / 2,
               // Transform based on speed direction for proper facing
               transform: `scaleX(${lane.speed < 0 ? -1 : 1})`,
               opacity: down && !struck ? 0.7 : 1,
               filter: struck
                 ? 'drop-shadow(0 0 12px rgba(255,77,79,0.85))'
                 : 'drop-shadow(0 5px 9px rgba(0,0,0,0.55))',
             }}
           />
         )
       })}

      {/* mascot: feet on the travel line, drawn in front of the traffic */}
      <div
        className="absolute"
        style={{
          top: groundY,
          left: '50%',
          width: CELL,
          height: CELL,
          transform: `translate(-50%, -${ANCHOR_PX}px)`,
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

      {/* kerb labels */}
      {[
        { text: 'Start', top: START_Y - 34, align: 'left' as const },
        { text: 'Finish', top: FINISH_Y - 30, align: 'right' as const },
      ].map(({ text, top, align }) => (
        <div
          key={text}
          className="absolute font-bold uppercase"
          style={{
            top,
            [align]: 12,
            fontSize: 10,
            letterSpacing: 1,
            color: MUTED,
          }}
        >
          {text}
        </div>
      ))}
    </div>
  )
}
