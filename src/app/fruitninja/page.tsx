'use client'

import React, { useState, useEffect, useRef } from 'react'
import Button from '@/components/ui/button'
import AuthGuardModal from '@/components/AuthGuardModal'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import { ShieldCheck, Play, RotateCcw } from 'lucide-react'

interface FlyingFruit {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  type: 'watermelon' | 'apple' | 'banana' | 'bomb'
  sliced: boolean
  mult: number
  image: HTMLImageElement | null
}

interface SlashPoint {
  x: number
  y: number
  time: number
}

export default function FruitNinjaRealPage() {
  const { balance, deductBalance, addBalance } = useBalance()
  const { user, loading } = useAuth()
  const [bet, setBet] = useState(10.00)
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle')
  const [score, setScore] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [finalPayout, setFinalPayout] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fruitsRef = useRef<FlyingFruit[]>([])
  const slashesRef = useRef<SlashPoint[]>([])
  const isPlayingRef = useRef(false)
  const animFrameRef = useRef<number | null>(null)
  const swordAudioRef = useRef<HTMLAudioElement | null>(null)
  const fruitImagesRef = useRef<Record<string, HTMLImageElement>>({})
  useEffect(() => {
    const map: Record<string, string> = {
      watermelon: '/ninjas/0ffe80635d10bde4767d43aeee51dda6b89877a3.png',
      apple: '/ninjas/b0a43479fef043921a5fc8448227ff0d05f1e446.png',
      banana: '/ninjas/9d3a558bff61e0c9331045fb40e964ae97aef43f.png',
      bomb: '/ninjas/d2833301609720c206d9ed005186712a44500fcb.png',
    }
    Object.entries(map).forEach(([k, src]) => {
      const img = new window.Image()
      img.src = src
      fruitImagesRef.current[k] = img
    })
  }, [])

  useEffect(() => {
    const a = new Audio('/ninjas/sword.mp3')
    a.volume = 0.6
    swordAudioRef.current = a
  }, [])

  const betRef = useRef(bet)
  useEffect(() => { betRef.current = bet }, [bet])

  const startGame = () => {
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

    setScore(0)
    setStrikes(0)
    setFinalPayout(0)
    fruitsRef.current = []
    isPlayingRef.current = true
    setGameState('playing')
  }

  const triggerGameOver = (currentScore: number) => {
    if (!isPlayingRef.current) return
    isPlayingRef.current = false
    setGameState('gameover')

    if (currentScore > 0) {
      const payout = +(betRef.current * (1 + currentScore * 0.3)).toFixed(2)
      setFinalPayout(payout)
      addBalance(payout)
    } else {
      setFinalPayout(0)
    }
  }

  // Canvas game loop & physics
  useEffect(() => {
    if (gameState !== 'playing') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastSpawn = performance.now()
    let fruitIdCounter = 0
    let localScore = 0
    let localStrikes = 0

    const spawnFruit = () => {
      let type: FlyingFruit['type']
      const roll = Math.random()
      if (roll < 0.08) {
        type = 'bomb'
      } else if (roll < 0.45) {
        type = 'watermelon'
      } else if (roll < 0.75) {
        type = 'apple'
      } else {
        type = 'banana'
      }
      let mult = 1.5
      if (type === 'apple') mult = 1.8
      if (type === 'banana') mult = 2.2
      if (type === 'bomb') mult = 0

      const x = Math.random() * (canvas.width - 150) + 75
      const y = canvas.height + 40
      const vx = (canvas.width / 2 - x) * 0.015 + (Math.random() - 0.5) * 3
      const vy = -(Math.random() * 6 + 12)

      fruitsRef.current.push({
        id: fruitIdCounter++,
        x,
        y,
        vx,
        vy,
        radius: 35,
        type,
        sliced: false,
        mult,
        image: fruitImagesRef.current[type] || null,
      })
    }

    const loop = (now: number) => {
      if (!isPlayingRef.current) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (now - lastSpawn > 650) {
        const count = Math.floor(Math.random() * 2) + 2
        for (let i = 0; i < count; i++) spawnFruit()
        lastSpawn = now
      }

      const currentFruits = fruitsRef.current
      const nextFruits: FlyingFruit[] = []

      for (const f of currentFruits) {
        f.x += f.vx
        f.y += f.vy
        f.vy += 0.35 // gravity

        ctx.save()
        if (f.sliced) {
          ctx.globalAlpha = 0.5
          ctx.font = '25px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('✨', f.x, f.y)
        } else if (f.type === 'bomb') {
          ctx.font = '58px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.shadowColor = '#FF4444'
          ctx.shadowBlur = 16
          ctx.fillText('💣', f.x, f.y)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        } else if (f.image && f.image.complete && f.image.naturalWidth > 0) {
          const size = 58
          ctx.drawImage(f.image, f.x - size / 2, f.y - size / 2, size, size)
        } else {
          ctx.font = '35px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('🍉', f.x, f.y)
        }
        ctx.restore()

        if (f.y > canvas.height + 60) {
          if (!f.sliced && f.type !== 'bomb') {
            localStrikes++
            setStrikes(localStrikes)
            if (localStrikes >= 3) {
              triggerGameOver(localScore)
              return
            }
          }
          continue
        }

        nextFruits.push(f)
      }
      fruitsRef.current = nextFruits

      const nowTime = Date.now()
      slashesRef.current = slashesRef.current.filter((p) => nowTime - p.time < 150)
      const slashes = slashesRef.current

      if (slashes.length > 1) {
        ctx.strokeStyle = '#38B9F2'
        ctx.lineWidth = 6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(slashes[0].x, slashes[0].y)
        for (let i = 1; i < slashes.length; i++) {
          ctx.lineTo(slashes[i].x, slashes[i].y)
        }
        ctx.stroke()
      }

      if (isPlayingRef.current) {
        animFrameRef.current = requestAnimationFrame(loop)
      }
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [gameState])

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing' || !isPlayingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    slashesRef.current.push({ x, y, time: Date.now() })

    for (const f of fruitsRef.current) {
      if (!f.sliced) {
        const dx = f.x - x
        const dy = f.y - y
        if (Math.hypot(dx, dy) < f.radius + 25) {
          f.sliced = true
          if (f.type === 'bomb') {
            triggerGameOver(score)
            return
          } else {
            if (swordAudioRef.current) {
              swordAudioRef.current.currentTime = 0
              swordAudioRef.current.play().catch(() => {})
            }
            setScore((s) => {
              const nextS = s + 1
              return nextS
            })
          }
        }
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gamdom-dark border border-gamdom-border overflow-hidden p-0.5 shadow-md">
            <img src="/games/fruitninja.jpeg" alt="Fruit Ninja" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">Fruit Ninja Arcade</h1>
            <p className="text-xs text-gamdom-text">Swipe across flying fruits with your mouse/touch to slice them!</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gamdom-green bg-gamdom-green/10 border border-gamdom-green/20 px-3 py-1.5 rounded-xl font-bold">
          <ShieldCheck size={14} />
          <span>Provably Fair RNG</span>
        </div>
      </div>

      <div className="bg-gamdom-card rounded-3xl overflow-hidden border border-gamdom-border flex flex-col lg:flex-row shadow-gamdom-card">
        <div className="w-full lg:w-80 p-4 sm:p-6 bg-gamdom-dark border-b lg:border-b-0 lg:border-r border-gamdom-border flex flex-col justify-between shrink-0 order-2 lg:order-1">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-black text-gamdom-text uppercase tracking-wider">
                  Bet Amount
                </label>
                <span className="text-[11px] text-gamdom-text">Balance: <span className="text-white font-bold">${balance.toFixed(2)}</span></span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gamdom-gold font-black text-sm">$</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  disabled={gameState === 'playing'}
                  value={bet}
                  onChange={(e) => setBet(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-gamdom-input border border-gamdom-border rounded-xl py-2.5 pl-8 pr-3 text-white font-bold text-sm focus:outline-none focus:border-gamdom-green transition disabled:opacity-50 shadow-inner"
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5 mt-2">
                {[1, 5, 25, 50, 100].map((c) => (
                  <button
                    key={c}
                    disabled={gameState === 'playing'}
                    onClick={() => setBet((prev) => +(prev + c).toFixed(2))}
                    className="bg-gamdom-card hover:bg-gamdom-cardHover border border-gamdom-border text-xs font-black py-1.5 rounded-lg text-gamdom-gold hover:border-gamdom-gold/50 transition disabled:opacity-40"
                  >
                    +${c}
                  </button>
                ))}
              </div>
            </div>

            {gameState === 'playing' && (
              <div className="bg-gamdom-input/80 border border-gamdom-border rounded-xl p-3.5 space-y-2 text-xs shadow-inner">
                <div className="flex justify-between items-center text-gamdom-text">
                  <span className="font-medium">Fruits Sliced</span>
                  <span className="font-black text-gamdom-green text-sm">{score}</span>
                </div>
                <div className="flex justify-between items-center text-gamdom-text">
                  <span className="font-medium">Strikes (Missed)</span>
                  <span className="font-black text-gamdom-red text-sm">{strikes} / 3</span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="text-xs text-gamdom-red bg-gamdom-red/10 border border-gamdom-red/30 p-2.5 rounded-xl text-center font-bold">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="pt-6">
            {gameState !== 'playing' ? (
              <Button
                onClick={startGame}
                className="w-full h-14 rounded-2xl font-black text-sm tracking-wider uppercase bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark shadow-gamdom-green hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Play size={18} /> START GAME (${bet.toFixed(2)})
              </Button>
            ) : (
              <div className="text-center text-xs text-gamdom-green font-bold animate-pulse">
                🎮 Swipe mouse across canvas to slice fruits!
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-3 sm:p-6 flex flex-col items-center justify-center bg-gradient-to-b from-[#162232] via-[#0f1622] to-[#0a0e16] min-h-[340px] sm:min-h-[520px] relative order-1 lg:order-2">
          {gameState === 'gameover' && (
            <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
              <h2 className="text-3xl font-black text-white uppercase tracking-wider">GAME OVER</h2>
              <p className="text-sm text-gamdom-text">You sliced <span className="text-white font-bold">{score}</span> fruits!</p>
              {finalPayout > 0 ? (
                <div className="px-6 py-2 rounded-full bg-gamdom-green/20 border border-gamdom-green text-gamdom-green font-black text-sm">
                  Won +${finalPayout.toFixed(2)}
                </div>
              ) : (
                <div className="px-6 py-2 rounded-full bg-gamdom-red/20 border border-gamdom-red text-gamdom-red font-black text-sm">
                  Lost ${bet.toFixed(2)}
                </div>
              )}
              <Button
                onClick={() => setGameState('idle')}
                className="mt-4 px-6 h-12 bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black rounded-xl text-xs uppercase tracking-wider shadow-gamdom-green flex items-center gap-2"
              >
                <RotateCcw size={15} /> Play Again
              </Button>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={700}
            height={480}
            onPointerDown={handlePointerMove}
            onPointerMove={handlePointerMove}
            className="w-full h-full max-w-[700px] max-h-[480px] rounded-2xl bg-gamdom-dark border border-gamdom-border shadow-inner cursor-crosshair touch-none"
          />
        </div>
      </div>
      <AuthGuardModal isOpen={!loading && !user} />
    </div>
  )
}
