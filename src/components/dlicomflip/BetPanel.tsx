'use client'

import React from 'react'
import Button from '@/components/ui/button'

interface BetPanelProps {
  bet: number
  onBetChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onHalfBet: () => void
  onDoubleBet: () => void
  onMinBet: () => void
  onMaxBet: (max: number) => void
  onSelectColor: (color: 'pink' | 'yellow') => void
  selectedColor: 'pink' | 'yellow' | null
  isFlipping: boolean
  onPlaceBet: () => void
  userBalance: number
  errorMessage: string | null
}

export default function BetPanel({
  bet,
  onBetChange,
  onHalfBet,
  onDoubleBet,
  onMinBet,
  onMaxBet,
  onSelectColor,
  selectedColor,
  isFlipping,
  onPlaceBet,
  userBalance,
  errorMessage,
}: BetPanelProps) {
  return (
    <div className="space-y-4 p-4 sm:p-5 bg-gamdom-surface border border-gamdom-border rounded-xl select-none">
      {/* Bet Amount */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            className="font-bold uppercase"
            style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}
          >
            Bet Amount
          </label>
          <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', color: '#9aa7b4' }}>
            Balance:{' '}
            <span className="font-bold" style={{ color: '#fbb01b' }}>
              ${userBalance.toFixed(2)}
            </span>
          </span>
        </div>

        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: '#fbb01b' }}>
            $
          </span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            disabled={isFlipping}
            value={bet}
            onChange={onBetChange}
            className="w-full py-2.5 pl-8 pr-3 font-semibold text-sm transition disabled:opacity-50"
            style={{
              backgroundColor: '#141a22',
              border: '1px solid #19212a',
              borderRadius: '4px',
              color: '#ffffff',
              fontFamily: "'Gamdom', sans-serif",
              fontSize: '16px',
              fontWeight: 600,
            }}
          />
        </div>

        <div className="grid grid-cols-4 gap-1.5 mt-2">
          <button disabled={isFlipping} onClick={onHalfBet} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>½</button>
          <button disabled={isFlipping} onClick={onDoubleBet} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>2×</button>
          <button disabled={isFlipping} onClick={onMinBet} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MIN</button>
          <button disabled={isFlipping} onClick={() => onMaxBet(userBalance)} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59, 184, 242, 0.1)', border: '1px solid #3bb8f2', borderRadius: '4px', color: '#3bb8f2', fontFamily: "'Gamdom', sans-serif" }}>MAX</button>
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            className="font-bold uppercase"
            style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', fontWeight: 700, color: '#9aa7b4' }}
          >
            Choose Color
          </label>
          <span style={{ fontFamily: "'Gamdom', sans-serif", fontSize: '12px', color: '#9aa7b4' }}>
            Selected: {selectedColor ? (
              <img
                src={selectedColor === 'pink' ? '/dlicomflip/pink.png' : '/dlicomflip/yellow.png'}
                alt={selectedColor}
                className="w-5 h-5"
              />
            ) : (
              'None'
            )}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            disabled={isFlipping}
            onClick={() => onSelectColor('pink')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
              selectedColor === 'pink'
                ? 'bg-gamdom-red/20 border border-gamdom-red text-white shadow-[0_0_10px_-3px_rgba(255,77,79,0.4)]'
                : 'bg-gamdom-dark border border-gamdom-border text-gamdom-text hover:text-white'
            }`}
          >
            <img src="/dlicomflip/pink.png" alt="Pink" className="w-4 h-4" />
          </button>
          <button
            disabled={isFlipping}
            onClick={() => onSelectColor('yellow')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
              selectedColor === 'yellow'
                ? 'bg-gamdom-green/20 border border-gamdom-green text-white shadow-[0_0_10px_-3px_rgba(59,184,242,0.4)]'
                : 'bg-gamdom-dark border border-gamdom-border text-gamdom-text hover:text-white'
            }`}
          >
            <img src="/dlicomflip/yellow.png" alt="Yellow" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div
          className="text-xs font-bold p-2.5 rounded-[4px] text-center"
          style={{ color: '#ff4d4f', backgroundColor: 'rgba(255,77,79,0.12)', border: '1px solid #ff4d4f', fontFamily: "'Gamdom', sans-serif" }}
        >
          {errorMessage}
        </div>
      )}

      {/* Place Bet Button */}
      <Button
        onClick={onPlaceBet}
        disabled={isFlipping || !selectedColor || bet <= 0}
        className="w-full h-12 lg:h-10 font-bold text-sm uppercase border-0 transition-all hover:brightness-110 active:scale-[0.98]"
        style={{
          borderRadius: '8px',
          backgroundColor: '#3bb8f2',
          color: '#080d13',
          fontFamily: "'Gamdom', sans-serif",
          fontWeight: 700,
          boxShadow: '0 0 20px -3px rgba(59, 184, 242, 0.45)',
          border: '1px solid #3bb8f2',
        }}
      >
        {isFlipping ? 'FLIPPING...' : 'FLIP COIN'}
      </Button>
    </div>
  )
}
