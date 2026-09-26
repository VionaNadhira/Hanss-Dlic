'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  MessageSquare, 
  ChevronDown,
  LogIn,
  UserPlus,
  LogOut,
  Menu,
  X,
  Home,
  Gamepad2,
  LucideDices,
  Bomb,
  Rocket,
  Spade,
  Gem,
  Coins
} from 'lucide-react'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import DepositModal from '@/components/DepositModal'
import NotificationBell from '@/components/NotificationBell'

interface HeaderProps {
  onToggleChat?: () => void
  isChatOpen?: boolean
  onJumpToMessage?: (messageId: string) => void
}

export default function Header({ onToggleChat, isChatOpen, onJumpToMessage }: HeaderProps) {
  const { balance } = useBalance()
  const { user, logout } = useAuth()
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const games = [
    { href: '/dice', label: 'Dice', icon: LucideDices, color: 'text-gamdom-blue' },
    { href: '/mines', label: 'Mines', icon: Bomb, color: 'text-gamdom-gold' },
    { href: '/crash', label: 'Crash', icon: Rocket, color: 'text-gamdom-red' },
    { href: '/limbo', label: 'Limbo', icon: Gem, color: 'text-gamdom-green' },
    { href: '/blackjack', label: 'Blackjack', icon: Spade, color: 'text-purple-400' },
    { href: '/fruitninja', label: 'Fruit Ninja', icon: LucideDices, color: 'text-orange-400' },
  ]

  return (
    <>
      <header className="min-h-16 bg-gamdom-header border-b border-gamdom-border px-3 sm:px-4 lg:px-6 pt-[env(safe-area-inset-top)] flex items-center justify-between sticky top-0 z-40 select-none shadow-md">
        {/* Left Section: Mobile Menu Button & Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl text-gamdom-text hover:text-white hover:bg-gamdom-card border border-transparent hover:border-gamdom-border transition"
            aria-label="Open Navigation Menu"
          >
            <Menu size={20} />
          </button>

          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-8 sm:w-12 sm:h-9 rounded-lg overflow-hidden flex items-center justify-center bg-transparent p-0.5">
              <img
                src="/dlicom-logo.webp"
                alt="Hanss Dlic Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center">
              <span className="text-xl sm:text-2xl min-[480px]:text-[28px] font-black tracking-wider text-white group-hover:text-gamdom-gold transition leading-none">
                HANSS<span className="text-gamdom-gold">DLIC</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Right Section: Notifications, Balance, Auth, Chat Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Notifications — members only */}
          {user && onJumpToMessage && <NotificationBell onJumpToMessage={onJumpToMessage} />}

          {/* Balance Pill + Faucet — members only */}
          {user && (
            <div className="flex items-center bg-gamdom-dark border border-gamdom-border rounded-xl p-0.5 sm:p-1 shadow-inner">
              <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1">
                <img
                  src="/dlicom-logo.webp"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="shrink-0 select-none hidden min-[360px]:block"
                  style={{ height: '14px', width: 'auto' }}
                />
                <div className="text-xs sm:text-sm font-black text-white tracking-tight leading-none">
                  ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => setIsDepositOpen(true)}
                className="bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-gamdom-green hover:scale-[1.02] active:scale-[0.98]"
              >
                FAUCET
              </button>
            </div>
          )}

          {/* User Auth Buttons / Profile */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-1.5 sm:gap-2 bg-gamdom-card border border-gamdom-border px-2 sm:px-2.5 py-1.5 min-h-[38px] sm:min-h-11 rounded-xl hover:border-gamdom-green/40 transition"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gamdom-green flex items-center justify-center font-black text-[11px] sm:text-xs text-gamdom-dark">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-white leading-none">{user.username}</div>
                  <div className="text-[10px] text-gamdom-green font-bold">Logged In</div>
                </div>
                <ChevronDown size={14} className="text-gamdom-text" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gamdom-card border border-gamdom-border rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-gamdom-border bg-gamdom-dark">
                    <p className="text-xs font-bold text-white truncate">{user.username}</p>
                    <p className="text-[10px] text-gamdom-green font-bold">Online</p>
                  </div>
                  <button
                    onClick={async () => { await logout(); setProfileOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gamdom-red hover:bg-gamdom-dark transition"
                  >
                    <LogOut size={13} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Link
                href="/login"
                className="flex items-center gap-1 bg-gamdom-card border border-gamdom-border px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:border-gamdom-green/40 transition"
              >
                <LogIn size={13} />
                <span className="hidden min-[380px]:inline">Login</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1 bg-gamdom-green text-gamdom-dark font-black px-2 sm:px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider hover:bg-gamdom-greenHover transition shadow-gamdom-green"
              >
                <UserPlus size={13} />
                <span className="hidden min-[380px]:inline">Register</span>
              </Link>
            </div>
          )}

          {/* Toggle Live Chat */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              title="Toggle Community Chat"
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                isChatOpen
                  ? 'bg-gamdom-green/20 border-gamdom-green/40 text-gamdom-green shadow-gamdom-green'
                  : 'bg-gamdom-card border-gamdom-border text-gamdom-text hover:text-white hover:border-gamdom-gold/30'
              }`}
            >
              <MessageSquare size={17} />
            </button>
          )}
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full bg-gamdom-sidebar border-r border-gamdom-border shadow-2xl flex flex-col justify-between p-4 z-10 animate-in slide-in-from-left duration-200">
            <div className="space-y-5 overflow-y-auto">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gamdom-border">
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden p-0.5">
                    <img src="/dlicom-logo.webp" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-lg font-black text-white">HANSS<span className="text-gamdom-gold">DLIC</span></span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-gamdom-text hover:text-white hover:bg-gamdom-dark transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User info if logged in */}
              {user ? (
                <div className="bg-gamdom-card border border-gamdom-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gamdom-green flex items-center justify-center font-black text-sm text-gamdom-dark">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{user.username}</div>
                      <div className="text-xs text-gamdom-gold font-bold">
                        ${balance.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setMobileMenuOpen(false); setIsDepositOpen(true) }}
                    className="w-full py-2 bg-gamdom-green text-gamdom-dark font-black rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <Coins size={14} /> Claim Free Faucet
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 text-center bg-gamdom-card border border-gamdom-border text-white font-bold rounded-xl text-xs uppercase"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 text-center bg-gamdom-green text-gamdom-dark font-black rounded-xl text-xs uppercase"
                  >
                    Register
                  </Link>
                </div>
              )}

              {/* Navigation Links */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gamdom-textDim px-2 mb-2">
                  Navigation
                </div>
                <div className="space-y-1">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:bg-gamdom-card transition"
                  >
                    <Home size={16} /> Home
                  </Link>
                  <Link
                    href="/games"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:bg-gamdom-card transition"
                  >
                    <Gamepad2 size={16} /> All Games
                  </Link>
                </div>
              </div>

              {/* Games Grid in Drawer */}
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
                        onClick={() => setMobileMenuOpen(false)}
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

            {/* Logout button at bottom if logged in */}
            {user && (
              <div className="pt-3 border-t border-gamdom-border">
                <button
                  onClick={async () => {
                    await logout()
                    setMobileMenuOpen(false)
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

      {/* Deposit Cashier Modal */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
      />
    </>
  )
}
