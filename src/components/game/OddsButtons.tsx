'use client'

import React from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface OddsButtonsProps {
  chanceUp: number // 0 to 1
  multiplierUp: number
  multiplierDown: number
  selectedSide: 'up' | 'down'
  onSelectSide: (side: 'up' | 'down') => void
  disabled?: boolean
}

export default function OddsButtons({
  chanceUp,
  multiplierUp,
  multiplierDown,
  selectedSide,
  onSelectSide,
  disabled = false,
}: OddsButtonsProps) {
  const upPercent = Math.round(chanceUp * 100)
  const downPercent = 100 - upPercent

  return (
    <div className="space-y-2 select-none">
      {/* Chance Header */}
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
        <span className="text-gamdom-green flex items-center gap-1">
          <ArrowUp size={14} /> UP {upPercent}%
        </span>
        <span className="text-gamdom-red flex items-center gap-1">
          DOWN {downPercent}% <ArrowDown size={14} />
        </span>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* UP Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectSide('up')}
          className={`relative min-h-[48px] px-4 py-3 rounded-xl font-black uppercase text-sm sm:text-base flex items-center justify-between transition-all duration-200 border ${
            selectedSide === 'up'
              ? 'bg-gamdom-green/20 border-gamdom-green text-white shadow-gamdom-green scale-[1.01]'
              : 'bg-gamdom-card border-gamdom-border text-gamdom-text hover:text-white hover:border-gamdom-green/40'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                selectedSide === 'up'
                  ? 'bg-gamdom-green text-gamdom-dark'
                  : 'bg-gamdom-dark text-gamdom-green'
              }`}
            >
              <ArrowUp size={16} strokeWidth={3} />
            </div>
            <span>UP</span>
          </div>
          <span className="text-sm font-extrabold text-gamdom-green font-mono">
            {multiplierUp.toFixed(2)}x
          </span>
        </button>

        {/* DOWN Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectSide('down')}
          className={`relative min-h-[48px] px-4 py-3 rounded-xl font-black uppercase text-sm sm:text-base flex items-center justify-between transition-all duration-200 border ${
            selectedSide === 'down'
              ? 'bg-gamdom-red/20 border-gamdom-red text-white shadow-[0_0_20px_-3px_rgba(255,77,79,0.45)] scale-[1.01]'
              : 'bg-gamdom-card border-gamdom-border text-gamdom-text hover:text-white hover:border-gamdom-red/40'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                selectedSide === 'down'
                  ? 'bg-gamdom-red text-white'
                  : 'bg-gamdom-dark text-gamdom-red'
              }`}
            >
              <ArrowDown size={16} strokeWidth={3} />
            </div>
            <span>DOWN</span>
          </div>
          <span className="text-sm font-extrabold text-gamdom-red font-mono">
            {multiplierDown.toFixed(2)}x
          </span>
        </button>
      </div>

      {/* Split Bar */}
      <div className="h-1.5 w-full bg-gamdom-dark rounded-full overflow-hidden flex">
        <div
          className="h-full bg-gamdom-green transition-all duration-300"
          style={{ width: `${upPercent}%` }}
        />
        <div
          className="h-full bg-gamdom-red transition-all duration-300"
          style={{ width: `${downPercent}%` }}
        />
      </div>
    </div>
  )
}
