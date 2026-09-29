'use client'

import React, { useState, useEffect } from 'react'
import { Trophy, Flame, Droplets, Shield, Award, Users, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export interface UserMetaProfile {
  username: string
  balance: string
  score: number
  rank: number
  streakDays: number
  streakSecondsLeft: number
  tier: {
    currentTier: string
    currentTierColor: string
    currentTierBg: string
    nextTier: string | null
    pointsToNextTier: number
    progressPercent: number
  }
  faucet: {
    canClaim: boolean
    remainingMs: number
    amount: number
  }
}

export interface TopTrader {
  rank: number
  username: string
  score: number
  totalBets: number
  wonBets: number
  winRate: number
  tier: string
  tierColor: string
}

interface MetaSidebarProps {
  userProfile: UserMetaProfile | null
  onClaimFaucet: () => Promise<void>
  onPromptLogin: () => void
}

export default function MetaSidebar({
  userProfile,
  onClaimFaucet,
  onPromptLogin,
}: MetaSidebarProps) {
  const [faucetCooldownMs, setFaucetCooldownMs] = useState<number>(0)
  const [claiming, setClaiming] = useState(false)
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null)

  useEffect(() => {
    if (userProfile?.faucet) {
      setFaucetCooldownMs(userProfile.faucet.remainingMs || 0)
    }
  }, [userProfile])

  // Local tick for faucet cooldown
  useEffect(() => {
    if (faucetCooldownMs <= 0) return
    const timer = setInterval(() => {
      setFaucetCooldownMs((prev) => Math.max(0, prev - 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [faucetCooldownMs])

  const handleClaim = async () => {
    if (!userProfile) {
      onPromptLogin()
      return
    }
    setClaiming(true)
    setFaucetMsg(null)
    try {
      await onClaimFaucet()
      setFaucetMsg('+200 Points Claimed!')
      setTimeout(() => setFaucetMsg(null), 3500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claim failed'
      setFaucetMsg(msg)
    } finally {
      setClaiming(false)
    }
  }

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}m ${String(s).padStart(2, '0')}s`
  }

  const formatSec = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
  }

  return (
    <div className="space-y-4 select-none">
      {/* 1. Score & Tier Card */}
      <div className="p-4 bg-gamdom-surface border border-gamdom-border rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim flex items-center gap-1.5">
            <Trophy size={13} className="text-gamdom-gold" /> Prediction Tier & Score
          </span>
          {userProfile && (
            <span
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded border"
              style={{
                backgroundColor: userProfile.tier.currentTierBg,
                borderColor: userProfile.tier.currentTierColor,
                color: userProfile.tier.currentTierColor,
              }}
            >
              {userProfile.tier.currentTier}
            </span>
          )}
        </div>

        {userProfile ? (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-black text-white font-mono">
                {userProfile.score.toLocaleString()} <span className="text-xs font-bold text-gamdom-textDim">SCORE</span>
              </span>
              <span className="text-xs font-bold text-gamdom-gold">
                Rank #{userProfile.rank}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-gamdom-dark rounded-full overflow-hidden">
                <div
                  className="h-full bg-gamdom-gold rounded-full transition-all duration-500"
                  style={{ width: `${userProfile.tier.progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gamdom-textDim font-bold">
                <span>{userProfile.tier.currentTier}</span>
                {userProfile.tier.nextTier ? (
                  <span>{userProfile.tier.pointsToNextTier} pts to {userProfile.tier.nextTier}</span>
                ) : (
                  <span>Max Tier Reached</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-gamdom-textDim mb-2">Log in to track your prediction rank & tiers</p>
            <button
              onClick={onPromptLogin}
              className="px-3 py-1.5 rounded-lg bg-gamdom-card hover:bg-gamdom-cardHover border border-gamdom-border text-white text-xs font-bold transition"
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* 2. Streak Card */}
      <div className="p-4 bg-gamdom-surface border border-gamdom-border rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim flex items-center gap-1.5">
            <Flame size={13} className="text-orange-500" /> Daily Bet Streak
          </span>
          <span className="text-xs font-extrabold text-orange-400">
            {userProfile?.streakDays || 0} DAYS
          </span>
        </div>
        <p className="text-[11px] text-gamdom-text leading-tight">
          Bet every day to keep your streak multiplier active.
        </p>
        {userProfile && userProfile.streakSecondsLeft > 0 && (
          <div className="text-[10px] text-gamdom-textDim font-mono">
            {formatSec(userProfile.streakSecondsLeft)} left before streak breaks (UTC midnight).
          </div>
        )}
      </div>

      {/* 3. Faucet Card */}
      <div className="p-4 bg-gamdom-surface border border-gamdom-border rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-gamdom-textDim flex items-center gap-1.5">
            <Droplets size={13} className="text-gamdom-green" /> Hourly Faucet
          </span>
          <span className="text-[10px] font-extrabold text-gamdom-green bg-gamdom-green/10 border border-gamdom-green/20 px-1.5 py-0.5 rounded">
            +200 PTS
          </span>
        </div>

        {faucetMsg && (
          <div className="text-xs font-bold text-gamdom-green bg-gamdom-green/10 p-2 rounded border border-gamdom-green/30 text-center">
            {faucetMsg}
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming || faucetCooldownMs > 0}
          className="w-full py-2.5 rounded-lg font-black uppercase text-xs tracking-wider transition border disabled:opacity-40 disabled:cursor-not-allowed bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark border-transparent shadow-gamdom-green"
        >
          {claiming ? (
            'Claiming...'
          ) : faucetCooldownMs > 0 ? (
            `Cooldown (${formatMs(faucetCooldownMs)})`
          ) : (
            'Claim 200 Free Points'
          )}
        </button>
      </div>
    </div>
  )
}
