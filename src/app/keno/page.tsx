'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { Grid3x3, Ticket } from 'lucide-react'

const FONT = "'Gamdom', sans-serif"

const POOL_SIZE = 40
const DRAW_SIZE = 8
const MIN_SPOTS = 1
const MAX_SPOTS = 10
const HOUSE_EDGE = 0.99
const PAY_THRESHOLD = 0.12
const MAX_MULTIPLIER = 10000
const REVEAL_DELAY = 190
const FINAL_DELAY = 420
const WIN_POPUP_IMAGE_W = 1302
const WIN_POPUP_IMAGE_H = 1208
const WIN_VALUE_CENTER_X = 651
const WIN_VALUE_CENTER_Y = 664
const WIN_POPUP_ANCHOR_TILE = 20

const pool: number[] = Array.from({ length: POOL_SIZE }, (_, i) => i + 1)

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

const TOTAL_WAYS = combinations(POOL_SIZE, DRAW_SIZE)
const tableCache: Record<number, number[]> = {}

/*
 * Keno pay table from the hypergeometric distribution.
 * Only tiers at or above the first one with a hit chance under PAY_THRESHOLD pay out,
 * the top prize is capped, and the shortfall is redistributed over the uncapped tiers
 * so the house edge stays at 1% for every spot count.
 */
function payoutTable(spots: number): number[] {
  const cached = tableCache[spots]
  if (cached) return cached

  const probability: number[] = new Array(spots + 1).fill(0)
  for (let hits = 0; hits <= spots; hits++) {
    probability[hits] =
      (combinations(spots, hits) * combinations(POOL_SIZE - spots, DRAW_SIZE - hits)) / TOTAL_WAYS
  }

  const maxHits = Math.min(spots, DRAW_SIZE)
  let firstPaid = maxHits
  for (let hits = 1; hits <= maxHits; hits++) {
    if (probability[hits] <= PAY_THRESHOLD) {
      firstPaid = hits
      break
    }
  }

  const tiers: number[] = []
  for (let hits = firstPaid; hits <= maxHits; hits++) tiers.push(hits)

  const share = HOUSE_EDGE / tiers.length
  const multiplier: Record<number, number> = {}
  for (const hits of tiers) {
    multiplier[hits] = Math.min(MAX_MULTIPLIER, Math.floor((share / probability[hits]) * 100) / 100)
  }

  for (let pass = 0; pass < 4; pass++) {
    const expected = tiers.reduce((sum, hits) => sum + probability[hits] * multiplier[hits], 0)
    const missing = HOUSE_EDGE - expected
    if (missing <= 1e-12) break
    const open = tiers.filter((hits) => multiplier[hits] < MAX_MULTIPLIER)
    if (open.length === 0) break
    const weight = open.reduce((sum, hits) => sum + probability[hits] * probability[hits], 0)
    for (const hits of open) {
      multiplier[hits] = Math.min(
        MAX_MULTIPLIER,
        Math.floor((multiplier[hits] + (missing * probability[hits]) / weight) * 100) / 100,
      )
    }
  }

  const table: number[] = new Array(spots + 1).fill(0)
  for (const hits of tiers) table[hits] = multiplier[hits]

  tableCache[spots] = table
  return table
}

function drawNumbers(count: number): number[] {
  const bag = [...pool]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = bag[i]
    bag[i] = bag[j]
    bag[j] = swap
  }
  return bag.slice(0, count)
}

function playKenoSound(type: 'pick' | 'ball' | 'win' | 'lose') {
  if (typeof window === 'undefined') return
  try {
    if (type === 'win' || type === 'lose') {
      const a = new Audio(type === 'win' ? '/keno/gold.mp3' : '/mines/burst.mp3')
      a.volume = type === 'win' ? 0.55 : 0.6
      a.play().catch(() => {})
      return
    }
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    if (type === 'pick') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(720, now)
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.06)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.09)
    } else if (type === 'ball') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(420, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1)
      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.13)
    }
  } catch {}
}

export default function KenoPage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()

  const [betInput, setBetInput] = useState('5.00')
  const [selected, setSelected] = useState<number[]>([])
  const [drawn, setDrawn] = useState<number[]>([])
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'result'>('idle')
  const [winPopup, setWinPopup] = useState<{ profit: number; multiplier: number } | null>(null)
  const [winPopupPos, setWinPopupPos] = useState<{ x: number; y: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const boardRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const mountedRef = useRef(true)

  const bet = Math.max(0, parseFloat(betInput) || 0)
  const spots = selected.length
  const table = useMemo(() => (spots > 0 ? payoutTable(spots) : []), [spots])
  const isDrawing = phase === 'drawing'
  const drawnSet = useMemo(() => new Set(drawn), [drawn])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const bestMultiplier = spots > 0 ? table[Math.min(spots, DRAW_SIZE)] : 0

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current = []
    }
  }, [])

  const resetBoard = useCallback(() => {
    setWinPopup(null)
    setWinPopupPos(null)
    setDrawn([])
    setPhase('idle')
  }, [])

  const measureTileCenter = useCallback((value: number) => {
    const board = boardRef.current
    const grid = gridRef.current
    if (!board || !grid) return null
    const tile = grid.querySelector<HTMLElement>(`[data-value="${value}"]`)
    if (!tile) return null
    const boardRect = board.getBoundingClientRect()
    const tileRect = tile.getBoundingClientRect()
    return {
      x: tileRect.left + tileRect.width / 2 - boardRect.left,
      y: tileRect.top + tileRect.height / 2 - boardRect.top,
    }
  }, [])

  const toggleNumber = useCallback(
    (value: number) => {
      if (isDrawing) return
      setErrorMessage('')
      setSelected((prev) => {
        if (prev.includes(value)) return prev.filter((n) => n !== value)
        if (prev.length >= MAX_SPOTS) {
          setErrorMessage(`You can pick up to ${MAX_SPOTS} numbers`)
          return prev
        }
        return [...prev, value].sort((a, b) => a - b)
      })
      resetBoard()
      playKenoSound('pick')
    },
    [isDrawing, resetBoard],
  )

  const quickPick = useCallback(
    (count: number) => {
      if (isDrawing) return
      setErrorMessage('')
      setSelected(drawNumbers(count).sort((a, b) => a - b))
      resetBoard()
      playKenoSound('pick')
    },
    [isDrawing, resetBoard],
  )

  const clearNumbers = useCallback(() => {
    if (isDrawing) return
    setErrorMessage('')
    setSelected([])
    resetBoard()
  }, [isDrawing, resetBoard])

  const handleDraw = useCallback(() => {
    if (isDrawing) return
    setErrorMessage('')

    if (spots < MIN_SPOTS) {
      setErrorMessage('Pick at least 1 number to play')
      return
    }
    if (bet <= 0) {
      setErrorMessage('Bet must be greater than $0')
      return
    }
    if (bet > balance) {
      setErrorMessage('Insufficient balance')
      return
    }
    if (!deductBalance(bet)) {
      setErrorMessage('Failed to deduct balance')
      return
    }

    const order = drawNumbers(DRAW_SIZE)
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []

    setPhase('drawing')
    setWinPopup(null)
    setWinPopupPos(null)
    setDrawn([])

    order.forEach((value, index) => {
      const timer = setTimeout(() => {
        if (!mountedRef.current) return
        setDrawn((prev) => [...prev, value])
        playKenoSound('ball')
      }, index * REVEAL_DELAY)
      timersRef.current.push(timer)
    })

    const finish = setTimeout(() => {
      if (!mountedRef.current) return
      const matched = order.filter((value) => selectedSet.has(value)).length
      const multiplier = payoutTable(spots)[matched] ?? 0
      const payout = +(bet * multiplier).toFixed(2)

      setPhase('result')
      if (payout > 0) {
        addBalance(payout)
        playKenoSound('win')
        setWinPopup({ profit: +(payout - bet).toFixed(2), multiplier })
        setWinPopupPos(measureTileCenter(WIN_POPUP_ANCHOR_TILE))
      } else {
        playKenoSound('lose')
      }
    }, (DRAW_SIZE - 1) * REVEAL_DELAY + FINAL_DELAY)

    timersRef.current.push(finish)
  }, [addBalance, balance, bet, deductBalance, isDrawing, measureTileCenter, spots, selectedSet])

  const setBetValue = (value: number) => setBetInput(Math.max(0, +value.toFixed(2)).toFixed(2))

  const quickActionStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: '1px solid #19212a',
    borderRadius: '8px',
    color: '#9aa7b4',
    padding: '0 4px',
    height: '40px',
    fontFamily: FONT,
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: '12px',
    fontWeight: 700,
    color: '#9aa7b4',
    textTransform: 'uppercase',
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#141a22',
    border: '1px solid #19212a',
    borderRadius: '4px',
    color: '#ffffff',
    fontFamily: FONT,
    fontSize: '16px',
    fontWeight: 600,
    width: '100%',
    padding: '10px 12px 10px 30px',
  }

  const tileBase: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 'clamp(11px, 3.3vw, 15px)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    aspectRatio: '1 / 1',
    borderRadius: 'clamp(4px, 1.67vw, 8px)',
    border: 'none',
    padding: 0,
    transition: 'all 180ms ease',
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Gamdom&display=swap');`}</style>
      <div
        className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6"
        style={{ fontFamily: FONT, backgroundColor: '#080d13' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-[8px] overflow-hidden p-0.5 shrink-0"
              style={{ backgroundColor: '#10151c', border: '1px solid #19212a' }}
            >
              <img
                src="/games/keno.png"
                alt="Keno"
                className="w-full h-full object-cover rounded-[8px]"
              />
            </div>
            <div className="min-w-0">
              <h1
                className="text-xl sm:text-2xl font-bold uppercase truncate"
                style={{
                  fontFamily: FONT,
                  fontSize: '24px',
                  fontWeight: 700,
                  lineHeight: '29px',
                  color: '#ffffff',
                }}
              >
                Keno
              </h1>
              <p className="text-sm truncate" style={{ ...labelStyle, textTransform: 'none', fontWeight: 400 }}>
                Pick up to {MAX_SPOTS} numbers, then match {DRAW_SIZE} drawn balls to win.
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-[20px_20px_0px_0px] overflow-hidden flex flex-col lg:flex-row"
          style={{ backgroundColor: '#080d13', border: '1px solid #19212a' }}
        >
          {/* Board */}
          <div
            ref={boardRef}
            onClick={() => {
              if (winPopup) setWinPopup(null)
            }}
            className="relative flex-1 min-w-0 p-3 sm:p-6 flex flex-col items-center justify-start gap-4 min-h-[380px] order-1 lg:order-2"
            style={{ backgroundColor: '#080d13' }}
          >
            {winPopup && winPopupPos && (
              <div
                className="absolute z-20 animate-in zoom-in duration-200 pointer-events-none"
                style={{ left: winPopupPos.x, top: winPopupPos.y, width: 0, height: 0 }}
              >
                <div
                  className="absolute"
                  style={{
                    left: 0,
                    top: 0,
                    transform: 'translate(-50%, -50%)',
                    width: 'min(76vw, 330px)',
                    aspectRatio: `${WIN_POPUP_IMAGE_W} / ${WIN_POPUP_IMAGE_H}`,
                    backgroundImage: 'url(/keno/winvalue1.png)',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                  }}
                >
                  <div
                    className="absolute flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                    style={{
                      left: `${(WIN_VALUE_CENTER_X / WIN_POPUP_IMAGE_W) * 100}%`,
                      top: `${(WIN_VALUE_CENTER_Y / WIN_POPUP_IMAGE_H) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      fontFamily: FONT,
                      color: '#ffffff',
                      textShadow: '0 2px 6px rgba(0,0,0,0.45)',
                    }}
                  >
                    <span className="text-[20px] sm:text-[24px] font-black leading-none">
                      +${winPopup.profit.toFixed(2)}
                    </span>
                    <span className="text-[13px] sm:text-[15px] font-bold leading-none opacity-90">
                      {winPopup.multiplier.toFixed(2)}x
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="w-full min-w-0 px-2 sm:px-4">
              <div
                ref={gridRef}
                className="grid w-full min-w-0 max-w-[480px] mx-auto p-2 sm:p-4 rounded-[12px]"
                style={{
                  gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                  gap: 'clamp(3px, 0.84vw, 4px)',
                  boxSizing: 'border-box',
                  backgroundColor: '#10151c',
                  border: '1px solid #19212a',
                }}
              >
                {pool.map((value) => {
                  const isSelected = selectedSet.has(value)
                  const isDrawn = drawnSet.has(value)
                  const isHit = isSelected && isDrawn

                  const fill = isHit
                    ? '#38B9F2'
                    : isSelected
                      ? '#ffffff'
                      : isDrawn
                        ? '#141a22'
                        : '#080d13'
                  const text = isHit || isSelected ? '#080d13' : isDrawn ? '#6f7d8a' : '#9aa7b4'

                  return (
                    <button
                      key={value}
                      type="button"
                      data-value={value}
                      disabled={isDrawing}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleNumber(value)
                      }}
                      className="select-none disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-transform"
                      style={{
                        ...tileBase,
                        backgroundColor: fill,
                        color: text,
                        opacity: isDrawing && !isDrawn ? 0.6 : 1,
                      }}
                    >
                      <span className="relative">{value}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="h-8 flex items-center justify-center">
              {isDrawing && (
                <div
                  className="text-xs font-bold flex items-center gap-1.5"
                  style={{ fontFamily: FONT, color: '#fbb01b' }}
                >
                  <Grid3x3 size={14} /> Drawing {drawn.length} / {DRAW_SIZE} balls
                </div>
              )}
            </div>

            <div className="w-full max-w-[880px]">
              <div className="flex items-center justify-between mb-2">
                <span style={labelStyle}>Payouts</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', color: '#6f7d8a' }}>
                  {DRAW_SIZE} of {POOL_SIZE} drawn
                </span>
              </div>
              {spots > 0 ? (
                <div className="flex flex-nowrap overflow-x-auto pb-1" style={{ gap: '8px' }}>
                  {table.map((multiplier, index) => (
                    <span
                      key={index}
                      className="font-bold shrink-0 whitespace-nowrap"
                      style={{
                        fontFamily: FONT,
                        fontSize: '13px',
                        fontWeight: 700,
                        padding: '8px 10px',
                        borderRadius: '4px',
                        border: `1px solid ${multiplier > 0 ? '#38B9F2' : '#19212a'}`,
                        backgroundColor: multiplier > 0 ? 'rgba(56, 185, 242,0.12)' : 'transparent',
                        color: multiplier > 0 ? '#38B9F2' : '#6f7d8a',
                      }}
                    >
                      {index} hit{index === 1 ? '' : 's'} ·{' '}
                      {multiplier > 0 ? `${multiplier.toFixed(2)}x` : '—'}
                    </span>
                  ))}
                </div>
              ) : (
                <p
                  className="text-center"
                  style={{ fontFamily: FONT, fontSize: '12px', color: '#6f7d8a' }}
                >
                  Pick numbers to see the payout table.
                </p>
              )}
            </div>
          </div>

          {/* Controls Panel */}
          <div
            className="w-full lg:w-80 p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_132px] items-start gap-x-3 gap-y-4 lg:flex lg:flex-col lg:items-stretch lg:gap-0 lg:justify-start shrink-0 order-2 lg:order-1"
            style={{ backgroundColor: '#10151c', borderColor: '#19212a' }}
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="keno-bet" style={labelStyle}>
                    Bet Amount
                  </label>
                  <span style={{ fontFamily: FONT, fontSize: '12px', color: '#9aa7b4' }}>
                    Balance:{' '}
                    <span className="font-bold" style={{ color: '#fbb01b' }}>
                      ${balance.toFixed(2)}
                    </span>
                  </span>
                </div>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm pointer-events-none"
                    style={{ color: '#fbb01b' }}
                  >
                    $
                  </span>
                  <input
                    id="keno-bet"
                    type="number"
                    step="0.5"
                    min="0"
                    disabled={isDrawing}
                    value={betInput}
                    onChange={(e) => setBetInput(e.target.value)}
                    className="transition disabled:opacity-50"
                    style={inputStyle}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[
                    { label: 'MIN', apply: () => setBetValue(1) },
                    { label: '½', apply: () => setBetValue(+(bet / 2).toFixed(2)) },
                    { label: '2×', apply: () => setBetValue(+(bet * 2).toFixed(2)) },
                    { label: 'MAX', apply: () => setBetValue(balance) },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={isDrawing}
                      onClick={action.apply}
                      className="transition disabled:opacity-40 hover:border-white hover:text-white"
                      style={quickActionStyle}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={labelStyle}>Your Numbers</span>
                  <span
                    className="font-bold flex items-center gap-1"
                    style={{ fontFamily: FONT, fontSize: '12px', fontWeight: 700, color: '#fbb01b' }}
                  >
                    <Grid3x3 size={12} /> {spots} / {MAX_SPOTS}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '4', apply: () => quickPick(4) },
                    { label: '5', apply: () => quickPick(5) },
                    { label: '6', apply: () => quickPick(6) },
                    { label: 'CLEAR', apply: clearNumbers },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={isDrawing}
                      onClick={action.apply}
                      className="transition disabled:opacity-40 hover:border-white hover:text-white"
                      style={quickActionStyle}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="p-3.5 space-y-2"
                style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px' }}
              >
                <div className="flex justify-between items-center">
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#9aa7b4' }}>Spots</span>
                  <span className="font-bold" style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    {spots > 0 ? spots : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#9aa7b4' }}>Top Prize</span>
                  <span className="font-bold" style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#38B9F2' }}>
                    {bestMultiplier > 0 ? `${bestMultiplier.toFixed(2)}x` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#9aa7b4' }}>Potential Win</span>
                  <span className="font-bold" style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#fbb01b' }}>
                    {bestMultiplier > 0 ? `$${(bet * bestMultiplier).toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div
                  className="text-xs font-bold p-2.5 rounded-[4px] text-center"
                  style={{
                    color: '#ff4d4f',
                    backgroundColor: 'rgba(255,77,79,0.12)',
                    border: '1px solid #ff4d4f',
                    fontFamily: FONT,
                  }}
                >
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="w-full col-start-2 row-start-1 self-stretch flex lg:col-start-auto lg:row-start-auto lg:self-auto lg:block lg:mt-6">
              <button
                type="button"
                onClick={handleDraw}
                disabled={isDrawing}
                className="w-full self-stretch flex items-center justify-center transition active:scale-[0.99] disabled:opacity-60"
                style={{
                  minHeight: '56px',
                  height: '56px',
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #38B9F2',
                  backgroundColor: '#38B9F2',
                  color: '#080d13',
                  fontFamily: FONT,
                  fontSize: '18px',
                  fontWeight: 700,
                  boxShadow: 'none',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Ticket size={15} color="#080d13" />
                  {phase === 'idle' ? 'BET' : 'BETTING'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <AuthGuardModal isOpen={!loading && !user} />
      </div>
    </>
  )
}
