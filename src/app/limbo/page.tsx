'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { Gem, Sparkles, TrendingUp } from 'lucide-react'

const CHIP_WIDTH = 104
const CHIP_GAP = 16
const CHIP_PITCH = CHIP_WIDTH + CHIP_GAP
const CHIP_HEIGHT = 168
const STRIP_LENGTH = 72
const LANDING_INDEX = 52
const IDLE_INDEX = 36
const ART_FILES = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `/limbo/${n}.webp`)
const HOUSE_EDGE = 0.99
const MIN_TARGET = 1.01
const MAX_TARGET = 1000000
const SPIN_MS = 3000
const DECEL_AT = 0.68
const DECEL_SHARE = 0.88
const WOBBLE_AT = 0.88
const AUTO_ROLL_DELAY = 800

const FONT = "'Gamdom', sans-serif"

interface RoundResult {
  result: number
  won: boolean
  bet: number
  target: number
  payout: number
}

interface ReelChip {
  value: number
  art: number
}

function rollMultiplier() {
  const raw = HOUSE_EDGE / (1 - Math.random())
  return +Math.min(raw, 9999999).toFixed(2)
}

function fillerMultiplier() {
  const r = Math.random()
  if (r < 0.55) return +(1 + Math.random() * 1.99).toFixed(2)
  if (r < 0.85) return +(3 + Math.random() * 12).toFixed(2)
  if (r < 0.97) return +(15 + Math.random() * 85).toFixed(2)
  return +(100 + Math.random() * 4900).toFixed(2)
}

function buildStrip(landed: number | null): ReelChip[] {
  const chips: ReelChip[] = []
  for (let i = 0; i < STRIP_LENGTH; i++) {
    chips.push({
      value: i === LANDING_INDEX && landed !== null ? landed : fillerMultiplier(),
      art: Math.floor(Math.random() * ART_FILES.length),
    })
  }
  return chips
}

function clampTarget(value: number) {
  if (!isFinite(value)) return MIN_TARGET
  return +Math.min(MAX_TARGET, Math.max(MIN_TARGET, value)).toFixed(2)
}

function formatMult(value: number) {
  if (value >= 10000) return `${(value / 1000).toFixed(0)}K`
  if (value >= 1000) return value.toFixed(0)
  if (value >= 100) return value.toFixed(1)
  return value.toFixed(2)
}

function rarityColor(value: number) {
  if (value >= 100) return '#38B9F2'
  if (value >= 10) return '#fbb01b'
  if (value >= 2) return '#38B9F2'
  return '#6f7d8a'
}

function spinProgress(t: number) {
  if (t < DECEL_AT) return Math.pow(t / DECEL_AT, 0.85) * DECEL_SHARE
  const u = (t - DECEL_AT) / (1 - DECEL_AT)
  return DECEL_SHARE + (1 - DECEL_SHARE) * (1 - Math.pow(1 - u, 3))
}

function playLimboSound(type: 'spin' | 'tick' | 'win' | 'lose') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    if (type === 'spin') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, now)
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.35)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
    } else if (type === 'tick') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(1400, now)
      gain.gain.setValueAtTime(0.025, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    } else if (type === 'win') {
      ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.07)
        gain.gain.setValueAtTime(0.1, now + idx * 0.07)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.07)
        osc.stop(now + idx * 0.07 + 0.22)
      })
    } else {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.35)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
    }
  } catch {}
}

export default function LimboPage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()

  const [betInput, setBetInput] = useState('5.00')
  const [targetInput, setTargetInput] = useState('2.00')
  const [strip, setStrip] = useState<ReelChip[]>(() => buildStrip(null))
  const [round, setRound] = useState<RoundResult | null>(null)
  const [history, setHistory] = useState<number[]>([1.24, 2.61, 1.05, 14.8, 1.42, 3.87, 1.19, 7.05])
  const [autoRoll, setAutoRoll] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [roundId, setRoundId] = useState(0)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const stripElRef = useRef<HTMLDivElement | null>(null)
  const animRef = useRef<number | null>(null)
  const highlightRef = useRef(-1)
  const spinningRef = useRef(false)

  const bet = Math.max(0, parseFloat(betInput) || 0)
  const target = clampTarget(parseFloat(targetInput) || MIN_TARGET)
  const winChance = +((HOUSE_EDGE / target) * 100).toFixed(2)
  const profitOnWin = +(bet * target - bet).toFixed(2)

  const apiRef = useRef({ balance, deductBalance, addBalance, bet, target, spinning: false })
  useEffect(() => {
    apiRef.current.balance = balance
    apiRef.current.deductBalance = deductBalance
    apiRef.current.addBalance = addBalance
    apiRef.current.bet = bet
    apiRef.current.target = target
    apiRef.current.spinning = spinningRef.current
  })

  const centerStripAt = useCallback((index: number) => {
    const viewport = viewportRef.current
    const stripEl = stripElRef.current
    if (!viewport || !stripEl) return
    const x = -(index * CHIP_PITCH + CHIP_WIDTH / 2 - viewport.clientWidth / 2)
    stripEl.style.transform = `translate3d(${x}px, 0, 0)`
  }, [])

  useLayoutEffect(() => {
    centerStripAt(IDLE_INDEX)
  }, [centerStripAt])

  useEffect(() => {
    ART_FILES.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (!spinningRef.current) centerStripAt(roundId === 0 ? IDLE_INDEX : LANDING_INDEX)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [centerStripAt, roundId])

  const settle = useCallback((landed: number, placedBet: number, placedTarget: number) => {
    const isWin = landed >= placedTarget
    const payout = isWin ? +(placedBet * placedTarget).toFixed(2) : 0
    spinningRef.current = false
    setIsSpinning(false)
    setRound({ result: landed, won: isWin, bet: placedBet, target: placedTarget, payout })
    setHistory((prev) => [landed, ...prev.slice(0, 9)])
    if (isWin) {
      apiRef.current.addBalance(payout)
      playLimboSound('win')
    } else {
      playLimboSound('lose')
    }
  }, [])

  const runSpin = useCallback(
    (landed: number, placedBet: number, placedTarget: number) => {
      const viewport = viewportRef.current
      const stripEl = stripElRef.current
      if (!viewport || !stripEl) {
        settle(landed, placedBet, placedTarget)
        return
      }

      const viewWidth = viewport.clientWidth
      const endX = -(LANDING_INDEX * CHIP_PITCH + CHIP_WIDTH / 2 - viewWidth / 2)
      const rotations = 5 + Math.floor(Math.random() * 5)
      const travel = (rotations + 0.2 + Math.random() * 0.6) * CHIP_PITCH
      const startX = endX + travel

      setStrip(buildStrip(landed))
      setIsSpinning(true)
      setRound(null)
      playLimboSound('spin')

      requestAnimationFrame(() => {
        stripEl.style.transform = `translate3d(${startX}px, 0, 0)`
        const startedAt = performance.now()

        const loop = (timestamp: number) => {
          const t = Math.min(1, (timestamp - startedAt) / SPIN_MS)
          let x = startX + (endX - startX) * spinProgress(t)
          if (t > WOBBLE_AT) {
            const k = (t - WOBBLE_AT) / (1 - WOBBLE_AT)
            x += Math.sin(k * Math.PI * 2.5) * (1 - k) * 7
          }

          stripEl.style.transform = `translate3d(${x}px, 0, 0)`

          const centerIndex = Math.round((startX - x) / CHIP_PITCH)
          if (centerIndex !== highlightRef.current) {
            const prev = stripEl.children[highlightRef.current] as HTMLElement | undefined
            if (prev) prev.style.opacity = ''
            const next = stripEl.children[centerIndex] as HTMLElement | undefined
            if (next) next.style.opacity = '0.45'
            highlightRef.current = centerIndex
            if (t > 0.15 && t < WOBBLE_AT) playLimboSound('tick')
          }

          if (t < 1) {
            animRef.current = requestAnimationFrame(loop)
            return
          }

          const prev = stripEl.children[highlightRef.current] as HTMLElement | undefined
          if (prev) prev.style.opacity = ''
          const winner = stripEl.children[LANDING_INDEX] as HTMLElement | undefined
          if (winner) winner.style.opacity = '1'
          highlightRef.current = LANDING_INDEX
          settle(landed, placedBet, placedTarget)
        }

        animRef.current = requestAnimationFrame(loop)
      })
    },
    [settle],
  )

  const handleBet = useCallback(() => {
    if (spinningRef.current) return
    setErrorMessage('')

    const placedBet = bet
    const placedTarget = target
    if (placedBet <= 0) {
      setErrorMessage('Bet must be greater than $0')
      return
    }
    if (placedBet > apiRef.current.balance) {
      setErrorMessage('Insufficient balance')
      setAutoRoll(false)
      return
    }

    const deducted = apiRef.current.deductBalance(placedBet)
    if (!deducted) {
      setErrorMessage('Failed to deduct balance')
      return
    }

    spinningRef.current = true
    setRoundId((prev) => prev + 1)
    runSpin(rollMultiplier(), placedBet, placedTarget)
  }, [bet, target, runSpin])

  const handleBetRef = useRef(handleBet)
  useEffect(() => {
    handleBetRef.current = handleBet
  })

  useEffect(() => {
    if (!autoRoll || isSpinning) return
    const timer = setTimeout(() => handleBetRef.current(), AUTO_ROLL_DELAY)
    return () => clearTimeout(timer)
  }, [autoRoll, isSpinning, roundId])

  const setBetValue = (value: number) => setBetInput(Math.max(0, value).toFixed(2))
  const setTargetValue = (value: number) => setTargetInput(clampTarget(value).toFixed(2))

  const quickActionStyle: React.CSSProperties = {
    backgroundColor: 'rgba(59, 184, 242, 0.1)',
    color: '#3bb8f2',
    borderRadius: '4px',
    border: '1px solid rgba(59, 184, 242, 0.3)',
    padding: '4px 6px',
    fontFamily: FONT,
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#141a22',
    border: '1px solid #19212a',
    borderRadius: '4px',
    color: '#ffffff',
    fontFamily: FONT,
    fontSize: '14px',
    fontWeight: 600,
    padding: '8px 12px 8px 26px',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: '12px',
    fontWeight: 400,
    color: '#9aa7b4',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamdom&display=swap');
        .limbo-action-area { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 16px; align-items: stretch; margin-top: 16px; }
        .limbo-inputs { display: flex; gap: 16px; }
        @media (max-width: 639px) {
          .limbo-action-area { grid-template-columns: minmax(0, 1fr); }
          .limbo-bet-action { min-height: 48px !important; }
        }
      `}</style>
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
                src="/games/limbo.png"
                alt="Limbo"
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
                Limbo
              </h1>
              <p className="text-sm truncate" style={labelStyle}>
                Pick a Pengali, spin the reel, and win when it clears your target.
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-[20px_20px_0px_0px] overflow-hidden flex flex-col gap-4 p-4 sm:p-6"
          style={{ backgroundColor: '#080d13', border: '1px solid #19212a' }}
        >
          <div className="relative w-full">
            <div
              ref={viewportRef}
              style={{
                overflow: 'hidden',
                display: 'flex',
                gap: `${CHIP_GAP}px`,
                height: `${CHIP_HEIGHT}px`,
                alignItems: 'stretch',
                position: 'relative',
              }}
            >
              <div
                ref={stripElRef}
                style={{
                  display: 'flex',
                  gap: `${CHIP_GAP}px`,
                  flexShrink: 0,
                  willChange: 'transform',
                }}
              >
                {strip.map((chip, index) => {
                  const rarity = rarityColor(chip.value)
                  return (
                    <div
                      key={index}
                      style={{
                        width: `${CHIP_WIDTH}px`,
                        height: '100%',
                        flexShrink: 0,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={ART_FILES[chip.art]}
                        alt=""
                        draggable={false}
                        className="w-full h-full object-contain select-none"
                        style={{
                          pointerEvents: 'none',
                          filter:
                            chip.value >= 100
                              ? `drop-shadow(0 0 10px ${rarity}) drop-shadow(0 0 18px ${rarity}66)`
                              : 'none',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: FONT,
                          fontSize: '22px',
                          fontWeight: 700,
                          lineHeight: '26px',
                          color: '#ffffff',
                          textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)',
                          pointerEvents: 'none',
                        }}
                      >
                        {formatMult(chip.value)}x
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ zIndex: 50 }}
            >
              <Gem size={22} color="#ffffff" fill="#ffffff" strokeWidth={0} />
              <div className="flex-1 w-[2px]" style={{ backgroundColor: '#ffffff' }} />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div
              className="flex items-center gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              <span
                className="flex items-center gap-1 shrink-0 mr-1"
                style={{
                  ...labelStyle,
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <TrendingUp size={13} /> History
              </span>
              {history.map((value, index) => (
                <span
                  key={index}
                  className="font-bold px-2.5 py-1 shrink-0"
                  style={{
                    fontFamily: FONT,
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: `1px solid ${rarityColor(value)}`,
                    backgroundColor: value >= 100 ? 'rgba(56, 185, 242,0.15)' : '#10151c',
                    color: rarityColor(value),
                  }}
                >
                  {formatMult(value)}x
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4 sm:gap-6 shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <span style={labelStyle}>Win Chance</span>
                <span
                  className="font-bold"
                  style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#fbb01b' }}
                >
                  {winChance.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span style={labelStyle}>Profit</span>
                <span
                  className="font-bold"
                  style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#38B9F2' }}
                >
                  +${profitOnWin.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center" style={{ minHeight: '32px' }}>
                {round && (
                  <div
                    className="flex items-center gap-1.5 font-bold"
                    style={{
                      fontFamily: FONT,
                      fontSize: '18px',
                      fontWeight: 700,
                      color: round.won ? '#38B9F2' : '#ff4d4f',
                    }}
                  >
                    {round.won ? <Sparkles size={18} style={{ color: '#38B9F2' }} /> : null}
                    <span>
                      {round.won
                        ? `WON +$${(round.payout - round.bet).toFixed(2)} (${round.target.toFixed(2)}x)`
                        : `LOST $${round.bet.toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#19212a',
            borderRadius: '8px',
            padding: '16px 20px',
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
            fontFamily: FONT,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>Your Bet</span>
              <span
                className="font-bold"
                style={{
                  fontFamily: FONT,
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#38B9F2',
                  whiteSpace: 'nowrap',
                }}
              >
                ${balance.toFixed(2)}
              </span>
            </div>

            <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>Pengali</span>

            <div className="flex items-center gap-2 shrink-0">
              <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>Auto Roll</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoRoll}
                aria-label="Auto Roll"
                onClick={() => setAutoRoll((prev) => !prev)}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '9999px',
                  border: 'none',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: autoRoll ? 'flex-end' : 'flex-start',
                  backgroundColor: autoRoll ? '#3bb8f2' : '#2b3440',
                  transition: 'background-color 150ms ease',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '9999px',
                    backgroundColor: autoRoll ? '#080d13' : '#6f7d8a',
                    display: 'block',
                  }}
                />
              </button>
            </div>
          </div>

          <div className="limbo-action-area">
            <div className="limbo-inputs">
              <div className="flex-1 min-w-0">
                <label htmlFor="limbo-bet" className="block mb-1.5" style={labelStyle}>
                  Bet Amount
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 font-bold pointer-events-none"
                    style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#fbb01b' }}
                  >
                    $
                  </span>
                  <input
                    id="limbo-bet"
                    type="number"
                    step="0.1"
                    min="0"
                    disabled={isSpinning}
                    value={betInput}
                    onChange={(e) => setBetInput(e.target.value)}
                    className="transition disabled:opacity-50"
                    style={inputStyle}
                  />
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {[
                    { label: 'Min', apply: () => setBetValue(1) },
                    { label: '1/2', apply: () => setBetValue(+(bet / 2).toFixed(2)) },
                    { label: 'X2', apply: () => setBetValue(+(bet * 2).toFixed(2)) },
                    { label: 'Max', apply: () => setBetValue(+balance.toFixed(2)) },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={isSpinning}
                      onClick={action.apply}
                      className="flex-1 transition disabled:opacity-40 hover:brightness-110 active:scale-95"
                      style={quickActionStyle}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <label htmlFor="limbo-target" className="block mb-1.5" style={labelStyle}>
                  Pengali
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 font-bold pointer-events-none"
                    style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#fbb01b' }}
                  >
                    x
                  </span>
                  <input
                    id="limbo-target"
                    type="number"
                    step="0.01"
                    min={MIN_TARGET}
                    disabled={isSpinning}
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="transition disabled:opacity-50"
                    style={inputStyle}
                  />
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {[
                    { label: '-', apply: () => setTargetValue(+(target / 2).toFixed(2)), title: 'Divide by 2' },
                    { label: '+', apply: () => setTargetValue(+(target * 2).toFixed(2)), title: 'Multiply by 2' },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      title={action.title}
                      aria-label={action.title}
                      disabled={isSpinning}
                      onClick={action.apply}
                      className="flex-1 transition disabled:opacity-40 hover:brightness-110 active:scale-95"
                      style={quickActionStyle}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="limbo-bet-action" style={{ display: 'flex', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => handleBetRef.current()}
                disabled={isSpinning}
                className="font-bold transition disabled:opacity-60 hover:brightness-110 active:scale-[0.98]"
                style={{
                  backgroundColor: '#3bb8f2',
                  color: '#080d13',
                  borderRadius: '8px',
                  padding: '0',
                  fontFamily: FONT,
                  fontSize: '15px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  minHeight: '100%',
                  alignSelf: 'stretch',
                  border: 'none',
                  boxShadow: '0 0 20px -3px rgba(59, 184, 242, 0.45)',
                }}
              >
                <Gem size={15} color="#080d13" fill="#080d13" strokeWidth={0} />
                {isSpinning ? 'SPINNING' : 'BET'}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div
              className="text-center font-bold mt-3"
              style={{
                fontFamily: FONT,
                fontSize: '14px',
                fontWeight: 700,
                color: '#ff4d4f',
                backgroundColor: 'rgba(255,77,79,0.12)',
                border: '1px solid #ff4d4f',
                borderRadius: '4px',
                padding: '8px 16px',
              }}
            >
              {errorMessage}
            </div>
          )}
        </div>

        <AuthGuardModal isOpen={!loading && !user} />
      </div>
    </>
  )
}
