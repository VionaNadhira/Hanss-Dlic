'use client'

import React from 'react'
import Link from 'next/link'
import {
  MessageSquare,
  X,
  Home,
  Gamepad2,
  LucideDices,
  Bomb,
  Rocket,
  Spade,
  Gem,
  Coins,
  Grid3x3,
  LogOut,
  LogIn,
} from 'lucide-react'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import NotificationBell from '@/components/NotificationBell'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  onToggleChat?: () => void
  isChatOpen?: boolean
  onJumpToMessage?: (messageId: string) => void
  onOpenDeposit: () => void
}

export default function MobileDrawer({
  open,
  onClose,
  onToggleChat,
  isChatOpen,
  onJumpToMessage,
  onOpenDeposit,
}: MobileDrawerProps) {
  const { balance } = useBalance()
  const { user } = useAuth()

  const games = [
    { href: '/dice', label: 'Dice', icon: LucideDices, color: 'text-gamdom-blue' },
    { href: '/mines', label: 'Mines', icon: Bomb, color: 'text-gamdom-gold' },
    { href: '/crash', label: 'Crash', icon: Rocket, color: 'text-gamdom-red' },
    { href: '/limbo', label: 'Limbo', icon: Gem, color: 'text-gamdom-green' },
    { href: '/blackjack', label: 'Blackjack', icon: Spade, color: 'text-purple-400' },
    { href: '/fruitninja', label: 'Fruit Ninja', icon: LucideDices, color: 'text-orange-400' },
    { href: '/keno', label: 'Keno', icon: Grid3x3, color: 'text-gamdom-green' },
  ]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-72 max-w-[85vw] h-full bg-gamdom-sidebar border-r border-gamdom-border shadow-2xl flex flex-col justify-between p-4 z-10 animate-in slide-in-from-left duration-200">
        <div className="space-y-5 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-gamdom-border">
            <Link href="/" onClick={onClose} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden p-0.5">
                <img src="/dlicom-logo.webp" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-black text-white">
                HANSS<span className="text-gamdom-gold">DLIC</span>
              </span>
            </Link>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="p-1 rounded-lg text-gamdom-text hover:text-white hover:bg-gamdom-dark transition"
            >
              <X size={18} />
            </button>
          </div>

          {user ? (
            <div className="bg-gamdom-card border border-gamdom-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <img
                  src={user.avatarUrl || `https://xsgames.co/randomusers/avatar.php?g=pixel&seed=${encodeURIComponent(user.username)}`}
                  alt={user.username}
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                  onError={(e) => {
                    const t = e.currentTarget as HTMLImageElement
                    t.onerror = null
                    t.src = `https://xsgames.co/randomusers/avatar.php?g=pixel&seed=${encodeURIComponent(user.username)}`
                  }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{user.username}</div>
                  <div className="text-xs text-gamdom-gold font-bold">${balance.toFixed(2)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onJumpToMessage && <NotificationBell onJumpToMessage={onJumpToMessage} />}
                <button
                  onClick={() => {
                    onClose()
                    onOpenDeposit()
                  }}
                  title="Faucet"
                  aria-label="Open Faucet"
                  className="h-9 w-9 rounded-lg bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark shadow-gamdom-green flex items-center justify-center transition-all active:scale-95 shrink-0"
                >
                  <Coins size={16} />
                </button>
                {onToggleChat && (
                  <button
                    onClick={() => {
                      onClose()
                      onToggleChat()
                    }}
                    title="Community Chat"
                    aria-label="Toggle Community Chat"
                    className={`h-9 w-9 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                      isChatOpen
                        ? 'bg-gamdom-green/20 border-gamdom-green/40 text-gamdom-green shadow-gamdom-green'
                        : 'bg-gamdom-dark border-gamdom-border text-gamdom-text hover:text-white hover:border-gamdom-gold/30'
                    }`}
                  >
                    <MessageSquare size={16} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={onClose}
                  className="py-2.5 text-center bg-gamdom-card border border-gamdom-border text-white font-bold rounded-xl text-xs uppercase"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={onClose}
                  className="py-2.5 text-center bg-gamdom-green text-gamdom-dark font-black rounded-xl text-xs uppercase"
                >
                  Register
                </Link>
              </div>
              {onToggleChat && (
                <button
                  onClick={() => {
                    onClose()
                    onToggleChat()
                  }}
                  title="Community Chat"
                  aria-label="Toggle Community Chat"
                  className={`w-full h-9 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    isChatOpen
                      ? 'bg-gamdom-green/20 border-gamdom-green/40 text-gamdom-green'
                      : 'bg-gamdom-dark border-gamdom-border text-gamdom-text hover:text-white'
                  }`}
                >
                  <MessageSquare size={16} /> Community Chat
                </button>
              )}
            </div>
          )}

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim px-2 mb-2">
              Navigation
            </div>
            <div className="space-y-1">
              <Link
                href="/"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:bg-gamdom-card transition"
              >
                <Home size={16} /> Home
              </Link>
              <Link
                href="/games"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:bg-gamdom-card transition"
              >
                <Gamepad2 size={16} /> All Games
              </Link>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim px-2 mb-2">
              Casino Games
            </div>
            <div className="space-y-1">
              {games.map((g) => {
                const Icon = g.icon
                return (
                  <Link
                    key={g.href}
                    href={g.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:bg-gamdom-card transition"
                  >
                    <Icon size={16} className={g.color} />
                    <span>{g.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {user ? (
          <div className="pt-3 border-t border-gamdom-border">
            <LogoutButton onDone={onClose} />
          </div>
        ) : (
          <div className="pt-3 border-t border-gamdom-border">
            <Link
              href="/login"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-gamdom-text bg-gamdom-card border border-gamdom-border rounded-xl"
            >
              <LogIn size={14} /> Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function LogoutButton({ onDone }: { onDone: () => void }) {
  const { logout } = useAuth()

  return (
    <button
      onClick={async () => {
        await logout()
        onDone()
      }}
      className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-gamdom-red bg-gamdom-red/10 border border-gamdom-red/30 rounded-xl"
    >
      <LogOut size={14} /> Log Out
    </button>
  )
}
