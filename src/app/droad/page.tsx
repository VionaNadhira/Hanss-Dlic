'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/button'
import AuthGuardModal from '@/components/AuthGuardModal'
import RoadBoard, { knockTravel, type Phase } from '@/components/droad/RoadBoard'
import { PRELOAD_EARLY, PRELOAD_LATE, preloadMascot } from '@/components/droad/mascotManifest'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { LANE_OPTIONS, MAX_BET, MIN_BET, SURVIVE_P, multiplierFor, newRoundSeed, payoutFor, resolveFromSeed, round2, type MascotState, type RunOutcome } from '@/lib/droad/game'
import { DlicomRoadAudioProvider, useDroadAudioOptional } from '@/components/droad/DlicomRoadAudioProvider'
import { Car, Check, Skull, Trophy } from 'lucide-react'
const CARD_BG = '#10151c'
const CARD_BORDER = '#19212a'
const INPUT_BG = '#141a22'
const MUTED = '#9aa7b4'
const ACCENT = '#3bb8f2'
const GOLD = '#fbb01b'
const DANGER = '#ff4d4f'
const INK = '#080d13'
const STEP_MS = 1000 / 12
const CROSS_MS = 2600
interface Round { seed: string; wager: number; lanes: number; result: RunOutcome }
function DroadInner() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()
  const audio = useDroadAudioOptional()
  console.log('[Dlicom Road Page] audio object:', audio)
  const [bet, setBet] = useState(5)
  const [lanes, setLanes] = useState<number>(2)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('waiting')
  const [mascotState, setMascotState] = useState<MascotState>('idle')
  const [round, setRound] = useState<Round | null>(null)
  const [payout, setPayout] = useState(0)
  const [travel, setTravel] = useState(0)
  const paidRef = useRef<string | null>(null)
  const outcome = round?.result ?? null
  const seed = round?.seed ?? ''
  const multiplier = multiplierFor(lanes)
  const isRunning = phase === 'running'
  const locked = phase !== 'waiting'
  const winChance = Math.pow(SURVIVE_P, lanes)
  useEffect(() => { preloadMascot(PRELOAD_EARLY) }, [])
  const backToWaiting = useCallback(() => {
    setPhase('waiting')
    setMascotState('idle')
    setRound(null)
    setPayout(0)
    setTravel(0)
    if (audio) {
      audio.stopBgm(300)
      setTimeout(() => audio.playBgm('menu', { loop: true, volume: 0.22, fadeMs: 500 }), 400)
    }
  }, [audio])
  const handlePlay = useCallback(async () => {
    setError('')
    if (locked) return
    console.log('[Dlicom Road] handlePlay called')
    await audio?.unlock()
    audio?.playSfx('button-click')
    if (!Number.isFinite(bet) || bet < MIN_BET) {
      setError(`Minimum bet is $${MIN_BET.toFixed(2)}`)
      audio?.playSfx('error')
      return
    }
    if (bet > MAX_BET) {
      setError(`Maximum bet is $${MAX_BET.toFixed(2)}`)
      audio?.playSfx('error')
      return
    }
    if (bet > balance) {
      setError('Insufficient balance')
      audio?.playSfx('error')
      return
    }
    if (!deductBalance(bet)) {
      setError('Failed to place bet')
      audio?.playSfx('error')
      return
    }
    preloadMascot(PRELOAD_LATE)
    const wager = bet
    const roundSeed = newRoundSeed()
    const result = resolveFromSeed(roundSeed, lanes)
    setRound({ seed: roundSeed, wager, lanes, result })
    setPayout(0)
    setTravel(0)
    setPhase('running')
    setMascotState('step')
    if (audio) {
      const base = `${roundSeed}`
      if (!audio.audio.hasPlayed(`${base}:bet`)) {
        audio.audio.markPlayed(`${base}:bet`)
        queueMicrotask(() => {
          audio.playSfx('bet')
          setTimeout(() => audio.playSfx('start'), 180)
          setTimeout(() => {
            audio.playBgm('gameplay', { loop: true, volume: 0.35, fadeMs: 400 })
            audio.updateIntensity(multiplierFor(lanes))
          }, 320)
        })
      }
    }
  }, [locked, bet, balance, deductBalance, lanes, audio])
  useEffect(() => {
    if (phase !== 'running' || !outcome || !round) return
    const won = outcome.won
    const total = STEP_MS + CROSS_MS
    let raf = 0
    let start = 0
    const timers: number[] = []
    let lastCompletedStep = 0
    const nLanes = round.lanes
    const hit = outcome.hitLane
    const safeLanes = won ? nLanes : Math.max(0, (hit ?? 1) - 1)
    const stepCount = Math.max(1, safeLanes || 1)
    for (let i = 0; i < safeLanes; i++) {
      const delay = STEP_MS + (CROSS_MS / stepCount) * (i + 0.5)
      const t = window.setTimeout(() => {
        if (!audio) return
        const key = `${round.seed}:step:${i}`
        if (audio.audio.hasPlayed(key)) return
        audio.audio.markPlayed(key)
        const variants: Array<'step' | 'step-01' | 'step-02' | 'step-03'> = ['step', 'step-01', 'step-02', 'step-03']
        const v = variants[i % variants.length]
        audio.playSfx(v as never)
      }, delay)
      timers.push(t)
    }
    if (!won && multiplierFor(nLanes) >= 1.5) {
      const mt = window.setTimeout(() => {
        const key = `${round.seed}:mult`
        if (audio && !audio.audio.hasPlayed(key)) {
          audio.audio.markPlayed(key)
          audio.playSfx('multiplier-up')
        }
      }, STEP_MS + CROSS_MS * 0.52)
      timers.push(mt)
    }
    // Vehicle pass is purely cosmetic — never decides win/loss; server outcome is authoritative
    let elapsedForVehicle = 0
    const vInt = window.setInterval(() => {
      if (phase !== 'running') return
      elapsedForVehicle += 650
      // Only emit while mascot still alive on screen (before the final hit moment)
      const hitAt = won ? total + 1 : (STEP_MS + (CROSS_MS * (safeLanes + 0.35)) / Math.max(1, nLanes))
      if (elapsedForVehicle > hitAt - 900) return
      if (Math.random() < 0.35 && audio) audio.playSfx('vehicle-pass')
    }, 650)
    const tick = (now: number) => {
      if (!start) start = now
      const t = now - start
      // End is the lane centre where the crash happens — matches RoadBoard.knockTravel
      const end = won ? 1 : knockTravel(outcome.hitLane!)
      if (t >= total) {
        setTravel(end)
        // CRITICAL: only switch to hit if the server outcome is a loss AND mascot reached the hit lane
        // This guarantees visual collision lines up with the knocked position, not before
        setMascotState(won ? 'win' : 'hit')
        setPhase(won ? 'crossed' : 'knocked')
        window.clearInterval(vInt)
        return
      }
      // While running, always show step->run, never hit prematurely
      setMascotState(t < STEP_MS ? 'step' : 'run')
      const currentTravel = end * (t / total)
      setTravel(currentTravel)
      
      // Check for step SFX triggers during running phase (after initial step)
      if (t >= STEP_MS && !won) {
        // Calculate how many steps we've completed based on travel
        // Each lane represents 1/nLanes of travel
        const laneTravel = currentTravel * nLanes // Travel in terms of lanes
        const completedSteps = Math.floor(laneTravel)
        
        // Play SFX for each newly completed step
        for (let i = lastCompletedStep; i < completedSteps && i < safeLanes; i++) {
          if (!audio) return
          const key = `${round.seed}:step:${i}`
          if (audio.audio.hasPlayed(key)) return
          audio.audio.markPlayed(key)
          const variants: Array<'step' | 'step-01' | 'step-02' | 'step-03'> = ['step', 'step-01', 'step-02', 'step-03']
          const v = variants[i % variants.length]
          audio.playSfx(v as never)
        }
        lastCompletedStep = completedSteps
      }
      
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      window.clearInterval(vInt)
    }
  }, [phase, outcome, round, audio])
  useEffect(() => {
    if (!round || !audio) return
    if (phase === 'knocked') {
      const key = `${round.seed}:crash`
      if (audio.audio.hasPlayed(key)) return
      audio.audio.markPlayed(key)
      audio.stopBgm(80)
      audio.playSfx('crash')
      setTimeout(() => audio.playSfx('vehicle-pass', { volume: 0.9 }), 60)
      setTimeout(() => audio.playBgm('crash', { loop: false, volume: 0.45, fadeMs: 120 }), 160)
      setTimeout(() => audio.stopBgm(400), 2200)
    }
  }, [phase, round, audio])
  useEffect(() => {
    if (phase !== 'crossed' || !round) return
    if (paidRef.current === round.seed) return
    paidRef.current = round.seed
    const won = payoutFor(round.wager, round.lanes, true)
    addBalance(won)
    setPayout(won)
    if (audio) {
      const key = `${round.seed}:win`
      if (!audio.audio.hasPlayed(key)) {
        audio.audio.markPlayed(key)
        audio.duckBgm(0.35, 1400)
        setTimeout(() => audio.playSfx('cashout'), 80)
        setTimeout(() => audio.playSfx('win'), 380)
        const m = multiplierFor(round.lanes)
        if (m >= 5) setTimeout(() => audio.playSfx('multiplier-up'), 900)
      }
    }
  }, [phase, round, addBalance, audio])
  const net = round ? payout - round.wager : 0
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6" style={{ fontFamily: "'Gamdom', sans-serif", backgroundColor: INK }}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-[8px] overflow-hidden p-0.5 shrink-0" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <img src="/games/dlicomroad.png" alt="Dlicom Road" className="w-full h-full object-cover rounded-[8px]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold uppercase" style={{ color: '#fff', lineHeight: '29px' }}>Dlicom Road</h1>
          <p className="text-sm" style={{ color: MUTED }}>Send the mascot across {lanes === 1 ? '1 lane' : `${lanes} lanes`} of traffic. Clear every lane or get knocked down.</p>

        </div>
      </div>
      <div className="rounded-[20px_20px_0px_0px] overflow-hidden flex flex-col lg:flex-row" style={{ backgroundColor: INK, border: `1px solid ${CARD_BORDER}` }}>
        <div className="w-full lg:w-80 p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_132px] items-start gap-x-3 gap-y-4 lg:flex lg:flex-col lg:items-stretch lg:gap-0 justify-between shrink-0 order-2 lg:order-1" style={{ backgroundColor: CARD_BG }}>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold uppercase" style={{ fontSize: 12, color: MUTED }}>Bet Amount</label>
                <span style={{ fontSize: 12, color: MUTED }}>Balance: <span className="font-bold" style={{ color: GOLD }}>${balance.toFixed(2)}</span></span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: GOLD }}>$</span>
                <input type="number" step="0.5" min={MIN_BET} max={MAX_BET} disabled={locked} value={bet} onChange={(e) => setBet(Math.max(0, Number(e.target.value) || 0))} className="w-full py-2.5 pl-8 pr-3 font-semibold text-sm transition disabled:opacity-50" style={{ backgroundColor: INPUT_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 4, color: '#fff', fontSize: 16, fontWeight: 600 }} />
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[
                  ['½', () => setBet((p) => round2(Math.max(MIN_BET, p / 2)))],
                  ['2×', () => setBet((p) => round2(Math.min(MAX_BET, p * 2)))],
                  ['MIN', () => setBet(MIN_BET)],
                  ['MAX', () => setBet(round2(Math.max(MIN_BET, Math.min(MAX_BET, balance))))],
                ].map(([label, action]) => (
                  <button key={label as string} disabled={locked} onMouseEnter={() => audio?.playSfx('button-hover')} onClick={action as () => void} className="text-xs font-bold py-1.5 transition disabled:opacity-40 hover:bg-[#3bb8f2]/20" style={{ backgroundColor: 'rgba(59,184,242,0.1)', border: `1px solid ${ACCENT}`, borderRadius: 4, color: ACCENT }}>{label as string}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold uppercase" style={{ fontSize: 12, color: MUTED }}>Lanes</label>
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: GOLD }}><Car size={12} /> {winChance.toFixed(1)}% clear</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {LANE_OPTIONS.map((n) => (
                  <button key={n} disabled={locked} onMouseEnter={() => audio?.playSfx('button-hover')} onClick={() => setLanes(n)} className="py-2 text-xs font-bold transition disabled:opacity-40" style={{ borderRadius: 4, border: `1px solid ${lanes === n ? ACCENT : CARD_BORDER}`, backgroundColor: lanes === n ? ACCENT : 'transparent', color: lanes === n ? INK : MUTED }}>{n}</button>
                ))}
              </div>
            </div>
            <div className="p-3.5 space-y-2 text-xs" style={{ backgroundColor: INPUT_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 4 }}>
              <div className="flex justify-between items-center" style={{ color: MUTED }}><span>Payout</span><span className="font-bold text-sm" style={{ color: ACCENT }}>${round2(bet * multiplier).toFixed(2)} ({multiplier.toFixed(2)}x)</span></div>
              <div className="flex justify-between items-center" style={{ color: MUTED }}><span>Chance to clear</span><span className="font-bold" style={{ color: GOLD }}>{(winChance * 100).toFixed(1)}%</span></div>
              <div className="flex justify-between items-center" style={{ color: MUTED }}><span>Max profit</span><span className="font-bold" style={{ color: '#fff' }}>${round2(bet * (multiplier - 1)).toFixed(2)}</span></div>
            </div>
            {error && <div className="text-xs font-bold p-2.5 rounded-[4px] text-center" style={{ color: DANGER, backgroundColor: 'rgba(255,77,79,0.12)', border: `1px solid ${DANGER}` }}>{error}</div>}
          </div>
          <div className="w-full col-start-2 row-start-1 self-end flex lg:col-start-auto lg:row-start-auto lg:self-auto lg:block">
            {locked ? (
              <Button onClick={() => { audio?.playSfx('button-click'); backToWaiting() }} onMouseEnter={() => audio?.playSfx('button-hover')} disabled={phase === 'running'} className="w-full h-12 lg:h-10 font-bold text-sm uppercase border-0 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" style={{ borderRadius: 8, backgroundColor: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}` }}>{phase === 'running' ? 'CROSSING...' : 'NEW ROUND'}</Button>
            ) : (
              <Button onClick={handlePlay} onMouseEnter={() => audio?.playSfx('button-hover')} className="w-full h-12 lg:h-10 font-bold text-sm uppercase border-0 transition-all hover:brightness-110 active:scale-[0.98]" style={{ borderRadius: 8, backgroundColor: ACCENT, color: INK, fontWeight: 700, boxShadow: '0 0 20px -3px rgba(59,184,242,0.45)', border: `1px solid ${ACCENT}` }}>CROSS THE ROAD</Button>
            )}
          </div>
          </div>
        <div className="relative order-1 w-full min-h-[482px] flex-1 lg:order-2 lg:w-auto lg:min-w-0" style={{ backgroundColor: INK }}>
          <RoadBoard mascotState={mascotState} phase={phase} travel={travel} hitLane={outcome && !outcome.won ? outcome.hitLane : null} lanes={lanes}>
            {phase === 'waiting' && <p className="text-[11px] leading-snug sm:text-xs" style={{ color: MUTED, textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 10px rgba(8,13,19,0.95)' }}>Pick your bet and lanes, then send the mascot across.</p>}
            {phase === 'running' && <p className="text-[11px] font-bold uppercase sm:text-xs" style={{ color: GOLD, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>Crossing {lanes} lanes...</p>}
            {phase === 'crossed' && <div className="max-w-full flex-wrap justify-center px-3 py-1.5 font-bold text-[11px] uppercase flex items-center gap-2 sm:px-5 sm:py-2 sm:text-xs" style={{ backgroundColor: 'rgba(56,185,242,0.15)', border: `1px solid ${ACCENT}`, borderRadius: 4, color: ACCENT }}><Trophy size={16} /> Cleared all {lanes} lanes {payout > 0 && <> &middot; +${net.toFixed(2)}</>}</div>}
            {phase === 'knocked' && <div className="max-w-full flex-wrap justify-center px-3 py-1.5 font-bold text-[11px] uppercase flex items-center gap-2 sm:px-5 sm:py-2 sm:text-xs" style={{ backgroundColor: 'rgba(255,77,79,0.15)', border: `1px solid ${DANGER}`, borderRadius: 4, color: DANGER }}><Skull size={16} /> Knocked down on lane {outcome?.hitLane}</div>}
            {phase !== 'waiting' && seed && <p style={{ fontSize: 11, color: 'rgba(154,167,180,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>round {seed}</p>}
            {phase === 'crossed' && <p className="text-[11px] flex items-center gap-1 sm:text-xs" style={{ color: MUTED, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}><Check size={12} style={{ color: ACCENT }} /> Payout ${payout.toFixed(2)}</p>}
          </RoadBoard>
        </div>
      </div>
      <AuthGuardModal isOpen={!loading && !user} />
    </div>
  )
}
export default function DlicomRoadPage() {
  return <DlicomRoadAudioProvider><DroadInner /></DlicomRoadAudioProvider>
}
