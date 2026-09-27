'use client'

import React, { useState, useEffect, useRef } from 'react'
import Button from '@/components/ui/button'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { TrendingUp, AlertTriangle } from 'lucide-react'

function playCrashSound(type: 'beep' | 'cashout' | 'boom' | 'countdown' | 'liftoff') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    if (type === 'beep') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.05)
    } else if (type === 'cashout') {
      ;[600, 800, 1200].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07)
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.07)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.15)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.07)
        osc.stop(ctx.currentTime + i * 0.07 + 0.2)
      })
    } else if (type === 'countdown') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } else if (type === 'liftoff') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(300, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.4)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } else if (type === 'boom') {
      try {
        const audio = new window.Audio('/crashsound.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch {}
    }
  } catch {}
}

function generateCrashPoint(): number {
  if (Math.random() < 0.03) {
    return +(Math.random() * 500 + 500).toFixed(2)
  }
  const r = Math.random()
  if (r < 0.03) return 1.00
  const raw = 0.97 / (1 - r)
  return Math.max(1.01, +(Math.floor(Math.min(raw, 500) * 100) / 100))
}

type RoundStatus = 'COUNTDOWN' | 'FLYING' | 'CRASHED'

export default function CrashPage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()

  const [bet, setBet] = useState(5.00)
  const [autoCashout, setAutoCashout] = useState<string>('2.00')
  const [hasBet, setHasBet] = useState(false)
  const [hasCashedOut, setHasCashedOut] = useState(false)
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const [status, setStatus] = useState<RoundStatus>('COUNTDOWN')
  const [countdown, setCountdown] = useState(4)
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00)
  const [crashPoint, setCrashPoint] = useState(2.00)
  const [history, setHistory] = useState<number[]>([1.42, 2.15, 1.10, 8.45, 1.88, 3.20])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const crashPointRef = useRef<number>(2.00)
  const hasBetRef = useRef<boolean>(false)
  const hasCashedOutRef = useRef<boolean>(false)
  const autoCashoutRef = useRef<number | null>(2.00)
  const betRef = useRef<number>(5.00)
  const bgmRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => { hasBetRef.current = hasBet }, [hasBet])
  useEffect(() => { hasCashedOutRef.current = hasCashedOut }, [hasCashedOut])
  useEffect(() => { betRef.current = bet }, [bet])
  useEffect(() => {
    const val = parseFloat(autoCashout)
    autoCashoutRef.current = !isNaN(val) && val >= 1.01 ? val : null
  }, [autoCashout])

  const rocketRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new window.Image()
    img.src = '/crashrocket.png'
    rocketRef.current = img
  }, [])

  useEffect(() => {
    const bgm = new window.Audio('/crashbgm.mp3')
    bgm.loop = true
    bgm.volume = 0.35
    bgmRef.current = bgm
    return () => { bgm.pause(); bgm.src = '' }
  }, [])

  useEffect(() => {
    const bgm = bgmRef.current
    if (!bgm) return
    if (status === 'FLYING') { bgm.currentTime = 0; bgm.play().catch(() => {}) }
    else if (status === 'CRASHED') bgm.pause()
    else if (status === 'COUNTDOWN' && !hasBetRef.current) bgm.pause()
  }, [status])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (status === 'COUNTDOWN') {
      if (countdown > 0) {
        playCrashSound('countdown')
        timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
      } else {
        playCrashSound('liftoff')
        startFlyingRound()
      }
    }
    return () => clearTimeout(timer)
  }, [status, countdown])

  const startFlyingRound = () => {
    const nextCrash = generateCrashPoint()
    crashPointRef.current = nextCrash
    setCrashPoint(nextCrash)
    setStatus('FLYING')
    setCurrentMultiplier(1.00)
    startTimeRef.current = performance.now()

    const loop = (timestamp: number) => {
      const elapsed = (timestamp - startTimeRef.current) / 1000
      const mult = Math.max(1.00, +(Math.pow(Math.E, 0.08 * elapsed)).toFixed(2))

      if (mult >= crashPointRef.current) {
        setCurrentMultiplier(crashPointRef.current)
        setStatus('CRASHED')
        playCrashSound('boom')
        setHistory((prev) => [crashPointRef.current, ...prev.slice(0, 9)])
        setHasBet(false)
        setHasCashedOut(false)
        setCashedOutAt(null)
        setTimeout(() => { setStatus('COUNTDOWN'); setCountdown(4) }, 3000)
        return
      }

      if (hasBetRef.current && !hasCashedOutRef.current && autoCashoutRef.current && mult >= autoCashoutRef.current) {
        triggerCashout(autoCashoutRef.current)
      }

      setCurrentMultiplier(mult)
      animationRef.current = requestAnimationFrame(loop)
    }
    animationRef.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)
    if (status === 'FLYING' || status === 'CRASHED') {
      const progress = Math.min(1, (currentMultiplier - 1) / 10)
      const endX = 40 + (width - 60) * Math.min(1, (currentMultiplier - 1) / 6)
      const endY = height - 25 - (height - 60) * Math.min(1, progress)
      const gradient = ctx.createLinearGradient(0, endY, 0, height - 25)
      if (status === 'CRASHED') {
        gradient.addColorStop(0, 'rgba(255, 68, 68, 0.35)')
        gradient.addColorStop(1, 'rgba(255, 68, 68, 0.0)')
        ctx.strokeStyle = '#ff4444'
      } else {
        gradient.addColorStop(0, 'rgba(0, 199, 77, 0.4)')
        gradient.addColorStop(1, 'rgba(0, 199, 77, 0.0)')
        ctx.strokeStyle = '#38B9F2'
      }
      ctx.beginPath()
      ctx.moveTo(40, height - 25)
      ctx.quadraticCurveTo(40 + (endX - 40) * 0.4, height - 25, endX, endY)
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.lineTo(endX, height - 25)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()
      const rocket = rocketRef.current
      if (rocket && rocket.complete && rocket.naturalWidth > 0) {
        const size = 120
        ctx.shadowColor = status === 'CRASHED' ? '#ff4444' : '#38B9F2'
        ctx.shadowBlur = 14
        ctx.drawImage(rocket, endX - size / 2, endY - size / 2, size, size)
        ctx.shadowBlur = 0
      } else {
        ctx.beginPath()
        ctx.arc(endX, endY, 8, 0, Math.PI * 2)
        ctx.fillStyle = status === 'CRASHED' ? '#ff4444' : '#f5a623'
        ctx.shadowColor = status === 'CRASHED' ? '#ff4444' : '#38B9F2'
        ctx.shadowBlur = 14
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }
  }, [currentMultiplier, status])

  useEffect(() => {
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [])

  const handlePlaceBet = () => {
    setErrorMessage('')
    if (bet <= 0) { setErrorMessage('Bet must be greater than $0'); return }
    if (bet > balance) { setErrorMessage('Insufficient balance'); return }
    const deducted = deductBalance(bet)
    if (!deducted) { setErrorMessage('Failed to deduct balance'); return }
    playCrashSound('beep')
    setHasBet(true)
    setHasCashedOut(false)
    setCashedOutAt(null)
  }

  const triggerCashout = (multiplier: number) => {
    if (!hasBetRef.current || hasCashedOutRef.current) return
    const winAmount = +(betRef.current * multiplier).toFixed(2)
    addBalance(winAmount)
    playCrashSound('cashout')
    setHasCashedOut(true)
    setCashedOutAt(multiplier)
  }

  const handleManualCashout = () => {
    if (status !== 'FLYING' || !hasBet || hasCashedOut) return
    triggerCashout(currentMultiplier)
  }

  const liveWinProfit = +(bet * currentMultiplier - bet).toFixed(2)

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Gamdom&display=swap');`}</style>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6" style={{ fontFamily: "'Gamdom', sans-serif", backgroundColor: '#080d13' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[8px] overflow-hidden p-0.5" style={{ backgroundColor: '#10151c', border: '1px solid #19212a' }}>
              <img src="/games/crash.webp" alt="Crash" className="w-full h-full object-cover rounded-[8px]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '24px', fontWeight: 700, lineHeight: '29px', color: '#ffffff' }}>Crash</h1>
              <p className="text-sm" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400, color: '#9aa7b4' }}>Watch multiplier rocket climb and cash out before detonation.</p>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <span className="text-xs font-bold uppercase flex items-center gap-1 shrink-0 mr-1" style={{ color: '#9aa7b4', fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700 }}>
            <TrendingUp size={13} /> History:
          </span>
          {history.map((val, idx) => {
            const isHigh = val >= 10
            const isMed = val >= 2 && val < 10
            return (
              <span key={idx} className="text-xs font-bold px-2.5 py-1 shrink-0" style={{
                borderRadius: '4px',
                border: '1px solid ' + (isHigh ? '#fbb01b' : isMed ? 'rgba(56, 185, 242,0.3)' : '#19212a'),
                backgroundColor: isHigh ? 'rgba(251,176,27,0.15)' : isMed ? 'rgba(56, 185, 242,0.12)' : '#10151c',
                color: isHigh ? '#fbb01b' : isMed ? '#38B9F2' : '#9aa7b4',
                fontFamily: "'Gamdom', sans-serif",
              }}>
                {val.toFixed(2)}x
              </span>
            )
          })}
        </div>

        {/* Theater Layout — controls left, chart right */}
        <div className="rounded-[20px_20px_0px_0px] overflow-hidden flex flex-col lg:flex-row" style={{ backgroundColor: '#080d13', border: '1px solid #19212a' }}>
          {/* Controls Panel — left */}
          <div className="w-full lg:w-80 p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_132px] items-start gap-x-3 gap-y-4 lg:flex lg:flex-col lg:items-stretch lg:gap-0 justify-between shrink-0 order-2 lg:order-1" style={{ backgroundColor: '#10151c' }}>
            <div className="space-y-4">
              {/* Bet Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}>Bet Amount</label>
                  <span className="text-sm" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', color: '#9aa7b4' }}>Balance: <span className="font-bold" style={{ color: '#fbb01b' }}>${balance.toFixed(2)}</span></span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: '#fbb01b' }}>$</span>
                  <input type="number" step="0.5" min="0.1" disabled={hasBet} value={bet} onChange={(e) => setBet(Math.max(0, Number(e.target.value)))} className="w-full py-2.5 pl-8 pr-3 font-semibold text-sm transition disabled:opacity-50" style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif", fontSize: '16px', fontWeight: 600 }} />
                </div>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  <button disabled={hasBet} onClick={() => setBet((prev) => +(Math.max(1, prev / 2)).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40" style={{ backgroundColor: 'transparent', border: '1px solid #ffffff', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif" }}>½</button>
                  <button disabled={hasBet} onClick={() => setBet((prev) => +(prev * 2).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40" style={{ backgroundColor: 'transparent', border: '1px solid #ffffff', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif" }}>2×</button>
                  <button disabled={hasBet} onClick={() => setBet(1.00)} className="text-xs font-bold py-1.5 transition disabled:opacity-40" style={{ backgroundColor: 'transparent', border: '1px solid #ffffff', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif" }}>MIN</button>
                  <button disabled={hasBet} onClick={() => setBet(balance)} className="text-xs font-bold py-1.5 transition disabled:opacity-40" style={{ backgroundColor: 'transparent', border: '1px solid #ffffff', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif" }}>MAX</button>
                </div>
              </div>

              {/* Auto Cashout */}
              <div>
                <label className="block font-bold uppercase mb-2" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}>Auto Cashout Multiplier</label>
                <div className="relative">
                  <input type="number" step="0.1" min="1.01" disabled={hasBet} placeholder="e.g. 2.00" value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)} className="w-full py-2.5 px-3 font-semibold text-sm transition disabled:opacity-50" style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif", fontSize: '16px', fontWeight: 600 }} />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: '#9aa7b4' }}>x</span>
                </div>
              </div>

              {/* Status Panel */}
              <div className="p-3.5 space-y-2 text-xs" style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px' }}>
                <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                  <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Round State</span>
                  <span className="font-bold uppercase" style={{ color: status === 'FLYING' ? '#38B9F2' : status === 'CRASHED' ? '#ff4d4f' : '#fbb01b', fontFamily: "'Gamdom', sans-serif" }}>{status === 'COUNTDOWN' ? `Starting in ${countdown}s` : status}</span>
                </div>
                {hasBet && <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}><span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Bet Active</span><span className="font-bold" style={{ color: '#fbb01b' }}>${bet.toFixed(2)}</span></div>}
                {hasCashedOut && cashedOutAt && <div className="flex justify-between items-center font-bold" style={{ color: '#38B9F2' }}><span>Cashed Out</span><span>{cashedOutAt.toFixed(2)}x (+${(bet * cashedOutAt - bet).toFixed(2)})</span></div>}
              </div>

              {errorMessage && <div className="text-xs font-bold p-2.5 rounded-[4px] text-center" style={{ color: '#ff4d4f', backgroundColor: 'rgba(255,77,79,0.12)', border: '1px solid #ff4d4f', fontFamily: "'Gamdom', sans-serif" }}>{errorMessage}</div>}
            </div>

            {/* Action Button */}
            <div className="w-full col-start-2 row-start-1 self-stretch flex flex-col justify-center lg:col-start-auto lg:row-start-auto lg:self-auto lg:block">
              {status === 'FLYING' && hasBet && !hasCashedOut ? (
                <button onClick={handleManualCashout} className="w-full h-full lg:h-10 font-bold text-sm uppercase flex flex-col items-center justify-center" style={{ borderRadius: '4px', backgroundColor: '#ffffff', color: '#080d13', border: '1px solid transparent', fontFamily: "'Gamdom', sans-serif", fontWeight: 400 }}>
                  <span>CASH OUT</span><span className="text-[11px] font-bold" style={{ opacity: 0.7 }}>+${liveWinProfit.toFixed(2)} ({(bet * currentMultiplier).toFixed(2)})</span>
                </button>
              ) : hasBet ? (
                <div className="w-full h-full lg:h-10 font-bold text-xs uppercase flex items-center justify-center" style={{ borderRadius: '4px', backgroundColor: 'transparent', color: '#ffffff', border: '1px solid #ffffff', fontFamily: "'Gamdom', sans-serif" }}>{hasCashedOut ? 'CASHED OUT SUCCESS' : 'BET PLACED - IN FLIGHT'}</div>
              ) : (
                <Button onClick={handlePlaceBet} disabled={status === 'FLYING'} className="w-full h-full lg:h-10 font-bold text-sm uppercase border-0" style={{ borderRadius: '4px', backgroundColor: '#ffffff', color: '#080d13', fontFamily: "'Gamdom', sans-serif", fontWeight: 400, boxShadow: 'none', border: '1px solid transparent' }}>
                  {status === 'FLYING' ? 'WAIT FOR NEXT ROUND' : 'PLACE BET'}
                </Button>
              )}
            </div>
          </div>

          {/* Canvas Display — right stage */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center relative min-h-[300px] sm:min-h-[520px] bg-cover bg-center bg-no-repeat order-1 lg:order-2" style={{ backgroundImage: "url('/crash/bg.png')", backgroundColor: '#080d13' }}>
            <div className="absolute z-10 flex flex-col items-center pointer-events-none select-none">
              {status === 'COUNTDOWN' ? (
                <div className="flex flex-col items-center">
                  <div className="text-xs font-bold uppercase mb-1" style={{ color: '#fbb01b', fontFamily: "'Gamdom', sans-serif", letterSpacing: '1.2px' }}>Next Launch In</div>
                  <div className="text-6xl font-bold text-white tracking-tight animate-pulse" style={{ fontFamily: "'Gamdom', sans-serif" }}>{countdown}s</div>
                </div>
              ) : status === 'CRASHED' ? (
                <div className="flex flex-col items-center animate-bounce">
                  <div className="text-xs font-bold uppercase mb-1 flex items-center gap-1" style={{ color: '#ff4d4f', fontFamily: "'Gamdom', sans-serif" }}><AlertTriangle size={15} /> CRASHED</div>
                  <div className="text-5xl sm:text-7xl font-bold" style={{ color: '#ff4d4f', fontFamily: "'Gamdom', sans-serif" }}>{currentMultiplier.toFixed(2)}x</div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="text-6xl sm:text-7xl lg:text-8xl font-bold text-white tracking-tighter" style={{ fontFamily: "'Gamdom', sans-serif" }}>{currentMultiplier.toFixed(2)}x</div>
                  {hasBet && !hasCashedOut && <div className="text-xs font-bold mt-1 px-3 py-1 rounded-[4px]" style={{ color: '#38B9F2', backgroundColor: 'rgba(56, 185, 242,0.12)', border: '1px solid #38B9F2', fontFamily: "'Gamdom', sans-serif" }}>Current Profit: +${liveWinProfit.toFixed(2)}</div>}
                </div>
              )}
            </div>
            <canvas ref={canvasRef} width={650} height={380} className="w-full h-full max-h-[380px]" />
          </div>
        </div>
        <AuthGuardModal isOpen={!loading && !user} />
      </div>
    </>
  )
}
