'use client'

import React, { useState } from 'react'
import Button from '@/components/ui/button'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { Spade, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react'

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

interface Card {
  suit: Suit
  rank: Rank
  value: number
  isAce: boolean
}

function createDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♦', '♣']
  const ranks: { rank: Rank; val: number }[] = [
    { rank: '2', val: 2 },
    { rank: '3', val: 3 },
    { rank: '4', val: 4 },
    { rank: '5', val: 5 },
    { rank: '6', val: 6 },
    { rank: '7', val: 7 },
    { rank: '8', val: 8 },
    { rank: '9', val: 9 },
    { rank: '10', val: 10 },
    { rank: 'J', val: 10 },
    { rank: 'Q', val: 10 },
    { rank: 'K', val: 10 },
    { rank: 'A', val: 11 },
  ]

  const deck: Card[] = []
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({
        suit: s,
        rank: r.rank,
        value: r.val,
        isAce: r.rank === 'A',
      })
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

function calculateHandScore(cards: Card[]): { score: number; isSoft: boolean } {
  let score = 0
  let aceCount = 0

  for (const card of cards) {
    score += card.value
    if (card.isAce) aceCount++
  }

  while (score > 21 && aceCount > 0) {
    score -= 10
    aceCount--
  }

  return { score, isSoft: aceCount > 0 }
}

function playBlackjackSound(type: 'card' | 'chip' | 'win' | 'lose' | 'hit' | 'stand') {
  if (typeof window === 'undefined') return
  try {
    if (type === 'win') {
      const a = new Audio('/bj/win.mp3')
      a.volume = 0.6
      a.play().catch(() => {})
      return
    }
    if (type === 'lose') {
      const a = new Audio('/bj/lost.mp3')
      a.volume = 0.6
      a.play().catch(() => {})
      return
    }
    if (type === 'hit') {
      const a = new Audio('/bj/hit.mp3')
      a.volume = 0.6
      a.play().catch(() => {})
      return
    }
    if (type === 'stand') {
      const a = new Audio('/bj/stand.mp3')
      a.volume = 0.6
      a.play().catch(() => {})
      return
    }
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    if (type === 'card') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.08)
    } else if (type === 'chip') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(900, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.05)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.05)
    }
  } catch {
    // ignore
  }
}

export default function BlackjackPage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()

  const bgmRef = React.useRef<HTMLAudioElement | null>(null)
  React.useEffect(() => {
    const a = new Audio('/bj/bgm.mp3')
    a.loop = true
    a.volume = 0.35
    bgmRef.current = a
    a.play().catch(() => {})
    return () => { a.pause(); a.src = '' }
  }, [])

  const [bet, setBet] = useState(10.00)
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [dealerHoleCardHidden, setDealerHoleCardHidden] = useState(true)
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'dealer_turn' | 'resolved'>('betting')
  const [outcomeMessage, setOutcomeMessage] = useState('')
  const [outcomeType, setOutcomeType] = useState<'win' | 'lose' | 'push' | ''>('')
  const [errorMessage, setErrorMessage] = useState('')

  const chips = [1, 5, 25, 50, 100]

  const playerScore = calculateHandScore(playerHand).score
  const visibleDealerHand = dealerHoleCardHidden ? dealerHand.slice(0, 1) : dealerHand
  const dealerScore = calculateHandScore(visibleDealerHand).score

  const handleDeal = () => {
    setErrorMessage('')
    if (bet <= 0) {
      setErrorMessage('Bet must be greater than $0')
      return
    }
    if (bet > balance) {
      setErrorMessage('Insufficient balance')
      return
    }

    const deducted = deductBalance(bet)
    if (!deducted) {
      setErrorMessage('Failed to deduct balance')
      return
    }

    playBlackjackSound('chip')

    const newDeck = createDeck()
    const p1 = newDeck.pop()!
    const d1 = newDeck.pop()!
    const p2 = newDeck.pop()!
    const d2 = newDeck.pop()!

    const initialPlayerCards = [p1, p2]
    const initialDealerCards = [d1, d2]

    setDeck(newDeck)
    setPlayerHand(initialPlayerCards)
    setDealerHand(initialDealerCards)
    setDealerHoleCardHidden(true)
    setOutcomeMessage('')
    setOutcomeType('')

    const pScore = calculateHandScore(initialPlayerCards).score
    const dScore = calculateHandScore(initialDealerCards).score

    if (pScore === 21) {
      setDealerHoleCardHidden(false)
      if (dScore === 21) {
        addBalance(bet)
        setOutcomeMessage('Push! Both have Blackjack')
        setOutcomeType('push')
      } else {
        const payout = +(bet * 2.5).toFixed(2)
        addBalance(payout)
        playBlackjackSound('win')
        setOutcomeMessage(`Blackjack! You win $${payout.toFixed(2)}`)
        setOutcomeType('win')
      }
      setGameState('resolved')
      return
    }

    setGameState('playing')
    playBlackjackSound('card')
  }

  const handleHit = () => {
    if (gameState !== 'playing') return
    playBlackjackSound('hit')
    playBlackjackSound('card')

    const currentDeck = [...deck]
    const card = currentDeck.pop()!
    const newHand = [...playerHand, card]

    setDeck(currentDeck)
    setPlayerHand(newHand)

    const score = calculateHandScore(newHand).score
    if (score > 21) {
      setDealerHoleCardHidden(false)
      playBlackjackSound('lose')
      setOutcomeMessage('Bust! You went over 21.')
      setOutcomeType('lose')
      setGameState('resolved')
    }
  }

  const handleDoubleDown = () => {
    if (gameState !== 'playing' || playerHand.length !== 2) return
    if (balance < bet) {
      setErrorMessage('Not enough balance to double down')
      return
    }

    deductBalance(bet)
    const newBet = bet * 2
    setBet(newBet)

    playBlackjackSound('chip')
    playBlackjackSound('card')

    const currentDeck = [...deck]
    const card = currentDeck.pop()!
    const newHand = [...playerHand, card]

    setDeck(currentDeck)
    setPlayerHand(newHand)

    const score = calculateHandScore(newHand).score
    if (score > 21) {
      setDealerHoleCardHidden(false)
      playBlackjackSound('lose')
      setOutcomeMessage('Bust on Double Down!')
      setOutcomeType('lose')
      setGameState('resolved')
    } else {
      runDealerTurn(newHand, newBet, currentDeck)
    }
  }

  const handleStand = () => {
    if (gameState !== 'playing') return
    playBlackjackSound('stand')
    runDealerTurn(playerHand, bet, deck)
  }

  const runDealerTurn = (currentPlayerHand: Card[], currentBetAmount: number, currentDeck: Card[]) => {
    setGameState('dealer_turn')
    setDealerHoleCardHidden(false)

    let dHand = [...dealerHand]
    const dDeck = [...currentDeck]

    let dScore = calculateHandScore(dHand).score
    const pScore = calculateHandScore(currentPlayerHand).score

    while (dScore < 17) {
      const c = dDeck.pop()!
      dHand.push(c)
      dScore = calculateHandScore(dHand).score
    }

    setDealerHand(dHand)
    setDeck(dDeck)

    if (dScore > 21) {
      const winPayout = +(currentBetAmount * 2).toFixed(2)
      addBalance(winPayout)
      playBlackjackSound('win')
      setOutcomeMessage(`Dealer busts (${dScore})! You win $${winPayout.toFixed(2)}`)
      setOutcomeType('win')
    } else if (pScore > dScore) {
      const winPayout = +(currentBetAmount * 2).toFixed(2)
      addBalance(winPayout)
      playBlackjackSound('win')
      setOutcomeMessage(`You win! ${pScore} beats ${dScore}`)
      setOutcomeType('win')
    } else if (pScore < dScore) {
      playBlackjackSound('lose')
      setOutcomeMessage(`Dealer wins with ${dScore} vs ${pScore}`)
      setOutcomeType('lose')
    } else {
      addBalance(currentBetAmount)
      setOutcomeMessage(`Push! Both scored ${pScore}`)
      setOutcomeType('push')
    }

    setGameState('resolved')
  }

  const handleNewRound = () => {
    setPlayerHand([])
    setDealerHand([])
    setOutcomeMessage('')
    setOutcomeType('')
    setGameState('betting')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6 bg-[#080D13]" style={{ fontFamily: "'Luckiest Guy', 'Gamdom', serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[8px] bg-[#0F151B] border border-[#19212A] overflow-hidden p-0.5">
            <img src="/games/blackjack.webp" alt="Blackjack" className="w-full h-full object-cover rounded-[6px]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white uppercase" style={{ fontFamily: "'Luckiest Guy', serif", letterSpacing: '0px' }}>Blackjack</h1>
            <p className="text-[14px] font-medium" style={{ color: '#818E9D' }}>Classic 21. Dealer stands on 17. Blackjack pays 3:2.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-[8px]" style={{ color: '#38B9F2', backgroundColor: 'rgba(56, 185, 242,0.08)', border: '1px solid #19212A' }}>
          <ShieldCheck size={14} style={{ color: '#38B9F2' }} />
          <span>Standard Casino Rules</span>
        </div>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap');`}</style>
      {/* Gamdom Theater Container — Gamdom Design System v:alpha #080D13 / #0F151B / #38B9F2 */}
      <div className="bg-[#0F151B] rounded-[10px] overflow-hidden border border-[#19212A] flex flex-col lg:flex-row" style={{ boxShadow: 'none' }}>
        {/* Controls Column */}
        <div className="w-full lg:w-80 p-4 sm:p-6 bg-[#080D13] border-b lg:border-b-0 lg:border-r border-[#19212A] grid grid-cols-[minmax(0,1fr)_140px] items-start gap-x-3 gap-y-4 lg:flex lg:flex-col lg:items-stretch lg:gap-0 justify-between shrink-0 order-2 lg:order-1">
          <div className="space-y-5">
            {/* Bet Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase" style={{ color: '#818E9D', fontFamily: "'Luckiest Guy', serif", letterSpacing: '1.2px' }}>
                  Bet Amount
                </label>
                <span className="text-xs" style={{ color: '#818E9D' }}>Balance: <span className="font-bold" style={{ color: '#38B9F2' }}>${balance.toFixed(2)}</span></span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: '#38B9F2' }}>$</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  disabled={gameState !== 'betting'}
                  value={bet}
                  onChange={(e) => setBet(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-none py-2.5 pl-8 pr-3 font-medium text-sm transition disabled:opacity-50"
                  style={{ backgroundColor: '#0F151B', border: '1px solid #19212A', color: '#FFFFFF' }}
                />
              </div>

              {/* Chip selectors */}
              <div className="grid grid-cols-5 gap-1.5 mt-2">
                {chips.map((c) => (
                  <button
                    key={c}
                    disabled={gameState !== 'betting'}
                    onClick={() => setBet((prev) => +(prev + c).toFixed(2))}
                    className="text-xs font-bold py-1.5 rounded-[8px] transition disabled:opacity-40"
                    style={{ backgroundColor: '#423C3A', color: c === 1 ? '#38B9F2' : '#8E9192', border: '1px solid #5F5C58' }}
                  >
                    +${c}
                  </button>
                ))}
              </div>

              {/* Quick Shortcuts */}
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <button
                  disabled={gameState !== 'betting'}
                  onClick={() => setBet((prev) => +(Math.max(1, prev / 2)).toFixed(2))}
                  className="text-xs font-bold py-1.5 rounded-[8px] transition disabled:opacity-40"
                  style={{ backgroundColor: '#423C3A', color: '#8E9192', border: '1px solid #5F5C58' }}
                >
                  ½
                </button>
                <button
                  disabled={gameState !== 'betting'}
                  onClick={() => setBet((prev) => +(prev * 2).toFixed(2))}
                  className="text-xs font-bold py-1.5 rounded-[8px] transition disabled:opacity-40"
                  style={{ backgroundColor: '#423C3A', color: '#8E9192', border: '1px solid #5F5C58' }}
                >
                  2×
                </button>
                <button
                  disabled={gameState !== 'betting'}
                  onClick={() => setBet(10.00)}
                  className="text-xs font-bold py-1.5 rounded-[8px] transition disabled:opacity-40"
                  style={{ backgroundColor: '#423C3A', color: '#8E9192', border: '1px solid #5F5C58' }}
                >
                  RESET
                </button>
              </div>
            </div>

            {/* Stats Panel */}
            <div className="rounded-[8px] p-3.5 space-y-2 text-xs" style={{ backgroundColor: '#0F151B', border: '1px solid #19212A' }}>
              <div className="flex justify-between items-center" style={{ color: '#818E9D' }}>
                <span className="font-medium">Current Hand Bet</span>
                <span className="font-bold" style={{ color: '#38B9F2' }}>${bet.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center" style={{ color: '#818E9D' }}>
                <span className="font-medium">Player Hand Total</span>
                <span className="font-bold" style={{ color: '#FFFFFF' }}>
                  {playerHand.length > 0 ? playerScore : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center" style={{ color: '#818E9D' }}>
                <span className="font-medium">Dealer Hand Total</span>
                <span className="font-bold" style={{ color: '#FFFFFF' }}>
                  {dealerHand.length > 0 ? dealerScore : '-'}
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="text-xs font-bold p-2.5 rounded-[8px] text-center" style={{ color: '#DB585D', backgroundColor: 'rgba(219,88,93,0.12)', border: '1px solid #DB585D' }}>
                {errorMessage}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div
            className={
              gameState === 'playing'
                ? 'col-span-2 space-y-0 pt-0 lg:space-y-2 lg:pt-6'
                : 'w-full col-start-2 row-start-1 self-stretch flex lg:col-start-auto lg:row-start-auto lg:self-auto lg:block lg:pt-6 lg:space-y-2'
            }
          >
            {gameState === 'betting' && (
              <Button
                onClick={handleDeal}
                className="w-full h-full lg:h-11 rounded-[10px] font-bold text-sm uppercase transition-all active:scale-[0.96]"
                style={{ backgroundColor: '#38B9F2', color: '#000000', boxShadow: 'rgba(56, 185, 242, 0.28) 0px 0px 6.2px 0px', fontFamily: "'Luckiest Guy', serif" }}
              >
                DEAL HAND
              </Button>
            )}

            {gameState === 'playing' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleHit}
                    className="h-11 font-bold rounded-[10px] text-xs uppercase transition-all active:scale-[0.96]"
                    style={{ backgroundColor: '#38B9F2', color: '#000000', boxShadow: 'rgba(56, 185, 242, 0.28) 0px 0px 6.2px 0px', fontFamily: "'Luckiest Guy', serif" }}
                  >
                    HIT
                  </button>
                  <button
                    onClick={handleStand}
                    className="h-11 font-bold rounded-[10px] text-xs uppercase transition-all active:scale-[0.96]"
                    style={{ backgroundColor: '#131A22', color: '#FFFFFF', border: '1px solid #19212A', fontFamily: "'Luckiest Guy', serif" }}
                  >
                    STAND
                  </button>
                </div>
                {playerHand.length === 2 && balance >= bet && (
                  <button
                    onClick={handleDoubleDown}
                    className="w-full h-10 font-bold rounded-[10px] text-xs uppercase transition-all active:scale-[0.96]"
                    style={{ backgroundColor: '#514B47', color: '#FFFFFF', border: '1px solid #5F5C58', fontFamily: "'Luckiest Guy', serif" }}
                  >
                    DOUBLE DOWN (+${bet.toFixed(2)})
                  </button>
                )}
              </div>
            )}

            {gameState === 'resolved' && (
              <Button
                onClick={handleNewRound}
                className="w-full h-full lg:h-11 rounded-[10px] font-bold text-sm uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.96]"
                style={{ backgroundColor: '#38B9F2', color: '#000000', boxShadow: 'rgba(56, 185, 242, 0.28) 0px 0px 6.2px 0px', fontFamily: "'Luckiest Guy', serif" }}
              >
                <RefreshCw size={17} /> PLAY AGAIN
              </Button>
            )}
          </div>
        </div>

        {/* Felt Table Area */}
        <div className="flex-1 p-4 sm:p-6 md:p-10 flex flex-col justify-between items-center min-h-[360px] sm:min-h-[520px] relative border-t lg:border-t-0 order-1 lg:order-2" style={{ backgroundColor: '#080D13', borderColor: '#19212A' }}>
          <div className="text-center select-none opacity-15 pointer-events-none mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-widest uppercase" style={{ color: '#FFFFFF', fontFamily: "'Luckiest Guy', serif" }}>
              BLACKJACK PAYS 3 TO 2
            </div>
            <div className="text-[10px] sm:text-xs uppercase font-semibold" style={{ color: '#818E9D', fontFamily: "'Luckiest Guy', serif" }}>
              Dealer Must Draw to 16 and Stand on all 17s
            </div>
          </div>

          {/* Dealer Area */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: '#818E9D', fontFamily: "'Luckiest Guy', serif", letterSpacing: '1.2px' }}>
              <span>Dealer Hand</span>
              {dealerHand.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-[8px] font-bold" style={{ backgroundColor: '#0F151B', color: '#FFFFFF', border: '1px solid #19212A' }}>
                  {dealerScore}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 min-h-[110px]">
              {dealerHand.map((card, idx) => {
                const isHoleHidden = idx === 1 && dealerHoleCardHidden
                return (
                  <CardView
                    key={idx}
                    card={card}
                    hidden={isHoleHidden}
                  />
                )
              })}
              {dealerHand.length === 0 && (
                <div className="w-16 h-24 rounded-[10px] border-2 border-dashed flex items-center justify-center text-xs font-bold" style={{ borderColor: '#19212A', color: '#818E9D' }}>
                  Empty
                </div>
              )}
            </div>
          </div>

          {/* Outcome Banner */}
          <div className="h-12 flex items-center justify-center z-10">
            {outcomeMessage && (
              <div
                className={`px-6 py-2 rounded-full font-bold text-xs uppercase flex items-center gap-2 ${
                  outcomeType === 'win'
                    ? 'border'
                    : outcomeType === 'push'
                    ? 'border'
                    : 'border'
                }`}
                style={{
                  backgroundColor: outcomeType === 'win' ? '#38B9F2' : outcomeType === 'push' ? '#E2E8F0' : '#DB585D',
                  color: outcomeType === 'win' ? '#000000' : outcomeType === 'push' ? '#000000' : '#FFFFFF',
                  borderColor: outcomeType === 'win' ? '#38B9F2' : outcomeType === 'push' ? '#E2E8F0' : '#DB585D',
                  boxShadow: outcomeType === 'win' ? 'rgba(56, 185, 242,0.28) 0 0 6.2px 0' : 'none',
                  fontFamily: "'Luckiest Guy', serif",
                }}
              >
                {outcomeType === 'win' && <Sparkles size={16} />}
                <span>{outcomeMessage}</span>
              </div>
            )}
          </div>

          {/* Player Area */}
          <div className="flex flex-col items-center gap-2 mb-2 z-10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: '#818E9D', fontFamily: "'Luckiest Guy', serif", letterSpacing: '1.2px' }}>
              <span>Player Hand</span>
              {playerHand.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-[8px] font-bold" style={{ backgroundColor: '#0F151B', color: '#FFFFFF', border: '1px solid #19212A' }}>
                  {playerScore}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 min-h-[110px]">
              {playerHand.map((card, idx) => (
                <CardView key={idx} card={card} hidden={false} />
              ))}
              {playerHand.length === 0 && (
                <div className="w-16 h-24 rounded-[10px] border-2 border-dashed flex items-center justify-center text-xs font-bold" style={{ borderColor: '#19212A', color: '#818E9D' }}>
                  Empty
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AuthGuardModal isOpen={!loading && !user} />
    </div>
  )
}

function CardView({ card, hidden }: { card: Card; hidden: boolean }) {
  if (hidden) {
    return (
      <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-[10px] flex items-center justify-center border-2 select-none" style={{ background: 'linear-gradient(135deg, #423C3A, #19212A)', borderColor: '#5F5C58' }}>
        <div className="w-12 h-20 sm:w-16 sm:h-24 rounded-[8px] flex items-center justify-center" style={{ border: '1px solid #5F5C58' }}>
          <span className="text-xl opacity-60" style={{ color: '#38B9F2' }}>♠</span>
        </div>
      </div>
    )
  }

  const isRed = card.suit === '♥' || card.suit === '♦'

  return (
    <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-[10px] flex flex-col justify-between p-2 font-bold select-none" style={{ backgroundColor: '#FFFFFF', border: '1px solid #19212A' }}>
      <div className={`flex items-center justify-between text-xs sm:text-sm leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
      <div className={`text-center text-2xl sm:text-3xl ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {card.suit}
      </div>
      <div className={`flex items-center justify-between text-xs sm:text-sm leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
    </div>
  )
}
