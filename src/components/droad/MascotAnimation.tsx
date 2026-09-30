'use client'

import React, { useEffect, useRef } from 'react'
import type { MascotState } from '@/lib/droad/game'
import { MASCOT_CELL, MASCOT_SHEETS, MASCOT_STATES } from './mascotManifest'

interface MascotAnimationProps {
  state: MascotState
  /** Called once the current state reaches its final frame. */
  onComplete?: () => void
  className?: string
  style?: React.CSSProperties
}

/**
 * Plays one mascot state from its sprite sheet.
 *
 * The sheet is a single WebP strip of square cells, so a frame is a
 * `background-position` change on a fixed-size element: the box is reserved
 * before the image decodes and never resizes, which keeps the road from
 * shifting under the mascot while frames swap.
 *
 * The frame index is written straight to the node rather than through state -
 * a 14fps animation would otherwise cost 14 re-renders of the whole board per
 * second. Timing follows the manifest: a looping state cycles from `loopFrom`
 * so one-shot lead-ins do not stutter when they repeat, and a non-looping state
 * reports completion and then holds its last frame.
 */
export default function MascotAnimation({
  state,
  onComplete,
  className,
  style,
}: MascotAnimationProps) {
  const meta = MASCOT_STATES[state]
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    const frameMs = 1000 / meta.fps
    const last = meta.frames - 1
    const cycleStart = Math.min(meta.loopFrom, last)
    const cycleLen = meta.frames - cycleStart

    let elapsed = 0
    let lastAt = 0
    let raf = 0
    let finished = false

    /** Map how long we have been playing onto a sheet index. */
    const indexAt = (n: number) => {
      if (!meta.loop) return Math.min(n, last)
      // Play the lead-in once, then cycle the tail so the loop has no seam.
      if (n < cycleStart) return n
      return cycleStart + ((n - cycleStart) % cycleLen)
    }

    const paint = (n: number) => {
      const idx = indexAt(n)
      const pct = last > 0 ? (idx / last) * 100 : 0
      node.style.backgroundPosition = `${pct}% 0%`
    }
    paint(0)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) {
        // Do not let a backgrounded tab fast-forward the animation on return.
        lastAt = now
        return
      }
      if (!lastAt) {
        lastAt = now
        return
      }
      const dt = now - lastAt
      if (dt < frameMs) return
      // Drop whole frames rather than letting a slow device drift out of sync.
      lastAt = now
      elapsed += Math.max(1, Math.floor(dt / frameMs))

      if (!meta.loop && elapsed >= last) {
        paint(last)
        if (!finished) {
          finished = true
          completeRef.current?.()
        }
        return
      }
      paint(elapsed)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state, meta])

  return (
    <div
      ref={nodeRef}
      role="img"
      aria-label={`Mascot ${state} animation`}
      className={className}
      style={{
        backgroundImage: `url(${MASCOT_SHEETS[state]})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${meta.frames * 100}% 100%`,
        backgroundPosition: '0% 0%',
        ...style,
      }}
    />
  )
}
