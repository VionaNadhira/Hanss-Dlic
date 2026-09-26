'use client'

import React, { useState, useEffect } from 'react'
import { X, Droplets, Check, Sparkles, Clock, Gift } from 'lucide-react'
import { useBalance } from '@/context/BalanceContext'
import { useNotifications } from '@/context/NotificationContext'

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { balance, addBalance } = useBalance()
  const { addNotification } = useNotifications()
  const [canClaim, setCanClaim] = useState<boolean | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const faucetAmount = 1000

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/faucet', { cache: 'no-store' })
      const data = await res.json()
      setCanClaim(data.canClaim)
      setRemainingMs(data.remainingMs)
    } catch {
      setCanClaim(true)
    }
  }

  useEffect(() => {
    if (isOpen) fetchStatus()
  }, [isOpen])

  useEffect(() => {
    if (canClaim === false && remainingMs > 0) {
      const timer = setInterval(() => {
        setRemainingMs((prev) => {
          if (prev <= 1000) {
            setCanClaim(true)
            return 0
          }
          return prev - 1000
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [canClaim, remainingMs])

  const handleClaim = async () => {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/faucet', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        addBalance(data.amount)
        setSuccessMsg(`Claimed $${data.amount.toFixed(2)}! Added to balance.`)
        setCanClaim(false)
        setRemainingMs(data.nextClaimMs)
        addNotification({
          kind: 'faucet',
          text: `Faucet claimed: $${data.amount.toFixed(2)} added to your balance`,
          amount: data.amount,
        })
      } else {
        setErrorMsg(data.error || 'Claim failed. Try again later.')
        if (data.remainingMs) {
          setRemainingMs(data.remainingMs)
          setCanClaim(false)
        }
      }
    } catch {
      setErrorMsg('Network error. Try again.')
    }
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gamdom-card border border-gamdom-border rounded-2xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gamdom-border bg-gamdom-header">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gamdom-green/20 border border-gamdom-green/30 flex items-center justify-center text-gamdom-green">
              <Droplets size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">Faucet</h2>
              <p className="text-[11px] text-gamdom-text">Balance: <span className="text-gamdom-gold font-bold">${balance.toFixed(2)}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gamdom-dark border border-gamdom-border flex items-center justify-center text-gamdom-text hover:text-white hover:border-gamdom-gold/40 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {successMsg && (
            <div className="flex items-center gap-2 text-xs font-bold text-gamdom-green bg-gamdom-green/10 border border-gamdom-green/30 p-3 rounded-xl">
              <Sparkles size={15} />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs font-bold text-gamdom-red bg-gamdom-red/10 border border-gamdom-red/30 p-3 rounded-xl">
              <Clock size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-gamdom-green/15 border border-gamdom-green/30 flex items-center justify-center mx-auto mb-3">
              <Gift size={28} className="text-gamdom-green" />
            </div>
            <h3 className="text-xl font-black text-white">Daily Faucet</h3>
            <p className="text-sm text-gamdom-text mt-1">Claim <span className="text-gamdom-gold font-black">${faucetAmount.toFixed(2)}</span> every 24 hours</p>
          </div>

          {canClaim === null ? (
            <div className="w-full py-4 text-center text-sm text-gamdom-text">Loading...</div>
          ) : canClaim ? (
            <button
              onClick={handleClaim}
              disabled={loading}
              className="w-full py-4 bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black rounded-xl text-sm uppercase tracking-wider transition-all shadow-gamdom-green flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Droplets size={18} /> {loading ? 'Claiming...' : `Claim $${faucetAmount.toFixed(2)}`}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="w-full py-4 bg-gamdom-dark border border-gamdom-border rounded-xl flex flex-col items-center justify-center gap-1">
                <span className="text-[11px] font-bold text-gamdom-text uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} /> Next claim in
                </span>
                <span className="text-2xl font-black text-gamdom-gold tracking-widest">{formatRemaining(remainingMs)}</span>
              </div>
              <button
                disabled
                className="w-full py-3 bg-gamdom-dark border border-gamdom-border text-gamdom-text font-bold rounded-xl text-xs uppercase tracking-wider opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={14} /> Cooldown Active
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
