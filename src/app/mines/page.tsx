'use client'

import React, { useState } from 'react'
import Script from 'next/script'
import Button from '@/components/ui/button'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { Sparkles } from 'lucide-react'

function playSound(type: 'click' | 'gem' | 'boom' | 'win') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    if (type === 'click') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, ctx.currentTime)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.05)
    } else if (type === 'gem') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(520, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } else if (type === 'boom') {
      const a = new Audio('/mines/burst.mp3')
      a.volume = 0.6
      a.play().catch(() => {})
    } else if (type === 'win') {
      ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08)
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.08)
        osc.stop(ctx.currentTime + idx * 0.08 + 0.25)
      })
    }
  } catch {}
}

function calcMultiplier(mines: number, revealed: number): number {
  if (revealed === 0) return 1.0
  let prob = 1.0
  for (let i = 0; i < revealed; i++) {
    prob *= (25 - mines - i) / (25 - i)
  }
  const rawMult = (1 - 0.03) / prob
  return Math.max(1.01, Math.round(rawMult * 100) / 100)
}

export default function MinesPage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()

  const [bet, setBet] = useState(5.00)
  const [minesCount, setMinesCount] = useState(3)
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'busted' | 'cashed_out'>('idle')
  
  const [mineLocations, setMineLocations] = useState<boolean[]>(Array(25).fill(false))
  const [revealedTiles, setRevealedTiles] = useState<boolean[]>(Array(25).fill(false))
  const [lastBustedIndex, setLastBustedIndex] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const revealedCount = revealedTiles.filter(Boolean).length
  const currentMultiplier = gameState === 'playing' || gameState === 'cashed_out'
    ? calcMultiplier(minesCount, revealedCount)
    : 1.00
  const nextMultiplier = calcMultiplier(minesCount, revealedCount + 1)
  const currentWinAmount = +(bet * currentMultiplier).toFixed(2)

  const handleStartGame = () => {
    setErrorMessage('')
    if (bet <= 0) {
      setErrorMessage('Bet must be greater than $0')
      return
    }
    if (bet > balance) {
      setErrorMessage('Insufficient balance')
      return
    }

    const deducted = deductBalance(bet)
    if (!deducted) {
      setErrorMessage('Failed to deduct balance')
      return
    }

    playSound('click')

    const locations = Array(25).fill(false)
    let placed = 0
    while (placed < minesCount) {
      const idx = Math.floor(Math.random() * 25)
      if (!locations[idx]) {
        locations[idx] = true
        placed++
      }
    }

    setMineLocations(locations)
    setRevealedTiles(Array(25).fill(false))
    setLastBustedIndex(null)
    setGameState('playing')
  }

  const handleTileClick = (index: number) => {
    if (gameState !== 'playing') return
    if (revealedTiles[index]) return

    const newRevealed = [...revealedTiles]
    newRevealed[index] = true
    setRevealedTiles(newRevealed)

    if (mineLocations[index]) {
      playSound('boom')
      setLastBustedIndex(index)
      setGameState('busted')
    } else {
      playSound('gem')
      const newRevealedCount = revealedCount + 1
      const totalSafeTiles = 25 - minesCount

      if (newRevealedCount >= totalSafeTiles) {
        const maxPayout = +(bet * calcMultiplier(minesCount, totalSafeTiles)).toFixed(2)
        addBalance(maxPayout)
        playSound('win')
        setGameState('cashed_out')
      }
    }
  }

  const handleCashOut = () => {
    if (gameState !== 'playing' || revealedCount === 0) return
    playSound('win')
    addBalance(currentWinAmount)
    setGameState('cashed_out')
  }

  return (
    <>
      <Script type="module" src="https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js" strategy="beforeInteractive" />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Gamdom&display=swap');`}</style>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6" style={{ fontFamily: "'Gamdom', sans-serif", backgroundColor: '#080d13' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[8px] overflow-hidden p-0.5" style={{ backgroundColor: '#10151c', border: '1px solid #19212a' }}>
              <img src="/games/mines.webp" alt="Mines" className="w-full h-full object-cover rounded-[8px]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '24px', fontWeight: 700, lineHeight: '29px', color: '#ffffff' }}>Mines</h1>
              <p className="text-sm" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400, color: '#9aa7b4' }}>Reveal diamonds, avoid bombs, and cash out anytime.</p>
            </div>
          </div>
        </div>

        {/* Theater Layout — controls left, grid right */}
        <div className="rounded-[20px_20px_0px_0px] overflow-hidden flex flex-col lg:flex-row" style={{ backgroundColor: '#080d13', border: '1px solid #19212a' }}>
          {/* Controls Panel — left */}
          <div className="w-full lg:w-80 p-4 sm:p-6 flex flex-col justify-between shrink-0 order-2 lg:order-1" style={{ backgroundColor: '#10151c' }}>
            <div className="flex flex-col gap-4 w-full">
              {/* Error message - full width */}
              {errorMessage && (
                <div className="text-xs font-bold p-2.5 rounded-[4px] text-center" style={{ color: '#ff4d4f', backgroundColor: 'rgba(255,77,79,0.12)', border: '1px solid #ff4d4f', fontFamily: "'Gamdom', sans-serif" }}>
                  {errorMessage}
                </div>
              )}
              {/* Mobile: 2-col grid for controls and info, then button */}
              <div className="sm:hidden">
                <div className="grid grid-cols-2 gap-3">
                  {/* Left column: controls */}
                  <div className="flex flex-col gap-2">
                    {/* Bet Amount */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4', letterSpacing: '0px' }}>
                          Bet Amount
                        </label>
                        <span className="text-sm" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', color: '#9aa7b4' }}>Balance: <span className="font-bold" style={{ color: '#fbb01b' }}>${balance.toFixed(2)}</span></span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: '#fbb01b' }}>$</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.1"
                          disabled={gameState === 'playing'}
                          value={bet}
                          onChange={(e) => setBet(Math.max(0, Number(e.target.value)))}
                          className="w-full py-2.5 pl-8 pr-3 font-semibold text-sm transition disabled:opacity-50"
                          style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif", fontSize: '16px', fontWeight: 600 }}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mt-2">
                        <button disabled={gameState === 'playing'} onClick={() => setBet((prev) => +(Math.max(1, prev / 2)).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>½</button>
                        <button disabled={gameState === 'playing'} onClick={() => setBet((prev) => +(prev * 2).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>2×</button>
                        <button disabled={gameState === 'playing'} onClick={() => setBet(1.00)} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MIN</button>
                        <button disabled={gameState === 'playing'} onClick={() => setBet(balance)} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MAX</button>
                      </div>
                    </div>

                    {/* Mines Count Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}>
                          Mines Count
                        </label>
                        <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#fbb01b' }}>
<img src="/mines/bomb.png" alt="Bomb" className="w-3 h-3" /> {minesCount} Bombs
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 3, 5, 10, 24].map((count) => (
                          <button
                            key={count}
                            disabled={gameState === 'playing'}
                            onClick={() => setMinesCount(count)}
                            className="py-2 text-xs font-bold transition disabled:opacity-40"
                            style={{
                              borderRadius: '4px',
                              border: minesCount === count ? '1px solid #3bb8f2' : '1px solid #19212a',
                              backgroundColor: minesCount === count ? '#3bb8f2' : 'transparent',
                              color: minesCount === count ? '#080d13' : '#9aa7b4',
                              fontFamily: "'Gamdom', sans-serif",
                            }}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Right column: info */}
                  <div className="flex flex-col gap-2">
                    {/* Stats Panel — inset surface */}
                    <div className="p-3.5 space-y-2 text-xs" style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px' }}>
                      <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                        <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Current Multiplier</span>
                        <span className="font-bold text-sm" style={{ color: '#3bb8f2' }}>
                          {revealedCount > 0 ? `${currentMultiplier.toFixed(2)}x` : '1.00x'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                        <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Next Tile Multiplier</span>
                        <span className="font-bold" style={{ color: '#fbb01b' }}>
                          {nextMultiplier.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                        <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Safe Remaining</span>
                        <span className="font-bold" style={{ color: '#ffffff' }}>
                          {25 - minesCount - revealedCount} / {25 - minesCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Button full width */}
                <div className="mt-4">
                  {gameState === 'playing' ? (
                    <button
                      onClick={handleCashOut}
                      disabled={revealedCount === 0}
                      className={`w-full h-12 lg:h-10 font-bold text-sm uppercase flex flex-col items-center justify-center transition-all ${revealedCount > 0 ? 'hover:brightness-110 active:scale-[0.98]' : 'opacity-40 cursor-not-allowed'}`}
                      style={{
                        borderRadius: '8px',
                        borderWidth: '1px',
                        backgroundColor: revealedCount > 0 ? '#3bb8f2' : 'transparent',
                        color: revealedCount > 0 ? '#080d13' : '#3bb8f2',
                        borderColor: '#3bb8f2',
                        fontFamily: "'Gamdom', sans-serif",
                        fontWeight: 700,
                        boxShadow: revealedCount > 0 ? '0 0 20px -3px rgba(59, 184, 242, 0.45)' : 'none',
                      }}
                    >
                      <span>CASH OUT</span>
                      {revealedCount > 0 && (
                        <span className="text-[11px] font-bold" style={{ color: '#080d13', opacity: 0.85 }}>
                          ${currentWinAmount.toFixed(2)} ({currentMultiplier.toFixed(2)}x)
                        </span>
                      )}
                    </button>
                  ) : (
                    <Button
                      onClick={handleStartGame}
                      className="w-full h-12 lg:h-10 font-bold text-sm uppercase border-0 transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{ borderRadius: '8px', backgroundColor: '#3bb8f2', color: '#080d13', fontFamily: "'Gamdom', sans-serif", fontWeight: 700, boxShadow: '0 0 20px -3px rgba(59, 184, 242, 0.45)', border: '1px solid #3bb8f2' }}
                    >
                      BET & START
                    </Button>
                  )}
                </div>
              </div>
              {/* Desktop: preserve original layout */}
              <div className="hidden sm:block">
                <div className="space-y-4">
                  {/* Bet Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4', letterSpacing: '0px' }}>
                        Bet Amount
                      </label>
                      <span className="text-sm" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', color: '#9aa7b4' }}>Balance: <span className="font-bold" style={{ color: '#fbb01b' }}>${balance.toFixed(2)}</span></span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: '#fbb01b' }}>$</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        disabled={gameState === 'playing'}
                        value={bet}
                        onChange={(e) => setBet(Math.max(0, Number(e.target.value)))}
                        className="w-full py-2.5 pl-8 pr-3 font-semibold text-sm transition disabled:opacity-50"
                        style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif", fontSize: '16px', fontWeight: 600 }}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      <button disabled={gameState === 'playing'} onClick={() => setBet((prev) => +(Math.max(1, prev / 2)).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>½</button>
                      <button disabled={gameState === 'playing'} onClick={() => setBet((prev) => +(prev * 2).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>2×</button>
                      <button disabled={gameState === 'playing'} onClick={() => setBet(1.00)} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MIN</button>
                      <button disabled={gameState === 'playing'} onClick={() => setBet(balance)} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MAX</button>
                    </div>
                  </div>

                  {/* Mines Count Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}>
                        Mines Count
                      </label>
                      <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#fbb01b' }}>
                        <img src="/mines/bomb.png" alt="Bomb" className="w-3 h-3" /> {minesCount} Bombs
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 3, 5, 10, 24].map((count) => (
                        <button
                          key={count}
                          disabled={gameState === 'playing'}
                          onClick={() => setMinesCount(count)}
                          className="py-2 text-xs font-bold transition disabled:opacity-40"
                          style={{
                            borderRadius: '4px',
                            border: minesCount === count ? '1px solid #3bb8f2' : '1px solid #19212a',
                            backgroundColor: minesCount === count ? '#3bb8f2' : 'transparent',
                            color: minesCount === count ? '#080d13' : '#9aa7b4',
                            fontFamily: "'Gamdom', sans-serif",
                          }}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stats Panel — inset surface */}
                  <div className="p-3.5 space-y-2 text-xs" style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px' }}>
                    <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                      <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Current Multiplier</span>
                      <span className="font-bold text-sm" style={{ color: '#3bb8f2' }}>
                        {revealedCount > 0 ? `${currentMultiplier.toFixed(2)}x` : '1.00x'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                      <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Next Tile Multiplier</span>
                      <span className="font-bold" style={{ color: '#fbb01b' }}>
                        {nextMultiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                      <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Safe Remaining</span>
                      <span className="font-bold" style={{ color: '#ffffff' }}>
                        {25 - minesCount - revealedCount} / {25 - minesCount}
                      </span>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="text-xs font-bold p-2.5 rounded-[4px] text-center" style={{ color: '#ff4d4f', backgroundColor: 'rgba(255,77,79,0.12)', border: '1px solid #ff4d4f', fontFamily: "'Gamdom', sans-serif" }}>
                      {errorMessage}
                    </div>
                  )}
                </div>

                {/* Action Button — token button: primary #3bb8f2 */}
                <div className="w-full col-start-2 row-start-1 self-end flex lg:col-start-auto lg:row-start-auto lg:self-auto lg:block">
                  {gameState === 'playing' ? (
                    <button
                      onClick={handleCashOut}
                      disabled={revealedCount === 0}
                      className={`w-full h-12 lg:h-10 font-bold text-sm uppercase flex flex-col items-center justify-center transition-all ${revealedCount > 0 ? 'hover:brightness-110 active:scale-[0.98]' : 'opacity-40 cursor-not-allowed'}`}
                      style={{
                        borderRadius: '8px',
                        borderWidth: '1px',
                        backgroundColor: revealedCount > 0 ? '#3bb8f2' : 'transparent',
                        color: revealedCount > 0 ? '#080d13' : '#3bb8f2',
                        borderColor: '#3bb8f2',
                        fontFamily: "'Gamdom', sans-serif",
                        fontWeight: 700,
                        boxShadow: revealedCount > 0 ? '0 0 20px -3px rgba(59, 184, 242, 0.45)' : 'none',
                      }}
                    >
                      <span>CASH OUT</span>
                      {revealedCount > 0 && (
                        <span className="text-[11px] font-bold" style={{ color: '#080d13', opacity: 0.85 }}>
                          ${currentWinAmount.toFixed(2)} ({currentMultiplier.toFixed(2)}x)
                        </span>
                      )}
                    </button>
                  ) : (
                    <Button
                      onClick={handleStartGame}
                      className="w-full h-12 lg:h-10 font-bold text-sm uppercase border-0 transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{ borderRadius: '8px', backgroundColor: '#3bb8f2', color: '#080d13', fontFamily: "'Gamdom', sans-serif", fontWeight: 700, boxShadow: '0 0 20px -3px rgba(59, 184, 242, 0.45)', border: '1px solid #3bb8f2' }}
                    >
                      BET & START
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5x5 Grid Area — right stage */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[360px] sm:min-h-[520px] order-1 lg:order-2" style={{ backgroundColor: '#080d13' }}>
            <div className="h-10 mb-4 flex items-center justify-center">
              {gameState === 'busted' && (
                <div className="px-5 py-2 font-bold text-xs uppercase flex items-center gap-1.5" style={{ backgroundColor: 'rgba(255,77,79,0.15)', border: '1px solid #ff4d4f', borderRadius: '4px', color: '#ff4d4f', fontFamily: "'Gamdom', sans-serif" }}>
                  <img src="/mines/bomb.png" alt="Bomb" className="w-4 h-4" /> BUSTED! You hit a boomb.
                </div>
              )}
              {gameState === 'cashed_out' && (
                <div className="px-6 py-2 font-bold text-xs uppercase flex items-center gap-2" style={{ backgroundColor: 'rgba(56, 185, 242,0.15)', border: '1px solid #38B9F2', borderRadius: '4px', color: '#38B9F2', fontFamily: "'Gamdom', sans-serif" }}>
                  <Sparkles size={16} /> Cashed Out: +${(currentWinAmount - bet).toFixed(2)} (${currentWinAmount.toFixed(2)})
                </div>
              )}
              {gameState === 'playing' && revealedCount > 0 && (
                <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#fbb01b', fontFamily: "'Gamdom', sans-serif" }}>
                  <img src="/mines/diamond.png" alt="Diamond" className="w-4 h-4" />
                  {revealedCount} Gems Uncovered • Current Profit: +${(currentWinAmount - bet).toFixed(2)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 gap-3 p-4 rounded-[20px] border max-w-[460px] w-full aspect-square" style={{ backgroundColor: '#10151c', borderColor: '#19212a' }}>
              {Array.from({ length: 25 }).map((_, index) => {
                const isRevealed = revealedTiles[index]
                const isMine = mineLocations[index]
                const isGameOver = gameState === 'busted' || gameState === 'cashed_out'
                const showDimmedMine = isGameOver && !isRevealed && isMine
                const showDimmedGem = isGameOver && !isRevealed && !isMine

                return (
                  <button
                    key={index}
                    disabled={gameState !== 'playing' || isRevealed}
                    onClick={() => handleTileClick(index)}
                    className="relative rounded-[8px] flex items-center justify-center transition-all duration-200 select-none"
                    style={{
                      backgroundColor: isRevealed ? (isMine ? '#ff4d4f' : 'rgba(56, 185, 242,0.15)') : showDimmedMine || showDimmedGem ? '#141a22' : gameState === 'playing' ? '#080d13' : '#10151c',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: isRevealed ? (isMine ? '#ff4d4f' : '#38B9F2') : '#19212a',
                      opacity: showDimmedMine || showDimmedGem ? 0.4 : 1,
                    }}
                  >
                    {isRevealed && isMine && (
                       <img src="/mines/bomb.png" alt="Bomb" style={{ width: '42px', height: '42px' }} />
                     )}
                    {isRevealed && !isMine && <img src="/mines/diamond.png" alt="Diamond" className="w-10 h-10 object-contain" />}
                    {showDimmedMine && (
                       <img src="/mines/bomb.png" alt="Bomb" style={{ width: '36px', height: '36px', opacity: 0.6 }} />
                     )}
                    {showDimmedGem && <img src="/mines/diamond.png" alt="Diamond" className="w-9 h-9 object-contain opacity-40" />}
                    {!isRevealed && !isGameOver && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2b3440' }} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <AuthGuardModal isOpen={!loading && !user} />
      </div>
      </>
  )
}
