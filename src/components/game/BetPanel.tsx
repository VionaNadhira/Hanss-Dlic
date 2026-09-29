'use client'

import React, { useState } from 'react'
import { ArrowUp, ArrowDown, AlertCircle } from 'lucide-react'

export interface UserBetItem {
  id: string
  roundId: string
  side: 'up' | 'down'
  amount: string
  payout: string | null
  status: string
}

interface BetPanelProps {
  selectedRoundId: string
  selectedSide: 'up' | 'down'
  onSelectSide: (side: 'up' | 'down') => void
  multiplier: number
  userBalance: number
  isLoggedIn: boolean
  isBettingClosed: boolean
  myBets: UserBetItem[]
  onPlaceBet: (roundId: string, side: 'up' | 'down', amount: number) => Promise<void>
  onPromptLogin: () => void
}

export default function BetPanel({
  selectedRoundId,
  selectedSide,
  onSelectSide,
  multiplier,
  userBalance,
  isLoggedIn,
  isBettingClosed,
  myBets,
  onPlaceBet,
  onPromptLogin,
}: BetPanelProps) {
  const [amountStr, setAmountStr] = useState<string>('1.00')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const amount = Math.max(0, parseFloat(amountStr) || 0)
  const estimatedPayout = +(amount * multiplier).toFixed(2)

  // Quick chip amounts in dollars (matching other casino games)
  const quickChips = [1, 5, 10, 25, 50, 100]

  const handleSetMax = () => {
    const maxAffordable = Math.min(10000, Math.floor(userBalance * 100) / 100)
    setAmountStr(Math.max(0.1, maxAffordable).toFixed(2))
  }

  const handleHalf = () => {
    setAmountStr((prev) => Math.max(0.1, parseFloat(prev) / 2).toFixed(2))
  }

  const handleDouble = () => {
    setAmountStr((prev) => Math.min(10000, parseFloat(prev) * 2).toFixed(2))
  }

  const handleSubmit = async () => {
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!isLoggedIn) {
      onPromptLogin()
      return
    }

    if (isBettingClosed) {
      setErrorMsg('Betting is closed for this round.')
      return
    }

    if (amount < 0.1) {
      setErrorMsg('Minimum bet is $0.10.')
      return
    }

    if (amount > 10000) {
      setErrorMsg('Maximum bet is $10,000.')
      return
    }

    if (amount > userBalance) {
      setErrorMsg(`Insufficient balance. You have $${userBalance.toFixed(2)}.`)
      return
    }

    setLoading(true)
    try {
      await onPlaceBet(selectedRoundId, selectedSide, amount)
      setSuccessMsg(`Bet of $${amount.toFixed(2)} placed on ${selectedSide.toUpperCase()}!`)
      setTimeout(() => setSuccessMsg(null), 3500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to place bet'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-5 bg-gamdom-surface border border-gamdom-border rounded-xl select-none">
      {/* Side Toggle */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-wider text-gamdom-textDim mb-1.5">
          Select Prediction
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSelectSide('up')}
            className={`py-2 px-3 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1.5 border transition-all ${
              selectedSide === 'up'
                ? 'bg-gamdom-green/20 border-gamdom-green text-white shadow-gamdom-green'
                : 'bg-gamdom-dark border-gamdom-border text-gamdom-text hover:text-white'
            }`}
          >
            <ArrowUp size={14} className="text-gamdom-green" /> UP (Bullish)
          </button>
          <button
            type="button"
            onClick={() => onSelectSide('down')}
            className={`py-2 px-3 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1.5 border transition-all ${
              selectedSide === 'down'
                ? 'bg-gamdom-red/20 border-gamdom-red text-white shadow-[0_0_15px_-3px_rgba(255,77,79,0.45)]'
                : 'bg-gamdom-dark border-gamdom-border text-gamdom-text hover:text-white'
            }`}
          >
            <ArrowDown size={14} className="text-gamdom-red" /> DOWN (Bearish)
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim">
            Bet Amount
          </label>
          <span className="text-[11px] font-bold text-gamdom-text">
            Balance: <span className="text-gamdom-gold font-mono">${userBalance.toFixed(2)}</span>
          </span>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-gamdom-gold">$</span>
          <input
            type="number"
            min={0.1}
            max={10000}
            step={0.5}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            onBlur={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) setAmountStr(v.toFixed(2))
            }}
            disabled={loading || isBettingClosed}
            className="w-full py-2.5 pl-8 pr-3 bg-gamdom-dark border border-gamdom-border rounded-lg text-white font-extrabold text-sm font-mono focus:border-gamdom-green/60 focus:outline-none transition disabled:opacity-50"
            placeholder="1.00"
          />
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-6 gap-1.5 mt-2">
          <button
            type="button"
            disabled={loading || isBettingClosed}
            onClick={handleHalf}
            className="py-1 text-xs font-black rounded bg-gamdom-card hover:bg-[#3bb8f2]/20 hover:border-[#3bb8f2] border border-gamdom-border text-[#3bb8f2] transition disabled:opacity-40"
          >
            ½
          </button>
          <button
            type="button"
            disabled={loading || isBettingClosed}
            onClick={handleDouble}
            className="py-1 text-xs font-black rounded bg-gamdom-card hover:bg-[#3bb8f2]/20 hover:border-[#3bb8f2] border border-gamdom-border text-[#3bb8f2] transition disabled:opacity-40"
          >
            2×
          </button>
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={loading || isBettingClosed}
              onClick={() => setAmountStr(chip.toFixed(2))}
              className="py-1 text-xs font-black rounded bg-gamdom-card hover:bg-[#3bb8f2]/20 hover:border-[#3bb8f2] border border-gamdom-border text-white hover:text-[#3bb8f2] transition disabled:opacity-40"
            >
              ${chip}
            </button>
          ))}
          <button
            type="button"
            disabled={loading || isBettingClosed}
            onClick={handleSetMax}
            className="py-1 text-xs font-black rounded bg-gamdom-card hover:bg-[#3bb8f2]/20 border border-[#3bb8f2]/40 text-[#3bb8f2] transition disabled:opacity-40"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="p-3 bg-gamdom-dark border border-gamdom-border rounded-lg text-xs space-y-1">
        <div className="flex items-center justify-between text-gamdom-text">
          <span>Estimated Payout:</span>
          <span className="font-extrabold text-white font-mono">
            ${estimatedPayout.toFixed(2)}{' '}
            <span className={selectedSide === 'up' ? 'text-gamdom-green' : 'text-gamdom-red'}>
              ({multiplier.toFixed(2)}x)
            </span>
          </span>
        </div>
        <p className="text-[10px] text-gamdom-textDim leading-tight">
          * Estimated multiplier based on current parimutuel pool. Odds may shift until betting closes 10s before round ends.
        </p>
      </div>

      {/* Error or Success Banner */}
      {errorMsg && (
        <div className="p-2.5 rounded-lg text-xs font-bold text-gamdom-red bg-gamdom-red/10 border border-gamdom-red/30 flex items-center gap-1.5">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded-lg text-xs font-bold text-gamdom-green bg-gamdom-green/10 border border-gamdom-green/30">
          {successMsg}
        </div>
      )}

      {/* Action Button */}
      {!isLoggedIn ? (
        <button
          type="button"
          onClick={onPromptLogin}
          className="w-full py-3 rounded-xl bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black uppercase text-xs sm:text-sm tracking-wider transition shadow-gamdom-green"
        >
          LOG IN TO PREDICT & PLAY
        </button>
      ) : isBettingClosed ? (
        <div className="space-y-1.5">
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl bg-gamdom-dark border border-gamdom-border text-gamdom-textDim font-bold uppercase text-xs tracking-wider cursor-not-allowed"
          >
            ROUND LOCKED (10s FINAL COUNTDOWN)
          </button>
          <p className="text-[11px] text-center text-gamdom-gold font-medium">
            Select a Presale round above to bet on the next round!
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={loading || amount < 0.1}
          onClick={handleSubmit}
          className={`w-full py-3 rounded-xl font-black uppercase text-xs sm:text-sm tracking-wider transition duration-200 flex items-center justify-center gap-2 ${
            selectedSide === 'up'
              ? 'bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark shadow-gamdom-green'
              : 'bg-gamdom-red hover:bg-[#ff6b6d] text-white shadow-[0_0_20px_-3px_rgba(255,77,79,0.45)]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              CONFIRMING BET...
            </span>
          ) : (
            <span>
              PREDICT {selectedSide.toUpperCase()} (${amount.toFixed(2)})
            </span>
          )}
        </button>
      )}

      {/* My Bets This Round */}
      {myBets.length > 0 && (
        <div className="pt-2 border-t border-gamdom-border space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim">
            My Bets In This Round:
          </div>
          <div className="space-y-1">
            {myBets.map((b) => {
              const amountDollars = Number(b.amount).toFixed(2)
              const payoutDollars = b.payout ? Number(b.payout).toFixed(2) : null
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 rounded bg-gamdom-dark border border-gamdom-border text-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {b.side === 'up' ? (
                      <ArrowUp size={13} className="text-gamdom-green" />
                    ) : (
                      <ArrowDown size={13} className="text-gamdom-red" />
                    )}
                    <span className={b.side === 'up' ? 'text-gamdom-green' : 'text-gamdom-red'}>
                      {b.side.toUpperCase()}
                    </span>
                    <span className="text-white font-mono">${amountDollars}</span>
                  </div>
                  <div className="text-[11px] font-extrabold uppercase">
                    {b.status === 'won' ? (
                      <span className="text-gamdom-green">Won (+${payoutDollars})</span>
                    ) : b.status === 'lost' ? (
                      <span className="text-gamdom-red">Lost</span>
                    ) : b.status === 'refunded' ? (
                      <span className="text-gamdom-gold">Refunded</span>
                    ) : (
                      <span className="text-gamdom-gold">Open</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
