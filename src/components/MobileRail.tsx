'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  MessageSquare,
  Menu,
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

interface MobileRailProps {
  onToggleChat?: () => void
  isChatOpen?: boolean
  onJumpToMessage?: (messageId: string) => void
  onOpenDeposit: () => void
}

export default function MobileRail({
  onToggleChat,
  isChatOpen,
  onJumpToMessage,
  onOpenDeposit,
}: MobileRailProps) {
  const { balance } = useBalance()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const games = [
    { href: '/dice', label: 'Dice', icon: LucideDices, color: 'text-gamdom-blue' },
    { href: '/mines', label: 'Mines', icon: Bomb, color: 'text-gamdom-gold' },
    { href: '/crash', label: 'Crash', icon: Rocket, color: 'text-gamdom-red' },
    { href: '/limbo', label: 'Limbo', icon: Gem, color: 'text-gamdom-green' },
    { href: '/blackjack', label: 'Blackjack', icon: Spade, color: 'text-purple-400' },
    { href: '/fruitninja', label: 'Fruit Ninja', icon: LucideDices, color: 'text-orange-400' },
    { href: '/keno', label: 'Keno', icon: Grid3x3, color: 'text-gamdom-green' },
  ]

  // The rail is only 44px wide, so large balances get a compact form.
  const balanceLabel =
    balance >= 1000
      ? `$${(balance / 1000).toFixed(balance >= 10000 ? 0 : 2)}K`
      : `$${balance.toFixed(2)}`

  return (
    <>
      <nav
        aria-label="Quick actions"
        className="md:hidden fixed inset-y-0 left-0 z-30 w-16 bg-gamdom-header border-r border-gamdom-border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] flex flex-col items-center gap-1.5 py-3"
      >
        <button
          onClick={() => setMenuOpen(true)}
          title="Menu"
          aria-label="Open Navigation Menu"
          className="w-11 h-11 rounded-xl text-gamdom-text hover:text-white hover:bg-gamdom-card border border-transparent hover:border-gamdom-border transition shrink-0"
        >
          <Menu size={20} className="mx-auto" />
        </button>

        <div className="flex flex-col items-center gap-1.5 shrink-0">
          {user && onJumpToMessage && <NotificationBell onJumpToMessage={onJumpToMessage} />}

          {user && (
            <div
              title={`Balance $${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              className="w-11 flex flex-col items-center gap-1 py-1.5 rounded-xl bg-gamdom-dark border border-gamdom-border shadow-inner"
            >
              <img
                src="/dlicom-logo.webp"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="shrink-0 select-none"
                style={{ height: '10px', width: 'auto' }}
              />
              <span className="text-[9px] font-black text-white leading-none tracking-tight tabular-nums">
                {balanceLabel}
              </span>
            </div>
          )}

          {user && (
            <button
              onClick={onOpenDeposit}
              title="Faucet"
              aria-label="Open Faucet"
              className="w-11 h-11 rounded-xl bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark shadow-gamdom-green flex items-center justify-center transition-all active:scale-95 shrink-0"
            >
              <Coins size={19} />
            </button>
          )}

          {onToggleChat && (
            <button
              onClick={onToggleChat}
              title="Community Chat"
              aria-label="Toggle Community Chat"
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                isChatOpen
                  ? 'bg-gamdom-green/20 border-gamdom-green/40 text-gamdom-green shadow-gamdom-green'
                  : 'bg-gamdom-card border-gamdom-border text-gamdom-text hover:text-white hover:border-gamdom-gold/30'
              }`}
            >
              <MessageSquare size={18} />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {user ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              title={user.username}
              aria-label="Account"
              className="w-10 h-10 rounded-xl bg-gamdom-green text-gamdom-dark font-black text-sm flex items-center justify-center hover:bg-gamdom-greenHover transition"
            >
              {user.username[0].toUpperCase()}
            </button>
            {profileOpen && (
              <div className="absolute bottom-0 left-full ml-2 w-44 bg-gamdom-card border border-gamdom-border rounded-xl shadow-xl overflow-hidden z-40">
                <div className="px-3 py-2 border-b border-gamdom-border bg-gamdom-dark">
                  <p className="text-xs font-bold text-white truncate">{user.username}</p>
                  <p className="text-[10px] text-gamdom-green font-bold">Online</p>
                </div>
                <button
                  onClick={async () => {
                    await logout()
                    setProfileOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gamdom-red hover:bg-gamdom-dark transition"
                >
                  <LogOut size={13} /> Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setMenuOpen(true)}
            title="Sign in"
            aria-label="Sign in or register"
            className="w-10 h-10 rounded-xl bg-gamdom-card border border-gamdom-border text-gamdom-text hover:text-white hover:border-gamdom-green/40 flex items-center justify-center transition shrink-0"
          >
            <LogIn size={18} />
          </button>
        )}
      </nav>

      {/* Mobile Slide-Over Navigation Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMenuOpen(false)}
          />

          <div className="relative w-72 max-w-[85vw] h-full bg-gamdom-sidebar border-r border-gamdom-border shadow-2xl flex flex-col justify-between p-4 z-10 animate-in slide-in-from-left duration-200">
            <div className="space-y-5 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gamdom-border">
                <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden p-0.5">
                    <img src="/dlicom-logo.webp" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-lg font-black text-white">
                    HANSS<span className="text-gamdom-gold">DLIC</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1 rounded-lg text-gamdom-text hover:text-white hover:bg-gamdom-dark transition"
                >
                  <X size={18} />
                </button>
              </div>

              {user ? (
                <div className="bg-gamdom-card border border-gamdom-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gamdom-green flex items-center justify-center font-black text-sm text-gamdom-dark">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{user.username}</div>
                      <div className="text-xs text-gamdom-gold font-bold">${balance.toFixed(2)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenDeposit()
                    }}
                    className="w-full py-2 bg-gamdom-green text-gamdom-dark font-black rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <Coins size={14} /> Claim Free Faucet
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="py-2.5 text-center bg-gamdom-card border border-gamdom-border text-white font-bold rounded-xl text-xs uppercase"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                    className="py-2.5 text-center bg-gamdom-green text-gamdom-dark font-black rounded-xl text-xs uppercase"
                  >
                    Register
                  </Link>
                </div>
              )}

              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim px-2 mb-2">
                  Navigation
                </div>
                <div className="space-y-1">
                  <Link
                    href="/"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:bg-gamdom-card transition"
                  >
                    <Home size={16} /> Home
                  </Link>
                  <Link
                    href="/games"
                    onClick={() => setMenuOpen(false)}
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
                        onClick={() => setMenuOpen(false)}
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

            {user && (
              <div className="pt-3 border-t border-gamdom-border">
                <button
                  onClick={async () => {
                    await logout()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-gamdom-red bg-gamdom-red/10 border border-gamdom-red/30 rounded-xl"
                >
                  <LogOut size={14} /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
