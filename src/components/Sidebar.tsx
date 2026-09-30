'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LucideHome, 
  LucideDices, 
  Bomb, 
  Rocket, 
  Spade, 
  Gamepad2, 
  Gift, 
  Crown, 
  ShieldCheck,
  Flame,
  HelpCircle,
  TrendingUp,
  Trophy,
  TrafficCone
} from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  const originals = [
    { href: '/btcupdown', label: 'BTC Up or Down', icon: TrendingUp, hot: true },
    { href: '/dice', label: 'Dice', icon: LucideDices, hot: false },
    { href: '/mines', label: 'Mines', icon: Bomb, hot: true },
    { href: '/droad', label: 'Dlicom Road', icon: TrafficCone, hot: true },
    { href: '/crash', label: 'Crash', icon: Rocket, hot: true },
    { href: '/blackjack', label: 'Blackjack', icon: Spade, hot: false },
  ]

  const explore = [
    { href: '/', label: 'Home', icon: LucideHome },
    { href: '/games', label: 'All Originals', icon: Gamepad2 },
  ]

  return (
    <aside className="w-60 min-h-[calc(100vh-64px)] bg-gamdom-sidebar border-r border-gamdom-border p-3.5 flex flex-col justify-between shrink-0 select-none hidden md:flex">
      <div className="space-y-5">
        {/* Main Section */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim px-3 mb-1.5">
            Lobby
          </div>
          <ul className="space-y-1">
            {explore.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-gamdom-card text-white border border-gamdom-border/80 shadow-md'
                        : 'text-gamdom-text hover:text-white hover:bg-gamdom-dark/80'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-gamdom-gold' : 'text-gamdom-text'} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Gamdom Originals */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim flex items-center gap-1">
              <Flame size={12} className="text-gamdom-gold" /> Originals
            </span>
            <span className="text-[9px] font-bold text-gamdom-green bg-gamdom-green/10 border border-gamdom-green/20 px-1.5 py-0.2 rounded">
              5 GAMES
            </span>
          </div>
          <ul className="space-y-1">
            {originals.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href === '/btcupdown' && pathname === '/play')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                      isActive
                        ? 'bg-gamdom-card text-white border border-gamdom-border/80 shadow-md font-black'
                        : 'text-gamdom-text hover:text-white hover:bg-gamdom-dark/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gamdom-green rounded-r" />
                      )}
                      <Icon
                        size={16}
                        className={isActive ? 'text-gamdom-green' : 'text-gamdom-text'}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.hot && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gamdom-gold/20 text-gamdom-gold border border-gamdom-gold/30">
                        HOT
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* VIP & Provably Fair Section */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim px-3 mb-1.5">
            Rewards
          </div>
          <ul className="space-y-1 text-xs font-bold">
            <li>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gamdom-text hover:text-white hover:bg-gamdom-dark/80 cursor-pointer transition">
                <Crown size={16} className="text-gamdom-gold" />
                <span>VIP Club</span>
              </div>
            </li>
            <li>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gamdom-text hover:text-white hover:bg-gamdom-dark/80 cursor-pointer transition">
                <Gift size={16} className="text-purple-400" />
                <span>Daily Rewards</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="bg-gamdom-dark/90 border border-gamdom-border rounded-xl p-3 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between font-bold">
          <span className="text-gamdom-text flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-gamdom-green" /> Fairness
          </span>
          <span className="text-gamdom-green text-[10px] bg-gamdom-green/10 border border-gamdom-green/20 px-1.5 py-0.5 rounded">
            VERIFIED
          </span>
        </div>
        <p className="text-[10px] text-gamdom-textDim leading-tight">
          All dice rolls, bomb seeds, and crash trajectories are cryptographically verifiable.
        </p>
      </div>
    </aside>
  )
}
