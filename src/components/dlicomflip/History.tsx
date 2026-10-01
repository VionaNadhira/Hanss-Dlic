'use client'

import React from 'react'

interface HistoryProps {
  history: ('pink' | 'yellow')[]
}

export default function History({ history }: HistoryProps) {
  if (history.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: "'Gamdom', sans-serif",
          color: '#6f7d8a',
        }}
      >
        History:
      </span>
      <div style={{ display: 'flex', gap: '6px' }}>
        {history.map((color, idx) => {
          const src = color === 'pink' ? '/dlicomflip/pink.png' : '/dlicomflip/yellow.png';
          return (
            <img
              key={idx}
              src={src}
              alt={color}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                objectFit: 'contain',
              }}
            />
          );
        })}
      </div>
    </div>
  )
}
