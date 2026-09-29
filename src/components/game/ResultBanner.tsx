'use client'

import React from 'react'
import { ArrowUp, ArrowDown, X, Trophy, AlertTriangle } from 'lucide-react'

interface ResultBannerProps {
  roundId: string
  result: 'up' | 'down' | 'void'
  targetPrice: number | null
  finalPrice: number | null
  userPayout: number | null
  onDismiss: () => void
}

export default function ResultBanner({
  roundId,
  result,
  targetPrice,
  finalPrice,
  userPayout,
  onDismiss,
}: ResultBannerProps) {
  const isUp = result === 'up'
  const isVoid = result === 'void'

  return (
    <div
      aria-live="polite"
      role="status"
      className={`relative w-full p-3.5 sm:p-4 rounded-xl border animate-in slide-in-from-top duration-300 select-none shadow-xl flex items-center justify-between gap-3 ${
        isVoid
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          : isUp
          ? 'bg-gamdom-green/15 border-gamdom-green/40 text-white'
          : 'bg-gamdom-red/15 border-gamdom-red/40 text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isVoid
              ? 'bg-amber-500/20 text-amber-400'
              : isUp
              ? 'bg-gamdom-green/20 text-gamdom-green shadow-gamdom-green'
              : 'bg-gamdom-red/20 text-gamdom-red shadow-[0_0_15px_-3px_rgba(255,77,79,0.45)]'
          }`}
        >
          {isVoid ? (
            <AlertTriangle size={20} />
          ) : isUp ? (
            <ArrowUp size={22} strokeWidth={3} />
          ) : (
            <ArrowDown size={22} strokeWidth={3} />
          )}
        </div>

        <div>
          <div className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <span>
              {isVoid
                ? 'Round Voided (All Stakes Refunded)'
                : `${isUp ? 'UP (Bullish)' : 'DOWN (Bearish)'} WON`}
            </span>
            {userPayout !== null && userPayout > 0 && (
              <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-gamdom-gold text-gamdom-dark flex items-center gap-1">
                <Trophy size={11} /> +{userPayout.toLocaleString()} PTS
              </span>
            )}
          </div>
          <div className="text-[11px] text-gamdom-text mt-0.5">
            Round: <span className="font-mono text-white">{roundId}</span> | Target: $
            {targetPrice?.toFixed(2) ?? '---'} | Final: ${finalPrice?.toFixed(2) ?? '---'}
          </div>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="p-1 rounded-lg text-gamdom-text hover:text-white hover:bg-gamdom-card transition shrink-0"
        aria-label="Dismiss result banner"
      >
        <X size={16} />
      </button>
    </div>
  )
}
