'use client'

import React from 'react'
import Link from 'next/link'
import Button from '@/components/ui/button'
import { LucideDices, Bomb, Rocket, Spade, Gem } from 'lucide-react'

export default function GamesPage() {
  const games = [
    {
      title: 'Dice',
      description: 'Classic roll over / roll under with customizable win chance',
      href: '/dice',
      icon: LucideDices,
      badge: 'Popular',
      badgeColor: 'bg-gamdom-green/20 text-gamdom-green border-gamdom-green/40',
      image: '/games/dice.webp',
      borderColor: 'group-hover:border-gamdom-green/50',
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
  ]

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 w-full">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {games.map((game) => (
          <Link
            key={game.title}
            href={game.href}
            className="group relative rounded-2xl overflow-hidden border border-gamdom-border hover:border-gamdom-green/50 transition-all duration-300 shadow-gamdom-card hover:-translate-y-1.5 block aspect-[3/4]"
          >
            <img
              src={game.image}
              alt={game.title}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 select-none"
            />
          </Link>
        ))}
      </div>
    </div>
  )
}
