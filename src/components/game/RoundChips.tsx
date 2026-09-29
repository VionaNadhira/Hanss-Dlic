'use client'

import React from 'react'

export interface RoundSummary {
  id: string
  asset: string
  startAt: number
  endAt: number
  status: string
}

interface RoundChipsProps {
  currentRound: RoundSummary | null
  presaleRounds: RoundSummary[]
  selectedRoundId: string
  onSelectRound: (roundId: string) => void
}

function formatTime(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function RoundChips({
  currentRound,
  presaleRounds,
  selectedRoundId,
  onSelectRound,
}: RoundChipsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none" style={{ scrollbarWidth: 'none' }}>
      <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim shrink-0 mr-1">
        Rounds:
      </span>

      {/* Live round chip */}
      {currentRound && (
        <button
          onClick={() => onSelectRound(currentRound.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 border ${
            selectedRoundId === currentRound.id
              ? 'bg-gamdom-card border-gamdom-green text-white shadow-sm'
              : 'bg-gamdom-dark border-gamdom-border text-gamdom-text hover:text-white'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-gamdom-green animate-pulse" />
          <span suppressHydrationWarning>Live {formatTime(currentRound.startAt)}</span>
        </button>
      )}

      {/* Presale chips */}
      {presaleRounds.map((r, idx) => {
        const isSelected = selectedRoundId === r.id
        return (
          <button
            key={r.id}
            onClick={() => onSelectRound(r.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 border ${
              isSelected
                ? 'bg-gamdom-card border-gamdom-gold text-white shadow-sm'
                : 'bg-gamdom-dark border-gamdom-border text-gamdom-text hover:text-white'
            }`}
          >
            <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-gamdom-gold/20 text-gamdom-gold border border-gamdom-gold/30">
              Presale
            </span>
            <span suppressHydrationWarning>{formatTime(r.startAt)}</span>
          </button>
        )
      })}
    </div>
  )
}
