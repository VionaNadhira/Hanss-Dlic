'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, LogIn, UserPlus, LogOut, MessageSquare } from 'lucide-react'
import { useBalance } from '@/context/BalanceContext'
import { useAuth } from '@/context/AuthContext'
import NotificationBell from '@/components/NotificationBell'

interface HeaderProps {
  onToggleChat?: () => void
  isChatOpen?: boolean
  onJumpToMessage?: (messageId: string) => void
  onOpenDeposit: () => void
}

export default function Header({ onToggleChat, isChatOpen, onJumpToMessage, onOpenDeposit }: HeaderProps) {
  const { balance } = useBalance()
  const { user, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <>
      <header className="min-h-16 bg-gamdom-header border-b border-gamdom-border px-3 sm:px-4 lg:px-6 pt-[env(safe-area-inset-top)] flex items-center justify-between sticky top-0 z-40 select-none shadow-md">
        {/* Left Section: Mobile Menu Button & Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
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
        <div className="hidden md:flex items-center gap-1.5 sm:gap-3">
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
                onClick={onOpenDeposit}
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
    </>
  )
}
