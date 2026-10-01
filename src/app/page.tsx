'use client'

import React from 'react'
import Link from 'next/link'
import Button from '@/components/ui/button'
import { LucideDices, Bomb, Rocket, Spade, Gem, Flame, Sparkles, Grid3x3, TrafficCone } from 'lucide-react'
import { MessageSquare } from 'lucide-react'

export default function Home() {
  const games = [
    {
      title: 'Dlicom Road',
      description: 'Send the mascot across the lanes and hope you clear every car',
      href: '/droad',
      icon: TrafficCone,
      badge: 'New',
      badgeColor: 'bg-gamdom-blue/20 text-gamdom-blue border-gamdom-blue/40',
      image: '/games/dlicomroad.png',
      borderColor: 'group-hover:border-gamdom-blue/50',
    },
    {
      title: 'Mines',
      description: 'Choose your mines, reveal diamonds, and cash out before detonation',
      href: '/mines',
      icon: Bomb,
      badge: 'Hot',
      badgeColor: 'bg-gamdom-gold/20 text-gamdom-gold border-gamdom-gold/40',
      image: '/games/mines.webp',
      borderColor: 'group-hover:border-gamdom-gold/50',
    },
    {
      title: 'Crash',
      description: 'Ride the accelerating multiplier and cash out before the rocket crashes',
      href: '/crash',
      icon: Rocket,
      badge: 'High Win',
      badgeColor: 'bg-gamdom-red/20 text-gamdom-red border-gamdom-red/40',
      image: '/games/crash.webp',
      borderColor: 'group-hover:border-gamdom-red/50',
    },
    {
      title: 'Limbo',
      description: 'Spin the reel and beat your target multiplier on every roll',
      href: '/limbo',
      icon: Gem,
      badge: 'New',
      badgeColor: 'bg-gamdom-green/20 text-gamdom-green border-gamdom-green/40',
      image: '/games/limbo.png',
      borderColor: 'group-hover:border-gamdom-green/50',
    },
    {
      title: 'Blackjack',
      description: 'Hit 21, double down, and beat the dealer in standard casino Blackjack',
      href: '/blackjack',
      icon: Spade,
      badge: 'Classic',
      badgeColor: 'bg-gamdom-blue/20 text-gamdom-blue border-gamdom-blue/40',
      image: '/games/blackjack.webp',
      borderColor: 'group-hover:border-gamdom-blue/50',
    },
    {
      title: 'Fruit Ninja',
      description: 'Slice juicy fruits, avoid the bomb, and stack multiplied payouts',
      href: '/fruitninja',
      icon: LucideDices,
      badge: 'New',
      badgeColor: 'bg-gamdom-green/20 text-gamdom-green border-gamdom-green/40',
      image: '/games/fruitninja.jpeg',
      borderColor: 'group-hover:border-gamdom-green/50',
    },
    {
      title: 'BTC Up or Down',
      description: 'Predict whether Bitcoin price goes up or down in the next 5 minutes',
      href: '/btcupdown',
      icon: Flame,
      badge: 'Live',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      image: '/games/btcupdown.jpeg',
      borderColor: 'group-hover:border-purple-500/50',
    },
    {
      title: 'Dlicom Flip',
      description: 'Choose Pink or Yellow, flip the coin, and win 1.96x!',
      href: '/dlicomflip',
      icon: MessageSquare,
      badge: 'New',
      badgeColor: 'bg-gamdom-red/20 text-gamdom-red border-gamdom-red/40',
      image: '/games/dlicomflip.png',
      borderColor: 'group-hover:border-gamdom-red/50',
    },
  ].sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 w-full" style={{ backgroundColor: '#080d13' }}>
      <style>{`@import url(\'https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;500&display=swap\');`}</style>
      {/* Gamdom Hero Banner */}
      <div
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-gamdom-border p-5 sm:p-8 lg:p-10 shadow-gamdom-card"
        style={{
          backgroundImage: 'url("/assets/Glossy Neon Casino Mascot in Motion.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl text-white mb-2 sm:mb-3 leading-tight" style={{ fontFamily: "'Anton', sans-serif", fontWeight: 400, letterSpacing: "0.01em", textTransform: "uppercase" }}>
            HanssDlic, a #1 casino platform
          </h1>
          <p className="text-gamdom-text text-xs sm:text-base leading-relaxed mb-4 sm:mb-6" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500 }}>
            Built from community to community, try casinos games without real deposit, real money, just free play. more games coming soon
          </p>
          <div className="flex flex-wrap items-center gap-3">

          </div>
        </div>
      </div>

      {/* Game Cards Grid */}
      <div className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-5 gap-6 justify-items-center">
        {games.map((game) => (
          <Link
            key={game.title}
            href={game.href}
            className="group relative block w-full max-w-[220px] aspect-[0.78] rounded-[12px] overflow-hidden border border-gamdom-border hover:border-gamdom-green/50 transition-all duration-300 shadow-gamdom-card hover:-translate-y-1.5"
          >
            <img
              src={game.image}
              alt={game.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
            />
          </Link>
        ))}
      </div>
    </div>
  )
}
