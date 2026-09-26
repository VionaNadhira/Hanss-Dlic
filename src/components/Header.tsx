'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  MessageSquare, 
  ChevronDown,
  LogIn,
  UserPlus,
  LogOut
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

  return (
    <>
      <header className="min-h-16 bg-gamdom-header border-b border-gamdom-border px-4 lg:px-6 pt-[env(safe-area-inset-top)] flex items-center justify-between sticky top-0 z-40 select-none shadow-md">
        {/* Left Section: Logo & Quick Categories */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-12 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-transparent p-0.5">
              <img
                src="/dlicom-logo.webp"
                alt="Hanss Dlic Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden min-[480px]:flex items-center">
              <span className="text-[30px] font-black tracking-wider text-white group-hover:text-gamdom-gold transition leading-none">
                HANSS<span className="text-gamdom-gold">DLIC</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Right Section: Notifications, Balance, Deposit Button, Profile, Chat Toggle */}
        <div className="flex items-center gap-3">
          {/* Notifications — members only, left of the balance pill */}
          {user && onJumpToMessage && <NotificationBell onJumpToMessage={onJumpToMessage} />}

          {/* Balance Pill + Faucet — members only */}
          {user && (
            <div className="flex items-center bg-gamdom-dark border border-gamdom-border rounded-xl p-1 shadow-inner">
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1">
                <img
                  src="/dlicom-logo.webp"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="shrink-0 select-none"
                  style={{ height: '14px', width: 'auto', display: 'block' }}
                />
                <div className="text-sm font-black text-white tracking-tight leading-none">
                  ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => setIsDepositOpen(true)}
                className="bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black px-2.5 sm:px-4 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-gamdom-green hover:scale-[1.02] active:scale-[0.98]"
              >
                FAUCET
              </button>
            </div>
          )}

          {/* User Auth */}
          {user ? (
            <div className="relative hidden sm:block">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 bg-gamdom-card border border-gamdom-border px-2.5 py-1.5 min-h-11 rounded-xl hover:border-gamdom-green/40 transition"
              >
                <div className="w-7 h-7 rounded-lg bg-gamdom-green flex items-center justify-center font-black text-xs text-gamdom-dark">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-white leading-none">{user.username}</div>
                  <div className="text-[10px] text-gamdom-green font-bold">Logged In</div>
                </div>
                <ChevronDown size={14} className="text-gamdom-text" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-gamdom-card border border-gamdom-border rounded-xl shadow-xl overflow-hidden z-50">
                  <button
                    onClick={async () => { await logout(); setProfileOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gamdom-text hover:bg-gamdom-dark hover:text-white transition"
                  >
                    <LogOut size={13} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5">
              <Link href="/login" className="flex items-center gap-1.5 bg-gamdom-card border border-gamdom-border px-3 py-1.5 rounded-xl text-xs font-bold text-gamdom-text hover:text-white hover:border-gamdom-green/40 transition">
                <LogIn size={13} /> Login
              </Link>
              <Link href="/register" className="flex items-center gap-1.5 bg-gamdom-green text-gamdom-dark font-black px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider hover:bg-gamdom-greenHover transition">
                <UserPlus size={13} /> Register
              </Link>
            </div>
          )}

          {/* Toggle Live Chat */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              title="Toggle Community Chat"
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all ${
                isChatOpen
                  ? 'bg-gamdom-green/20 border-gamdom-green/40 text-gamdom-green shadow-gamdom-green'
                  : 'bg-gamdom-card border-gamdom-border text-gamdom-text hover:text-white hover:border-gamdom-gold/30'
              }`}
            >
              <MessageSquare size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Deposit Cashier Modal */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
      />
    </>
  )
}
