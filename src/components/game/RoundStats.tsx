'use client'

import React, { useEffect, useState, useRef } from 'react'
import { ArrowUpRight, ArrowDownRight, Clock, Target, Activity } from 'lucide-react'
import { playGameSound } from '@/lib/game/sound'

interface RoundStatsProps {
  targetPrice: number | null
  currentPrice: number | null
  endAt: number
  serverTimeOffset: number // clientNow + serverTimeOffset = serverNow
}

export default function RoundStats({
  targetPrice,
  currentPrice,
  endAt,
  serverTimeOffset,
}: RoundStatsProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  const lastTickedRef = useRef<number>(-1)

  useEffect(() => {
    const updateCountdown = () => {
      const nowServerSec = Math.floor((Date.now() + serverTimeOffset) / 1000)
      const diff = Math.max(0, endAt - nowServerSec)
      setSecondsLeft(diff)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 500)
    return () => clearInterval(timer)
  }, [endAt, serverTimeOffset])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const isUnder10s = secondsLeft <= 10
  const isBettingClosed = secondsLeft <= 10 && secondsLeft > 0
  const isEnded = secondsLeft === 0

  // Sound effect: 10-second countdown tension ticks leading to settle
  useEffect(() => {
    if (secondsLeft <= 10 && secondsLeft > 0 && secondsLeft !== lastTickedRef.current) {
      lastTickedRef.current = secondsLeft
      playGameSound('tick')
    } else if (secondsLeft === 0 && lastTickedRef.current > 0) {
      lastTickedRef.current = 0
      playGameSound('settle')
    }
  }, [secondsLeft])

  const delta =
    currentPrice !== null && targetPrice !== null ? currentPrice - targetPrice : 0
  const deltaPercent =
    targetPrice && targetPrice > 0 ? (delta / targetPrice) * 100 : 0
  const isAbove = delta >= 0

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 bg-gamdom-surface border border-gamdom-border rounded-xl select-none">
      {/* Price to beat */}
      <div className="flex flex-col justify-center">
        <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim flex items-center gap-1">
          <Target size={12} className="text-gamdom-gold" /> Price to Beat
        </span>
        <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
          {targetPrice !== null ? `$${targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Locking...'}
        </div>
      </div>

      {/* Now (Live spot price) */}
      <div className="flex flex-col justify-center border-x border-gamdom-border px-2 sm:px-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim flex items-center gap-1">
          <Activity size={12} className={isAbove ? 'text-gamdom-green' : 'text-gamdom-red'} /> Now
        </span>
        <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
          <span
            className={`text-sm sm:text-base font-extrabold ${
              isAbove ? 'text-gamdom-green' : 'text-gamdom-red'
            }`}
          >
            {currentPrice !== null
              ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '---'}
          </span>
          {targetPrice !== null && currentPrice !== null && (
            <span
              className={`text-[10px] font-bold flex items-center ${
                isAbove ? 'text-gamdom-green' : 'text-gamdom-red'
              }`}
            >
              {isAbove ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(delta).toFixed(2)} ({isAbove ? '+' : ''}
              {deltaPercent.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* Ends in / Countdown */}
      <div className="flex flex-col justify-center text-right sm:text-left">
        <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim flex items-center justify-end sm:justify-start gap-1">
          <Clock size={12} className={isUnder10s ? 'text-amber-400 animate-pulse' : 'text-gamdom-textDim'} /> Ends In
        </span>
        <div className="mt-0.5">
          {isEnded ? (
            <span className="text-xs sm:text-sm font-bold text-gamdom-gold uppercase tracking-wider">
              Settling...
            </span>
          ) : isBettingClosed ? (
            <div className="flex items-center justify-end sm:justify-start gap-1.5">
              <span className="text-xs sm:text-sm font-black text-amber-400 font-mono animate-pulse">
                {timeFormatted}
              </span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Closed
              </span>
            </div>
          ) : (
            <span className="text-sm sm:text-base font-extrabold text-white font-mono">
              {timeFormatted}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
