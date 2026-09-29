'use client'

import React from 'react'

interface MarketHeaderProps {
  startAt: number
  endAt: number
}

function formatLocalTimeWindow(startAt: number, endAt: number): string {
  if (!startAt || !endAt) return '--:-- to --:--'
  const start = new Date(startAt * 1000)
  const end = new Date(endAt * 1000)
  const format = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${format(start)} to ${format(end)}`
}

export default function MarketHeader({ startAt, endAt }: MarketHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gamdom-border select-none">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim flex items-center gap-1.5 mb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gamdom-green animate-pulse" />
          5-Minute Price Prediction
        </div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold uppercase text-white tracking-wider flex items-center gap-2">
            <span className="text-gamdom-gold font-black">₿</span> Bitcoin Up or Down
          </h1>
          <span className="text-xs font-semibold text-gamdom-textDim">
            {formatLocalTimeWindow(startAt, endAt)}
          </span>
        </div>
      </div>

      {/* BTC Live Badge */}
      <div className="flex items-center gap-2 bg-gamdom-dark border border-gamdom-border px-3 py-1.5 rounded-xl">
        <span className="text-gamdom-gold font-black text-sm">₿</span>
        <span className="text-xs font-black text-white">BTC / USD</span>
        <span className="w-1.5 h-1.5 rounded-full bg-gamdom-green animate-pulse ml-1" />
        <span className="text-[10px] font-bold text-gamdom-green uppercase">Live</span>
      </div>
    </div>
  )
}
