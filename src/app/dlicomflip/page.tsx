'use client'

import React, { useState, useRef, useEffect } from 'react'
import AuthGuardModal from '@/components/AuthGuardModal'
import Coin from '@/components/dlicomflip/Coin'
import BetPanel from '@/components/dlicomflip/BetPanel'
import History from '@/components/dlicomflip/History'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { Sparkles } from 'lucide-react'

type CoinColor = 'pink' | 'yellow'
type GamePhase = 'idle' | 'betting' | 'flipping' | 'result'

// ── Game configuration ─────────────────────────────────────────────
const FLIP_DURATION = 4000 // ms — single source of truth for animation length
const WIN_MULTIPLIER = 1.96 // payout multiplier on win
const PINK_PROBABILITY = 0.5 // 50% / 50% — no per-color edge
const FULL_SPINS = 4 // 4 x 360° base rotation per flip
const MIN_BET = 0.1
const HISTORY_LIMIT = 12
// ────────────────────────────────────────────────────────────────────

// Result is decided ONCE per round; animation only visualizes it.
function pickResult(): CoinColor {
  return Math.random() < PINK_PROBABILITY ? 'pink' : 'yellow'
}

function computeRotation(previousRotation: number, result: CoinColor): number {
  const fullSpins = FULL_SPINS * 360
  const extra = result === 'pink' ? 180 : 0
  // Always produce a NEW transform value so browsers restart the animation.
  const base = Math.round(previousRotation / fullSpins) * fullSpins
  return base + fullSpins + extra
}

// easeOutQuart — fast spin, slow settle
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

// ── Audio ───────────────────────────────────────────────────────────
const SPILL_SOUND = '/dlicomflip/coin-spill.mp3'
const DROP_SOUND = '/dlicomflip/coin-drop.mp3'

function safePlay(src: string, volume = 0.6): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  try {
    const audio = new Audio(src)
    audio.volume = volume
    audio.play().catch(() => {})
    return audio
  } catch {
    return null
  }
}
// ────────────────────────────────────────────────────────────────────

export default function DlicomFlipPage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()

  const [bet, setBet] = useState(1.0)
  const [selectedColor, setSelectedColor] = useState<CoinColor | null>(null)
  const [result, setResult] = useState<CoinColor | null>(null)
  const [isFlipping, setIsFlipping] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle')
  const [outcomeMessage, setOutcomeMessage] = useState('')
  const [outcomeType, setOutcomeType] = useState<'win' | 'lose' | ''>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [history, setHistory] = useState<CoinColor[]>([]) // most recent first

  const rotationRef = useRef(0)
  const betRef = useRef(bet)
  const selectedRef = useRef<CoinColor | null>(null)
  const flippingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const spillRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => { betRef.current = bet }, [bet])
  useEffect(() => { selectedRef.current = selectedColor }, [selectedColor])

  // Locked during flipping — prevents double-click / spam-click races
  const isLocked = isFlipping || gamePhase === 'flipping'

  // ── Bet amount handlers ───────────────────────────────────────────
  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setBet(Number.isFinite(val) ? Math.max(0, val) : 0)
  }

  const handleHalfBet = () => setBet((prev) => Math.max(MIN_BET, +(prev / 2).toFixed(2)))

  const handleDoubleBet = () => setBet((prev) => +(prev * 2).toFixed(2))

  const handleMinBet = () => setBet(MIN_BET)

  const handleMaxBet = () => setBet(+Math.max(0, balance).toFixed(2))

  const handleSelectColor = (color: CoinColor) => {
    if (isLocked) return
    setSelectedColor(color)
    setOutcomeMessage('')
    setOutcomeType('')
  }

  // ── Core round logic ──────────────────────────────────────────────
  const handlePlaceBet = () => {
    // Anti double-bet: guard via ref (synchronous) + state
    if (flippingRef.current) return
    if (!user || loading) return

    const currentBet = betRef.current
    const choice = selectedRef.current

    setErrorMessage(null)
    setOutcomeMessage('')
    setOutcomeType('')

    // Validation
    if (!choice) {
      setErrorMessage('Please select Pink or Yellow')
      return
    }
    if (currentBet < MIN_BET) {
      setErrorMessage(`Minimum bet is $${MIN_BET.toFixed(2)}`)
      return
    }
    if (currentBet > balance) {
      setErrorMessage('Insufficient balance')
      return
    }

    // Deduct bet using existing balance system
    const deducted = deductBalance(currentBet)
    if (!deducted) {
      setErrorMessage('Failed to deduct balance')
      return
    }

    // Determine result ONCE at round start
    const roundResult = pickResult()
    setResult(roundResult)

    // Lock UI
    flippingRef.current = true
    setIsFlipping(true)
    setGamePhase('flipping')

    // Start coin-spill sound (tied to flip, stopped at flip end)
    spillRef.current = safePlay(SPILL_SOUND, 0.5)

    // New rotation value (never same transform as before)
    const from = rotationRef.current
    const targetRotation = computeRotation(from, roundResult)
    const span = targetRotation - from
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / FLIP_DURATION, 1)
      const eased = easeOutQuart(progress)
      const current = from + span * eased
      rotationRef.current = current
      setRotation(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
        return
      }

      // ── Animation complete (exactly FLIP_DURATION ms) ──
      rotationRef.current = targetRotation
      setRotation(targetRotation)
      flippingRef.current = false
      setIsFlipping(false)
      setGamePhase('result')

      // Stop spill sound at flip end regardless of its length
      if (spillRef.current) {
        try { spillRef.current.pause(); spillRef.current.currentTime = 0 } catch {}
        spillRef.current = null
      }

      // Play coin-drop sound when coin has settled
      safePlay(DROP_SOUND, 0.6)

      // Determine win/lose from the SAME result used for animation
      const didWin = choice === roundResult

      if (didWin) {
        const payout = +(currentBet * WIN_MULTIPLIER).toFixed(2)
        addBalance(payout)
        setOutcomeMessage(`WIN +$${payout.toFixed(2)} (${WIN_MULTIPLIER}x)`)
        setOutcomeType('win')
      } else {
        setOutcomeMessage(`LOSE -$${currentBet.toFixed(2)}`)
        setOutcomeType('lose')
      }

      // Update history (newest first)
      setHistory((prev) => [roundResult, ...prev].slice(0, HISTORY_LIMIT))
    }

    rafRef.current = requestAnimationFrame(step)
  }

  // ── Cleanup on unmount (prevents setState after unmount) ──────────
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (spillRef.current) {
        try { spillRef.current.pause(); spillRef.current.src = '' } catch {}
        spillRef.current = null
      }
      flippingRef.current = false
    }
  }, [])

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Gamdom&display=swap');`}</style>
      <div
        className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6"
        style={{ fontFamily: "'Gamdom', sans-serif", backgroundColor: '#080d13' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[8px] overflow-hidden p-0.5"
              style={{ backgroundColor: '#10151c', border: '1px solid #19212a' }}
            >
              <img
                src="/dlicomflip/logo.png"
                alt="Dlicom Flip"
                className="w-full h-full object-cover rounded-[8px]"
              />
            </div>
            <div>
              <h1
                className="text-xl sm:text-2xl font-bold uppercase"
                style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '24px', fontWeight: 700, lineHeight: '29px', color: '#ffffff' }}
              >
                Dlicom Flip
              </h1>
              <p className="text-sm" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400, color: '#9aa7b4' }}>
                Choose Pink or Yellow, flip the coin, and win {WIN_MULTIPLIER}x
              </p>
            </div>
          </div>
        </div>

        {/* Theater Layout — controls left, coin stage right */}
        <div
          className="rounded-[20px_20px_0px_0px] overflow-hidden flex flex-col lg:flex-row"
          style={{ backgroundColor: '#080d13', border: '1px solid #19212a' }}
        >
          {/* Controls Column */}
          <div
            className="w-full lg:w-80 p-4 sm:p-6 flex flex-col justify-between shrink-0 order-2 lg:order-1"
            style={{ backgroundColor: '#10151c' }}
          >
            <BetPanel
              bet={bet}
              onBetChange={handleBetChange}
              onHalfBet={handleHalfBet}
              onDoubleBet={handleDoubleBet}
              onMinBet={handleMinBet}
              onMaxBet={handleMaxBet}
              onSelectColor={handleSelectColor}
              selectedColor={selectedColor}
              isFlipping={isLocked}
              onPlaceBet={handlePlaceBet}
              userBalance={balance}
              errorMessage={errorMessage}
            />
          </div>

          {/* Game Stage */}
          <div
            className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center min-h-[340px] sm:min-h-[520px] order-1 lg:order-2"
            style={{ backgroundColor: '#080d13' }}
          >
            {/* Outcome Banner */}
            <div className="flex items-center justify-center z-10 mb-4" style={{ minHeight: '32px' }}>
              {outcomeMessage && (
                <div
                  className="px-4 py-1 sm:px-5 sm:py-1.5 rounded-full font-bold text-xs uppercase flex items-center gap-2 shadow-xl"
                  style={{
                    backgroundColor: outcomeType === 'win' ? '#3bb8f2' : '#ff4d4f',
                    color: outcomeType === 'win' ? '#080d13' : '#ffffff',
                    border: '1px solid',
                    borderColor: outcomeType === 'win' ? '#3bb8f2' : '#ff4d4f',
                    boxShadow: outcomeType === 'win' ? '0 0 20px -3px rgba(59, 184, 242, 0.5)' : 'none',
                    fontFamily: "'Gamdom', sans-serif",
                  }}
                >
                  {outcomeType === 'win' && <Sparkles size={13} />}
                  <span>{outcomeMessage}</span>
                </div>
              )}
            </div>

            {/* Coin */}
            <div className="relative flex items-center justify-center w-full">
              <Coin isFlipping={isLocked} rotation={rotation} />
              {/* Glow overlay */}
              <div
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
                style={{ zIndex: -1 }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: '160px',
                    height: '160px',
                    boxShadow: isLocked
                      ? '0 0 40px rgba(59, 184, 242, 0.55)'
                      : '0 0 24px rgba(59, 184, 242, 0.28)',
                    transition: 'box-shadow 300ms ease',
                  }}
                />
              </div>
            </div>

            {/* Result label */}
            <div className="h-8 flex items-center justify-center mt-4">
              {result && !isLocked && gamePhase === 'result' && (
                <div
                  className="text-lg sm:text-xl font-bold uppercase tracking-wide"
                  style={{ fontFamily: "'Gamdom', sans-serif", color: result === 'pink' ? '#ff6b6b' : '#fbb01b' }}
                >
                  {result === 'pink' ? '🩷 Pink' : '🟡 Yellow'}
                </div>
              )}
            </div>

            <History history={history} />
          </div>
        </div>

        <AuthGuardModal isOpen={!loading && !user} />
      </div>
    </>
  )
}
