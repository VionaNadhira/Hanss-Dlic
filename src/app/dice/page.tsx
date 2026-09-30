'use client'

import React, { useState } from 'react'
import Button from '@/components/ui/button'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { Sparkles } from 'lucide-react'

function playDiceSound(type: 'roll' | 'win' | 'lose') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    if (type === 'roll') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(450, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } else if (type === 'win') {
      ;[523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08)
        gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.18)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.08)
        osc.stop(ctx.currentTime + idx * 0.08 + 0.2)
      })
    } else if (type === 'lose') {
      const a = new Audio('/mines/burst.mp3')
      a.volume = 0.6
      a.play().catch(() => {})
    }
  } catch {}
}

export default function DicePage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()
  const [bet, setBet] = useState(5.00)
  const [target, setTarget] = useState(50)
  const [roll, setRoll] = useState<number | null>(null)
  const [win, setWin] = useState<boolean | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isRolling, setIsRolling] = useState(false)

  const winChance = 100 - target
  const multiplier = Math.max(1.01, +(99 / winChance).toFixed(4))
  const profitOnWin = +(bet * multiplier - bet).toFixed(2)

  const handleRoll = () => {
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

    setIsRolling(true)
    playDiceSound('roll')

    setTimeout(() => {
      const result = Math.floor(Math.random() * 100)
      setRoll(result)
      const isWin = result > target
      setWin(isWin)
      setIsRolling(false)

      if (isWin) {
        const payout = +(bet * multiplier).toFixed(2)
        addBalance(payout)
        playDiceSound('win')
      } else {
        playDiceSound('lose')
      }
    }, 200)
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Gamdom&display=swap');`}</style>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6" style={{ fontFamily: "'Gamdom', sans-serif", backgroundColor: '#080d13' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[8px] overflow-hidden p-0.5" style={{ backgroundColor: '#10151c', border: '1px solid #19212a' }}>
              <img src="/games/dice.webp" alt="Dice" className="w-full h-full object-cover rounded-[8px]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '24px', fontWeight: 700, lineHeight: '29px', color: '#ffffff' }}>Dice</h1>
              <p className="text-sm" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400, color: '#9aa7b4' }}>Set your roll over target, test probability, and win instantly.</p>
            </div>
          </div>
        </div>

        {/* Theater Layout — controls left, stage right */}
        <div className="rounded-[20px_20px_0px_0px] overflow-hidden flex flex-col lg:flex-row" style={{ backgroundColor: '#080d13', border: '1px solid #19212a' }}>
          {/* Controls Column — left */}
          <div className="w-full lg:w-80 p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_132px] items-start gap-x-3 gap-y-4 lg:flex lg:flex-col lg:items-stretch lg:gap-0 justify-between shrink-0 order-2 lg:order-1" style={{ backgroundColor: '#10151c' }}>
            <div className="space-y-4">
              {/* Bet Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}>
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
                    disabled={isRolling}
                    value={bet}
                    onChange={(e) => setBet(Math.max(0, Number(e.target.value)))}
                    className="w-full py-2.5 pl-8 pr-3 font-semibold text-sm transition disabled:opacity-50"
                    style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px', color: '#ffffff', fontFamily: "'Gamdom', sans-serif", fontSize: '16px', fontWeight: 600 }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  <button disabled={isRolling} onClick={() => setBet((prev) => +(Math.max(1, prev / 2)).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>½</button>
                  <button disabled={isRolling} onClick={() => setBet((prev) => +(prev * 2).toFixed(2))} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>2×</button>
                  <button disabled={isRolling} onClick={() => setBet(1.00)} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MIN</button>
                  <button disabled={isRolling} onClick={() => setBet(balance)} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MAX</button>
                </div>
              </div>

              {/* Target Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold uppercase" style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}>
                    Roll Over Target
                  </label>
                  <span className="text-sm font-bold px-2.5 py-0.5" style={{ color: '#fbb01b', backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px' }}>{target}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="98"
                  disabled={isRolling}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="w-full h-2.5 rounded-[4px] cursor-pointer"
                  style={{ accentColor: '#3bb8f2', backgroundColor: '#141a22' }}
                />
                <div className="flex justify-between text-xs font-bold px-1 mt-1" style={{ color: '#6f7d8a', fontFamily: "'Gamdom', sans-serif", fontSize: '12px' }}>
                  <span>2</span>
                  <span>50</span>
                  <span>98</span>
                </div>
              </div>

              {/* Stats Panel — inset */}
              <div className="p-3.5 space-y-2 text-xs" style={{ backgroundColor: '#141a22', border: '1px solid #19212a', borderRadius: '4px' }}>
                <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                  <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Multiplier</span>
                  <span className="font-bold text-sm" style={{ color: '#3bb8f2' }}>{multiplier.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                  <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Win Chance</span>
                  <span className="font-bold" style={{ color: '#fbb01b' }}>{winChance.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center" style={{ color: '#9aa7b4' }}>
                  <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '14px', fontWeight: 400 }}>Profit on Win</span>
                  <span className="font-bold" style={{ color: '#ffffff' }}>+${profitOnWin.toFixed(2)}</span>
                </div>
              </div>

              {errorMessage && (
                <div className="text-xs font-bold p-2.5 rounded-[4px] text-center" style={{ color: '#ff4d4f', backgroundColor: 'rgba(255,77,79,0.12)', border: '1px solid #ff4d4f', fontFamily: "'Gamdom', sans-serif" }}>
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Action Button — primary #3bb8f2 */}
            <div className="w-full col-start-2 row-start-1 self-end flex lg:col-start-auto lg:row-start-auto lg:self-auto lg:block">
              <Button
                onClick={handleRoll}
                disabled={isRolling}
                className="w-full h-12 lg:h-10 font-bold text-sm uppercase border-0 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ borderRadius: '8px', backgroundColor: '#3bb8f2', color: '#080d13', fontFamily: "'Gamdom', sans-serif", fontWeight: 700, boxShadow: '0 0 20px -3px rgba(59, 184, 242, 0.45)', border: '1px solid #3bb8f2' }}
              >
                {isRolling ? 'ROLLING...' : 'ROLL DICE'}
              </Button>
            </div>
          </div>

          {/* Game Stage Area — base surface compact */}
          <div className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center min-h-[340px] sm:min-h-[520px] order-1 lg:order-2" style={{ backgroundColor: '#080d13' }}>
            {/* Slider visualization — Dlicom art with probability overlay */}
            <div className="w-full max-w-lg mb-10">
              <div className="relative w-full">
                <img
                  src="/dice/dlicom.webp"
                  alt="Dlicom"
                  draggable={false}
                  className="w-full h-auto block select-none"
                  style={{ pointerEvents: 'none' }}
                />

                <div
                  className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(8,13,19,0.8)', border: '1px solid #19212a' }}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 transition-all duration-150"
                    style={{ width: `${100 - target}%`, backgroundColor: '#38B9F2' }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 z-10"
                    style={{ left: `${target}%`, backgroundColor: '#ffffff' }}
                  />
                </div>

                {roll !== null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 rounded-[8px] flex items-center justify-center font-bold text-sm border-2 transition-all duration-300"
                    style={{
                      left: `${Math.min(94, Math.max(6, roll))}%`,
                      backgroundColor: win ? '#38B9F2' : '#ff4d4f',
                      color: win ? '#080d13' : '#ffffff',
                      borderColor: win ? '#ffffff' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {roll}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-xs font-bold px-2 mt-3" style={{ color: '#6f7d8a', fontFamily: "'Gamdom', sans-serif", fontSize: '12px' }}>
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>

            {/* Outcome Display — headline teriary #fbb01b when win */}
            <div className="h-16 flex items-center justify-center">
              {roll !== null && (
                <div
                  className={`text-2xl sm:text-4xl font-bold tracking-wide flex items-center gap-2 ${win ? '' : ''}`}
                  style={{ fontFamily: "'Gamdom', sans-serif", fontWeight: 700, color: win ? '#fbb01b' : '#ff4d4f' }}
                >
                  {win ? (
                    <>
                      <Sparkles size={28} style={{ color: '#fbb01b' }} />
                      <span>WON +${profitOnWin.toFixed(2)} ({multiplier.toFixed(2)}x)</span>
                    </>
                  ) : (
                    <span>LOST ${bet.toFixed(2)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <AuthGuardModal isOpen={!loading && !user} />
      </div>
    </>
  )
}
