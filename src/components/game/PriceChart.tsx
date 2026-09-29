'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

export interface ChartTick {
  ts: number
  price: number
}

interface PriceChartProps {
  ticks: ChartTick[]
  targetPrice: number | null
  currentPrice: number | null
  startAt: number
  endAt: number
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

// Catmull-Rom to Cubic Bezier points
function catmullRomPoints(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  const tension = 0.3
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export default function PriceChart({
  ticks,
  targetPrice,
  currentPrice,
  startAt: _startAt,
  endAt: _endAt,
  isLoading = false,
  error = null,
  onRetry,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [size, setSize] = useState({ w: 900, h: 420 })

  // Camera state in refs — no React re-renders for camera
  const zoomRef = useRef(1.0)
  const [zoom, setZoomState] = useState(1.0)
  const manualPanSecRef = useRef(0)
  const manualPanPriceRef = useRef(0)
  const autoFollowRef = useRef(true)
  const [autoFollow, setAutoFollowState] = useState(true)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number; panSec: number; panPrice: number } | null>(null)

  // Hover crosshair state
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; price: number; timeStr: string } | null>(null)
  const crosshairRef = useRef<{ x: number; y: number; price: number; timeStr: string } | null>(null)

  // Animation ping for live dot
  const pingPhaseRef = useRef(0)
  const rafRef = useRef<number>(0)

  // Latest ticks/price refs so the RAF loop always sees fresh data
  const ticksRef = useRef<ChartTick[]>(ticks)
  const currentPriceRef = useRef<number | null>(currentPrice)
  const targetPriceRef = useRef<number | null>(targetPrice)
  ticksRef.current = ticks
  currentPriceRef.current = currentPrice
  targetPriceRef.current = targetPrice

  const PAD = { top: 32, right: 90, bottom: 36, left: 12 }

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const measure = () => {
      if (!containerRef.current) return
      const w = Math.max(300, containerRef.current.clientWidth)
      const h = Math.min(520, Math.max(340, Math.floor(w * 0.40)))
      setSize({ w, h })
    }
    setMounted(true)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Canvas DPR scaling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    canvas.style.width = `${size.w}px`
    canvas.style.height = `${size.h}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [size])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ticks = ticksRef.current
    const curPrice = currentPriceRef.current
    const tgtPrice = targetPriceRef.current
    const zoom = zoomRef.current
    const { w, h } = size

    ctx.clearRect(0, 0, w, h)

    const plotW = Math.max(10, w - PAD.left - PAD.right)
    const plotH = Math.max(10, h - PAD.top - PAD.bottom)
    const visibleDur = Math.max(10, Math.round(60 / zoom))

    // Time bounds
    const latestTs = ticks.length > 0 ? ticks[ticks.length - 1].ts : Math.floor(Date.now() / 1000)
    let viewEnd: number, viewStart: number
    if (autoFollowRef.current) {
      viewEnd = latestTs + visibleDur * 0.15
      viewStart = viewEnd - visibleDur
    } else {
      viewEnd = latestTs + visibleDur * 0.15 + manualPanSecRef.current
      viewStart = viewEnd - visibleDur
    }

    const getX = (ts: number) => PAD.left + ((ts - viewStart) / visibleDur) * plotW
    const getYraw = (price: number, minP: number, maxP: number) => {
      const range = maxP - minP
      if (range <= 0) return PAD.top + plotH / 2
      return PAD.top + plotH - ((price - minP) / range) * plotH
    }

    // Price range
    const visiblePrices = ticks
      .filter((t) => t.ts >= viewStart - 30 && t.ts <= viewEnd + 30)
      .map((t) => t.price)
    if (curPrice !== null) visiblePrices.push(curPrice)
    if (tgtPrice !== null) visiblePrices.push(tgtPrice)

    let rawMin = visiblePrices.length > 0 ? Math.min(...visiblePrices) : 100
    let rawMax = visiblePrices.length > 0 ? Math.max(...visiblePrices) : 200
    if (rawMin === rawMax) { rawMin *= 0.999; rawMax *= 1.001 }

    const rawSpan = rawMax - rawMin
    let step = 10
    if (rawSpan > 250) step = 50
    else if (rawSpan > 100) step = 25
    else if (rawSpan > 50) step = 10
    else if (rawSpan > 20) step = 5
    else if (rawSpan > 8) step = 2
    else step = 1
    const minP = Math.floor(rawMin / step) * step - step + manualPanPriceRef.current
    const maxP = Math.ceil(rawMax / step) * step + step + manualPanPriceRef.current
    const getY = (p: number) => getYraw(p, minP, maxP)

    // --- Clean Background (Restored previous sleek dark color, without diagram) ---
    ctx.fillStyle = '#090c10'
    ctx.fillRect(0, 0, w, h)

    // --- Right Margin Price Labels (Without diagram grid lines) ---
    ctx.save()
    ctx.fillStyle = '#525d6b'
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    for (let i = 0; i <= 4; i++) {
      const price = minP + (maxP - minP) * (i / 4)
      const y = getY(price)
      const label = price > 1000 ? `$${price.toFixed(1)}` : `$${price.toFixed(2)}`
      ctx.fillText(label, PAD.left + plotW + 6, y + 3)
    }
    ctx.restore()

    // Clip to plot area
    ctx.save()
    ctx.beginPath()
    ctx.rect(PAD.left, PAD.top, plotW, plotH)
    ctx.clip()

    // --- Target price line ---
    if (tgtPrice !== null) {
      const ty = getY(tgtPrice)
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(PAD.left, ty)
      ctx.lineTo(PAD.left + plotW, ty)
      ctx.stroke()
      ctx.setLineDash([])
      // Target label badge
      ctx.fillStyle = 'rgba(13, 17, 23, 0.85)'
      ctx.beginPath()
      ctx.roundRect(PAD.left + plotW - 114, ty - 14, 110, 20, 4)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = '#f59e0b'
      ctx.font = 'bold 9px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('TARGET ', PAD.left + plotW - 106, ty + 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`$${tgtPrice.toFixed(2)}`, PAD.left + plotW - 63, ty + 1)
      ctx.restore()
    }

    // --- Build chart data points ---
    const relevantTicks = ticks.filter((t) => t.ts >= viewStart - 30 && t.ts <= viewEnd + 30)
    const pts = relevantTicks.map((t) => ({ x: getX(t.ts), y: getY(t.price) }))

    if (pts.length >= 2) {
      // Build smooth path using bezier
      const pathStr = catmullRomPoints(pts)
      const path2d = new Path2D(pathStr)

      // Line stroke with neon glow (Clean without area fill)
      ctx.save()
      ctx.shadowColor = '#a855f7'
      ctx.shadowBlur = 10
      ctx.strokeStyle = '#c084fc'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke(path2d)
      ctx.restore()
    } else if (pts.length === 1 && curPrice !== null) {
      // Flat line from left to current point
      ctx.save()
      ctx.shadowColor = '#8b5cf6'
      ctx.shadowBlur = 8
      ctx.strokeStyle = '#8b5cf6'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(PAD.left, pts[0].y)
      ctx.lineTo(pts[0].x, pts[0].y)
      ctx.stroke()
      ctx.restore()
    }

    // --- Animated live dot ---
    const lastPt = pts.length > 0 ? pts[pts.length - 1] : null
    if (lastPt && curPrice !== null) {
      pingPhaseRef.current = (pingPhaseRef.current + 0.04) % (Math.PI * 2)
      const pingRadius = 6 + Math.sin(pingPhaseRef.current) * 4
      const pingOpacity = 0.15 + Math.sin(pingPhaseRef.current) * 0.15

      // Ping ring
      ctx.save()
      ctx.globalAlpha = pingOpacity
      ctx.fillStyle = '#8b5cf6'
      ctx.beginPath()
      ctx.arc(lastPt.x, lastPt.y, pingRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Core dot
      ctx.save()
      ctx.fillStyle = '#a855f7'
      ctx.shadowColor = '#8b5cf6'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(lastPt.x, lastPt.y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(lastPt.x, lastPt.y, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Live price tag floating next to dot
      const tagX = lastPt.x + 12
      const tagY = lastPt.y - 24
      const priceStr = `$${curPrice.toFixed(2)}`
      ctx.save()
      ctx.font = 'bold 10px monospace'
      const tw = ctx.measureText(priceStr).width + 14
      ctx.fillStyle = '#161b26'
      ctx.strokeStyle = '#8b5cf6'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(tagX - 4, tagY - 11, tw, 18, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(priceStr, tagX + 3, tagY + 2)
      ctx.restore()
    }

    ctx.restore() // end clip

    // --- Hover crosshair ---
    const ch = crosshairRef.current
    if (ch && ch.x >= PAD.left && ch.x <= PAD.left + plotW) {
      ctx.save()
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = '#6b7280'
      ctx.lineWidth = 1
      // Vertical
      ctx.beginPath()
      ctx.moveTo(ch.x, PAD.top)
      ctx.lineTo(ch.x, PAD.top + plotH)
      ctx.stroke()
      // Horizontal
      ctx.beginPath()
      ctx.moveTo(PAD.left, ch.y)
      ctx.lineTo(PAD.left + plotW, ch.y)
      ctx.stroke()
      ctx.setLineDash([])

      // Price tag right axis
      const priceStr = `$${ch.price.toFixed(ch.price > 1000 ? 1 : 2)}`
      ctx.font = 'bold 10px monospace'
      const pw = ctx.measureText(priceStr).width + 10
      ctx.fillStyle = '#1e2430'
      ctx.strokeStyle = '#6b7280'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(PAD.left + plotW + 4, ch.y - 10, pw, 20, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(priceStr, PAD.left + plotW + 8, ch.y + 4)

      // Time tag bottom
      ctx.font = 'bold 9px monospace'
      const tw2 = ctx.measureText(ch.timeStr).width + 10
      ctx.fillStyle = '#1e2430'
      ctx.strokeStyle = '#6b7280'
      ctx.beginPath()
      ctx.roundRect(ch.x - tw2 / 2, PAD.top + plotH + 4, tw2, 18, 3)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.fillText(ch.timeStr, ch.x, PAD.top + plotH + 16)
      ctx.restore()
    }
  }, [size, PAD.left, PAD.right, PAD.top, PAD.bottom])

  // Animation loop — requestAnimationFrame keeps this running at 60fps
  useEffect(() => {
    if (!mounted) return
    let alive = true
    const loop = () => {
      if (!alive) return
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [mounted, draw])

  // Zoom wheel
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 0.87
      const next = Math.min(4.0, Math.max(0.2, +(zoomRef.current * factor).toFixed(2)))
      zoomRef.current = next
      setZoomState(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panSec: manualPanSecRef.current,
      panPrice: manualPanPriceRef.current,
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const plotW = size.w - PAD.left - PAD.right
    const plotH = size.h - PAD.top - PAD.bottom

    // Drag camera
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      const visibleDur = Math.max(10, Math.round(60 / zoomRef.current))

      const ticks = ticksRef.current
      const latestTs = ticks.length > 0 ? ticks[ticks.length - 1].ts : Math.floor(Date.now() / 1000)
      const viewEnd = latestTs + visibleDur * 0.15 + dragStartRef.current.panSec
      const viewStart = viewEnd - visibleDur

      const visiblePrices = ticks
        .filter((t) => t.ts >= viewStart - 30 && t.ts <= viewEnd + 30)
        .map((t) => t.price)
      const curP = currentPriceRef.current
      if (curP !== null) visiblePrices.push(curP)
      const rawMin = visiblePrices.length > 0 ? Math.min(...visiblePrices) : 100
      const rawMax = visiblePrices.length > 0 ? Math.max(...visiblePrices) : 200
      const priceRange = rawMax - rawMin

      const dSec = -(dx / plotW) * visibleDur
      const dPrice = (dy / plotH) * (priceRange + 2)
      manualPanSecRef.current = dragStartRef.current.panSec + dSec
      manualPanPriceRef.current = dragStartRef.current.panPrice + dPrice
      autoFollowRef.current = false
      setAutoFollowState(false)
    }

    // Hover crosshair
    if (mx >= PAD.left && mx <= PAD.left + plotW && my >= PAD.top && my <= PAD.top + plotH) {
      const zoom = zoomRef.current
      const visibleDur = Math.max(10, Math.round(60 / zoom))
      const ticks = ticksRef.current
      const latestTs = ticks.length > 0 ? ticks[ticks.length - 1].ts : Math.floor(Date.now() / 1000)
      const viewEnd = autoFollowRef.current
        ? latestTs + visibleDur * 0.15
        : latestTs + visibleDur * 0.15 + manualPanSecRef.current
      const viewStart = viewEnd - visibleDur

      const hoverTs = viewStart + ((mx - PAD.left) / plotW) * visibleDur
      const d = new Date(hoverTs * 1000)
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`

      // Price from visible range
      const visiblePrices = ticks
        .filter((t) => t.ts >= viewStart - 30 && t.ts <= viewEnd + 30)
        .map((t) => t.price)
      const curP = currentPriceRef.current
      if (curP !== null) visiblePrices.push(curP)
      const rawMin = visiblePrices.length > 0 ? Math.min(...visiblePrices) : 100
      const rawMax = visiblePrices.length > 0 ? Math.max(...visiblePrices) : 200
      let step = 10
      const rawSpan = rawMax - rawMin
      if (rawSpan > 250) step = 50
      else if (rawSpan > 100) step = 25
      else if (rawSpan > 50) step = 10
      else if (rawSpan > 20) step = 5
      else if (rawSpan > 8) step = 2
      else step = 1
      const minP = Math.floor(rawMin / step) * step - step + manualPanPriceRef.current
      const maxP = Math.ceil(rawMax / step) * step + step + manualPanPriceRef.current
      const hoverPrice = maxP - ((my - PAD.top) / plotH) * (maxP - minP)

      const ch = { x: mx, y: my, price: hoverPrice, timeStr }
      crosshairRef.current = ch
      setCrosshair(ch) // for React state (only used for overlay renders)
    } else {
      crosshairRef.current = null
      setCrosshair(null)
    }
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
    dragStartRef.current = null
  }

  const handleMouseLeave = () => {
    isDraggingRef.current = false
    dragStartRef.current = null
    crosshairRef.current = null
    setCrosshair(null)
  }

  // Touch support for mobile
  const touchStartRef = useRef<{ x: number; y: number; panSec: number; panPrice: number } | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      panSec: manualPanSecRef.current,
      panPrice: manualPanPriceRef.current,
    }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (!touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const plotW = size.w - PAD.left - PAD.right
    const visibleDur = Math.max(10, Math.round(60 / zoomRef.current))
    const dSec = -(dx / plotW) * visibleDur
    manualPanSecRef.current = touchStartRef.current.panSec + dSec
    autoFollowRef.current = false
    setAutoFollowState(false)
  }
  const handleTouchEnd = () => {
    touchStartRef.current = null
  }

  const handleRecenter = () => {
    zoomRef.current = 1.0
    manualPanSecRef.current = 0
    manualPanPriceRef.current = 0
    autoFollowRef.current = true
    setZoomState(1.0)
    setAutoFollowState(true)
  }

  const handleZoomIn = () => {
    const next = Math.min(4.0, +(zoomRef.current * 1.25).toFixed(2))
    zoomRef.current = next
    setZoomState(next)
  }

  const handleZoomOut = () => {
    const next = Math.max(0.2, +(zoomRef.current * 0.8).toFixed(2))
    zoomRef.current = next
    setZoomState(next)
  }

  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-[#0a0d12] border border-gamdom-border flex flex-col items-center justify-center"
        style={{ minHeight: 340 }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        <span className="text-xs font-bold text-gamdom-textDim uppercase tracking-wider mt-2">
          Loading Price Feed...
        </span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full rounded-2xl overflow-hidden bg-[#090c10] border border-[#1b222c] select-none shadow-2xl ${
        isDraggingRef.current ? 'cursor-grabbing' : 'cursor-crosshair'
      }`}
      style={{
        minHeight: size.h,
      }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: size.w, height: size.h, display: 'block' }}
      />

      {/* Camera Controls Overlay */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-[#121721]/90 backdrop-blur-md border border-[#232b38] px-2 py-1.5 rounded-xl shadow-2xl text-xs font-bold">
        <button
          onClick={handleRecenter}
          title={autoFollow ? 'Auto-tracking' : 'Click to Recenter'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition text-[11px] font-black tracking-wide ${
            autoFollow
              ? 'bg-[#3bb8f2]/20 text-[#3bb8f2] border border-[#3bb8f2]/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 animate-pulse'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${autoFollow ? 'bg-[#3bb8f2] animate-pulse' : 'bg-amber-400'}`} />
          <span>{autoFollow ? 'LIVE' : 'RECENTER'}</span>
        </button>

        <div className="h-4 w-[1px] bg-[#232b38]" />

        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 rounded-lg text-gamdom-text hover:text-[#3bb8f2] hover:bg-[#3bb8f2]/10 transition"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded-lg text-gamdom-text hover:text-[#3bb8f2] hover:bg-[#3bb8f2]/10 transition"
        >
          <ZoomOut size={14} />
        </button>
        {zoom !== 1.0 && (
          <button
            onClick={() => { zoomRef.current = 1.0; setZoomState(1.0) }}
            title="Reset Zoom"
            className="p-1.5 rounded-lg text-gamdom-text hover:text-[#3bb8f2] hover:bg-[#3bb8f2]/10 transition"
          >
            <RotateCcw size={13} />
          </button>
        )}
        <span className="text-[10px] text-gamdom-textDim font-mono px-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Loading overlay */}
      {isLoading && ticks.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090c10]/80 z-20 space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <span className="text-xs font-bold text-gamdom-textDim uppercase tracking-wider">
            Connecting Real-Time Feed...
          </span>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090c10]/90 z-20 space-y-2 p-4 text-center">
          <span className="text-xs font-bold text-gamdom-red uppercase tracking-wider">
            Price Feed Unavailable
          </span>
          <p className="text-[11px] text-gamdom-textDim">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gamdom-card hover:bg-gamdom-cardHover border border-gamdom-border text-white transition mt-2"
            >
              Retry Feed
            </button>
          )}
        </div>
      )}

      {/* Suppress unused crosshair state lint warning */}
      {crosshair && <span className="hidden">{crosshair.timeStr}</span>}
    </div>
  )
}
