'use client'

import React, { useEffect, useState } from 'react'
import { Trophy, Award, ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'

interface LeaderboardUser {
  rank: number
  username: string
  score: number
  totalBets: number
  wonBets: number
  winRate: number
  tier: string
  tierColor: string
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setLeaderboard(data.leaderboard || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6 select-none bg-gamdom-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/play"
            className="p-2 rounded-xl bg-gamdom-card hover:bg-gamdom-cardHover border border-gamdom-border text-gamdom-text hover:text-white transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold uppercase text-white tracking-wider flex items-center gap-2">
              <Trophy size={22} className="text-gamdom-gold" /> Prediction Leaderboard
            </h1>
            <p className="text-xs text-gamdom-textDim mt-0.5">
              Top 50 traders by prediction score and accuracy
            </p>
          </div>
        </div>

        <Link
          href="/play"
          className="px-4 py-2 rounded-xl bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black text-xs uppercase tracking-wider transition shadow-gamdom-green"
        >
          Play Game
        </Link>
      </div>

      {/* Table Container */}
      <div className="bg-gamdom-surface border border-gamdom-border rounded-2xl overflow-hidden shadow-gamdom-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gamdom-dark border-b border-gamdom-border text-gamdom-textDim uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Trader</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4 text-right">Score</th>
                <th className="py-3 px-4 text-right">Win Rate</th>
                <th className="py-3 px-4 text-right">Total Bets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gamdom-border font-medium">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gamdom-textDim">
                    <div className="w-6 h-6 rounded-full border-2 border-gamdom-gold border-t-transparent animate-spin mx-auto mb-2" />
                    Loading Top Traders...
                  </td>
                </tr>
              )}

              {!loading && leaderboard.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gamdom-textDim">
                    No bets placed yet. Be the first to rank on the leaderboard!
                  </td>
                </tr>
              )}

              {leaderboard.map((user) => (
                <tr
                  key={user.username}
                  className="hover:bg-gamdom-card/60 transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-bold">
                    {user.rank === 1 ? (
                      <span className="text-gamdom-gold flex items-center gap-1 font-black">
                        🥇 #1
                      </span>
                    ) : user.rank === 2 ? (
                      <span className="text-slate-300 flex items-center gap-1 font-black">
                        🥈 #2
                      </span>
                    ) : user.rank === 3 ? (
                      <span className="text-amber-600 flex items-center gap-1 font-black">
                        🥉 #3
                      </span>
                    ) : (
                      <span className="text-gamdom-textDim">#{user.rank}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white">
                    {user.username}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase border"
                      style={{
                        color: user.tierColor,
                        borderColor: user.tierColor,
                        backgroundColor: `${user.tierColor}15`,
                      }}
                    >
                      {user.tier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-white">
                    {user.score.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-gamdom-green">
                    {user.winRate}%
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-gamdom-text">
                    {user.totalBets}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
