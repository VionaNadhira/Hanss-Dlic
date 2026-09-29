'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import MarketHeader from '@/components/game/MarketHeader'
import RoundStats from '@/components/game/RoundStats'
import RoundChips, { type RoundSummary } from '@/components/game/RoundChips'
import OddsButtons from '@/components/game/OddsButtons'
import BetPanel, { type UserBetItem } from '@/components/game/BetPanel'
import PriceChart, { type ChartTick } from '@/components/game/PriceChart'
import RecentRoundsStrip, { type RecentRound } from '@/components/game/RecentRoundsStrip'
import ResultBanner from '@/components/game/ResultBanner'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/context/BalanceContext'
import { Radio } from 'lucide-react'
import { playGameSound } from '@/lib/game/sound'

export default function PlayPage() {
  const { user, loading: authLoading } = useAuth()
  const { balance, deductBalance, refreshBalance } = useBalance()

  const asset = 'btc' // BTC only
  const [selectedSide, setSelectedSide] = useState<'up' | 'down'>('up')
  const [selectedRoundId, setSelectedRoundId] = useState<string>('')

  // Live round state
  const [liveRound, setLiveRound] = useState<any>(null)
  const [presaleRounds, setPresaleRounds] = useState<RoundSummary[]>([])
  const [userBets, setUserBets] = useState<UserBetItem[]>([])

  // Price & chart state
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceTicks, setPriceTicks] = useState<ChartTick[]>([])
  const [priceFeedError, setPriceFeedError] = useState<string | null>(null)
  const [isChartLoading, setIsChartLoading] = useState(true)

  // Server time synchronization
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0)

  // Recent rounds
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([])

  // Modals & Banners
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [resultBanner, setResultBanner] = useState<{
    roundId: string
    result: 'up' | 'down' | 'void'
    targetPrice: number | null
    finalPrice: number | null
    userPayout: number | null
  } | null>(null)

  // Ref tracking previous live round ID to detect round resolution
  const prevLiveRoundIdRef = useRef<string | null>(null)

  // 1. Fetch Price
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/price?asset=${asset}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Price fetch failed')
      const data = await res.json()
      if (typeof data.price === 'number') {
        const p = data.price
        setCurrentPrice(p)
        setPriceFeedError(null)

        const now = Math.floor(Date.now() / 1000)
        setPriceTicks((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].ts === now) {
            const next = [...prev]
            next[next.length - 1] = { ts: now, price: p }
            return next
          }
          return [...prev.slice(-300), { ts: now, price: p }]
        })
      }
    } catch {
      setPriceFeedError('Failed to connect to real-time price feed')
    } finally {
      setIsChartLoading(false)
    }
  }, [asset])

  // 2. Fetch Historical Ticks for the round
  const fetchHistory = useCallback(
    async (fromTs: number) => {
      try {
        const res = await fetch(`/api/price/history?asset=${asset}&from=${fromTs}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.ticks) && data.ticks.length > 0) {
            setPriceTicks((prev) => {
              const map = new Map<number, number>()
              for (const t of data.ticks) map.set(t.ts, t.price)
              for (const t of prev) map.set(t.ts, t.price)
              const merged: ChartTick[] = Array.from(map.entries())
                .map(([ts, price]) => ({ ts, price }))
                .sort((a, b) => a.ts - b.ts)
              return merged.slice(-400)
            })
          }
        }
      } catch {}
    },
    [asset]
  )

  // 3. Fetch Recent Resolved Rounds
  const fetchRecentRounds = useCallback(async () => {
    try {
      const res = await fetch(`/api/rounds/recent?asset=${asset}&limit=20`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.rounds)) {
          setRecentRounds(data.rounds)

          if (prevLiveRoundIdRef.current) {
            const resolved = data.rounds.find((r: RecentRound) => r.id === prevLiveRoundIdRef.current)
            if (resolved && resolved.result) {
              const myBet = userBets.find((b) => b.roundId === resolved.id)
              const userWon = myBet ? myBet.side === resolved.result : null
              setResultBanner({
                roundId: resolved.id,
                result: resolved.result,
                targetPrice: resolved.targetPrice ? Number(resolved.targetPrice) : null,
                finalPrice: resolved.finalPrice ? Number(resolved.finalPrice) : null,
                userPayout: myBet?.payout ? Number(myBet.payout) : null,
              })
            }
          }
        }
      }
    } catch {}
  }, [asset, userBets])

  // 4. Fetch Current Rounds (live + presales + user bets)
  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch(`/api/rounds/current?asset=${asset}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()

      if (data.liveRound) {
        setLiveRound(data.liveRound)
        setSelectedRoundId((prev) => {
          // If no round selected, or previously selected round was the previous live round that has now completed
          if (!prev || (prevLiveRoundIdRef.current && prev === prevLiveRoundIdRef.current && prev !== data.liveRound.id)) {
            return data.liveRound.id
          }
          return prev
        })
      }

      if (Array.isArray(data.presaleRounds)) {
        setPresaleRounds(data.presaleRounds)
      }

      if (Array.isArray(data.userBets)) {
        setUserBets(data.userBets)
      }

      if (typeof data.serverTime === 'number') {
        const clientSec = Math.floor(Date.now() / 1000)
        const serverSec = data.serverTime > 1e11 ? Math.floor(data.serverTime / 1000) : Math.floor(data.serverTime)
        setServerTimeOffset((serverSec - clientSec) * 1000)
      }

      // Check if round changed
      if (
        prevLiveRoundIdRef.current &&
        data.liveRound?.id &&
        prevLiveRoundIdRef.current !== data.liveRound.id
      ) {
        void fetchRecentRounds()
      }
      prevLiveRoundIdRef.current = data.liveRound?.id || null
    } catch {}
  }, [asset, fetchRecentRounds])

  // Initial load on mount or asset change ONLY
  useEffect(() => {
    setPriceTicks([])
    setIsChartLoading(true)
    setSelectedRoundId('')

    void fetchPrice()
    void fetchRounds()
    void fetchRecentRounds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset])

  // Backfill history once per live round
  const lastBackfilledRoundRef = useRef<string | null>(null)
  useEffect(() => {
    if (liveRound?.id && liveRound?.startAt && lastBackfilledRoundRef.current !== liveRound.id) {
      lastBackfilledRoundRef.current = liveRound.id
      void fetchHistory(liveRound.startAt)
    }
  }, [liveRound?.id, liveRound?.startAt, fetchHistory])

  // Smooth polling intervals (1s for price, 3s for rounds)
  useEffect(() => {
    const priceInterval = setInterval(() => {
      void fetchPrice()
    }, 1000)

    const roundsInterval = setInterval(() => {
      void fetchRounds()
      void fetchRecentRounds()
    }, 3000)

    return () => {
      clearInterval(priceInterval)
      clearInterval(roundsInterval)
    }
  }, [fetchPrice, fetchRounds, fetchRecentRounds])

  // Handler for placing bets
  const handlePlaceBet = async (roundId: string, side: 'up' | 'down', amount: number) => {
    const res = await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, side, amount }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to place bet')
    }

    // Optimistic deduct then re-sync from DB
    deductBalance(amount)
    playGameSound('bet')
    void fetchRounds()
    void refreshBalance()
  }

  // Active round computation
  const activeRound =
    selectedRoundId === liveRound?.id
      ? liveRound
      : presaleRounds.find((r) => r.id === selectedRoundId) || liveRound

  const multiplier =
    selectedSide === 'up'
      ? activeRound?.odds?.multiplierUp ?? 1.96
      : activeRound?.odds?.multiplierDown ?? 1.96

  // Betting closed threshold: 10s before endAt (cooldown 10 detik sebelum settle)
  const nowServerSec = Math.floor((Date.now() + serverTimeOffset) / 1000)
  const isBettingClosed = activeRound?.endAt
    ? nowServerSec >= activeRound.endAt - 10
    : false

  const totalPool = (activeRound?.poolUp || 0) + (activeRound?.poolDown || 0)
  const myBetsForSelectedRound = userBets.filter((b) => b.roundId === activeRound?.id)

  return (
    <div className="p-3 sm:p-5 lg:p-7 max-w-7xl mx-auto w-full space-y-5" style={{ backgroundColor: '#080d13' }}>
      {/* Result Pop-up Banner */}
      {resultBanner && (
        <ResultBanner
          roundId={resultBanner.roundId}
          result={resultBanner.result}
          targetPrice={resultBanner.targetPrice}
          finalPrice={resultBanner.finalPrice}
          userPayout={resultBanner.userPayout}
          onDismiss={() => setResultBanner(null)}
        />
      )}

      {/* Main Full-Width Wide Theater Layout */}
      <div className="space-y-4 bg-gamdom-card border border-gamdom-border rounded-2xl p-4 sm:p-6 lg:p-7 shadow-gamdom-card w-full">
        {/* Market Header */}
        <MarketHeader
          startAt={activeRound?.startAt || 0}
          endAt={activeRound?.endAt || 0}
        />

        {/* Round Chips (Live & Presale) */}
        <RoundChips
          currentRound={liveRound}
          presaleRounds={presaleRounds}
          selectedRoundId={selectedRoundId}
          onSelectRound={(id) => setSelectedRoundId(id)}
        />

        {/* Stats Bar */}
        <RoundStats
          targetPrice={activeRound?.targetPrice ?? null}
          currentPrice={currentPrice}
          endAt={activeRound?.endAt || 0}
          serverTimeOffset={serverTimeOffset}
        />

        {/* Custom Canvas Price Chart — Wide & Immersive */}
        <div className="w-full">
          <PriceChart
            ticks={priceTicks}
            targetPrice={activeRound?.targetPrice ?? null}
            currentPrice={currentPrice}
            startAt={activeRound?.startAt || Math.floor(Date.now() / 1000) - 300}
            endAt={activeRound?.endAt || Math.floor(Date.now() / 1000)}
            isLoading={isChartLoading}
            error={priceFeedError}
            onRetry={fetchPrice}
          />
        </div>

        {/* Chance & Multiplier Buttons */}
        <OddsButtons
          chanceUp={activeRound?.odds?.chanceUp ?? 0.5}
          multiplierUp={activeRound?.odds?.multiplierUp ?? 1.96}
          multiplierDown={activeRound?.odds?.multiplierDown ?? 1.96}
          selectedSide={selectedSide}
          onSelectSide={(side) => setSelectedSide(side)}
          disabled={isBettingClosed}
        />

        {/* Bet Panel */}
        <BetPanel
          selectedRoundId={selectedRoundId || activeRound?.id || ''}
          selectedSide={selectedSide}
          onSelectSide={(side) => setSelectedSide(side)}
          multiplier={multiplier}
          userBalance={balance}
          isLoggedIn={!authLoading && !!user}
          isBettingClosed={isBettingClosed}
          myBets={myBetsForSelectedRound}
          onPlaceBet={handlePlaceBet}
          onPromptLogin={() => setIsAuthModalOpen(true)}
        />

        {/* Volume and Status Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gamdom-border text-xs text-gamdom-textDim">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold text-gamdom-green">
              <Radio size={14} className="animate-pulse" /> Live Round
            </span>
            <span>•</span>
            <span>Total Pool: <span className="text-white font-mono font-bold">${Number(totalPool).toLocaleString()}</span></span>
          </div>
          <div className="text-[10px] uppercase font-bold text-gamdom-textDim">
            Aligned UTC 5m Window
          </div>
        </div>

        {/* Recent Rounds Strip */}
        <RecentRoundsStrip rounds={recentRounds} />
      </div>

      {/* Auth Guard Modal */}
      <AuthGuardModal
        isOpen={isAuthModalOpen}
        loading={authLoading}
      />
    </div>
  )
}
