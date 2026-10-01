'use client'

import React from 'react'

interface CoinProps {
  isFlipping: boolean
  rotation: number // degrees
}

export default function Coin({ isFlipping, rotation }: CoinProps) {
  return (
    <div
      className="relative inline-block"
      style={{
        width: '320px',
        height: '320px',
        maxWidth: '330px',
        maxHeight: '330px',
        perspective: '1000px',
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: isFlipping ? 'none' : 'transform 1000ms ease-out',
          transform: `rotateY(${rotation}deg)`,
        }}
      >
        {/* Front (yellow) */}
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: 'hidden',
            backgroundImage: 'url("/dlicomflip/yellow.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '50%',
          }}
        />
        {/* Back (pink) */}
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: 'hidden',
            backgroundImage: 'url("/dlicomflip/pink.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '50%',
            transform: 'rotateY(180deg)',
          }}
        />
      </div>
    </div>
  )
}
