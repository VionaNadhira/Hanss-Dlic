'use client'

import React, { useState } from 'react'
import { ArrowUp, ArrowDown, History } from 'lucide-react'

export interface RecentRound {
  id: string
  targetPrice: number | null
  finalPrice: number | null
  result: 'up' | 'down' | null
  status: string
}

interface RecentRoundsStripProps {
  rounds: RecentRound[]
}

export default function RecentRoundsStrip({ rounds }: RecentRoundsStripProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  if (rounds.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 select-none" style={{ scrollbarWidth: 'none' }}>
      <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim flex items-center gap-1 shrink-0 mr-1">
        <History size={12} /> Recent:
      </span>

      {rounds.map((r) => {
        const isUp = r.result === 'up'
        const isVoid = r.status === 'void'
        const key = r.id

        return (
          <div
            key={key}
            className="relative shrink-0"
            onMouseEnter={() => setActiveTooltip(key)}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold transition-all border ${
                isVoid
                  ? 'bg-gamdom-card border-gamdom-border text-gamdom-textDim'
                  : isUp
                  ? 'bg-gamdom-green/15 border-gamdom-green/40 text-gamdom-green hover:scale-105'
                  : 'bg-gamdom-red/15 border-gamdom-red/40 text-gamdom-red hover:scale-105'
              }`}
            >
              {isVoid ? (
                <span className="text-[9px]">VOID</span>
              ) : isUp ? (
                <ArrowUp size={14} strokeWidth={2.5} />
              ) : (
                <ArrowDown size={14} strokeWidth={2.5} />
              )}
            </div>

            {/* Tooltip */}
            {activeTooltip === key && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 bg-gamdom-card border border-gamdom-border rounded-lg p-2 shadow-xl text-[10px] whitespace-nowrap pointer-events-none">
                <div className="font-extrabold text-white uppercase mb-0.5">
                  Result: <span className={isUp ? 'text-gamdom-green' : 'text-gamdom-red'}>{r.result?.toUpperCase() || r.status}</span>
                </div>
                <div className="text-gamdom-text">
                  Target: <span className="text-white">${r.targetPrice?.toFixed(2) ?? '---'}</span>
                </div>
                <div className="text-gamdom-text">
                  Final: <span className="text-white">${r.finalPrice?.toFixed(2) ?? '---'}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
