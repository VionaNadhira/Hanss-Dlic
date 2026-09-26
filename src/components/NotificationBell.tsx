'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, Trash2, AtSign, CornerUpLeft, Gift, X } from 'lucide-react'
import { useNotifications, type AppNotification } from '@/context/NotificationContext'
import { useAuth } from '@/context/AuthContext'

interface NotificationBellProps {
  onJumpToMessage: (messageId: string) => void
}

function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const ICONS: Record<AppNotification['kind'], React.ElementType> = {
  mention: AtSign,
  reply: CornerUpLeft,
  faucet: Gift,
}

const TINTS: Record<AppNotification['kind'], string> = {
  mention: 'text-gamdom-green bg-gamdom-green/15 border-gamdom-green/30',
  reply: 'text-gamdom-blue bg-gamdom-blue/15 border-gamdom-blue/30',
  faucet: 'text-gamdom-gold bg-gamdom-gold/15 border-gamdom-gold/30',
}

export default function NotificationBell({ onJumpToMessage }: NotificationBellProps) {
  const { user } = useAuth()
  const { notifications, unreadCount, markAllRead, clearAll, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSubmenu(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSubmenu(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const handleClick = (n: AppNotification) => {
    markRead(n.id)
    setOpen(false)
    setSubmenu(false)
    if (n.messageId) onJumpToMessage(n.messageId)
  }

  const Icon = open ? X : Bell

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v)
          setSubmenu(false)
        }}
        title="Notifications"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        className="relative w-11 h-11 rounded-xl border border-gamdom-border bg-gamdom-card text-gamdom-text hover:text-white hover:border-gamdom-green/40 transition"
      >
        <Icon size={18} className="absolute inset-0 m-auto" />
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gamdom-red border-2 border-gamdom-header text-white text-[10px] font-black flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-gamdom-red animate-ping opacity-70" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-gamdom-card border border-gamdom-border rounded-2xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gamdom-border bg-gamdom-header">
            <div className="flex items-center gap-2 min-w-0">
              <Bell size={14} className="text-gamdom-green shrink-0" />
              <span className="text-xs font-black text-white uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-white bg-gamdom-red px-1.5 py-px rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="relative shrink-0">
              <button
                onClick={() => setSubmenu((v) => !v)}
                title="More"
                className="w-6 h-6 rounded-md text-gamdom-text hover:text-white hover:bg-gamdom-border/50 transition text-sm font-black leading-none"
              >
                ⋯
              </button>
              {submenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-gamdom-header border border-gamdom-border rounded-xl overflow-hidden shadow-xl z-50">
                  <button
                    onClick={() => {
                      markAllRead()
                      setSubmenu(false)
                    }}
                    disabled={unreadCount === 0}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gamdom-text hover:text-white hover:bg-gamdom-border/40 transition disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <CheckCheck size={13} /> Mark all as read
                  </button>
                  <button
                    onClick={() => {
                      clearAll()
                      setSubmenu(false)
                    }}
                    disabled={notifications.length === 0}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gamdom-red hover:bg-gamdom-red/10 transition disabled:opacity-40"
                  >
                    <Trash2 size={13} /> Delete all
                  </button>
                </div>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-1.5">
              <Bell size={20} className="mx-auto opacity-30" />
              <p className="text-xs font-bold text-gamdom-text">No notifications</p>
              <p className="text-[11px] text-gamdom-textDim">Mentions, replies and faucet claims show up here.</p>
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.map((n) => {
                const NIcon = ICONS[n.kind]
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-3.5 py-2.5 border-b border-gamdom-border/50 flex gap-2.5 transition hover:bg-gamdom-border/25 ${
                      n.read ? 'opacity-60' : 'bg-gamdom-green/[0.04]'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${TINTS[n.kind]}`}
                    >
                      <NIcon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-gamdom-text leading-snug break-words">
                        {n.kind === 'faucet' ? (
                          <>
                            Hey {user.username}, you claimed{' '}
                            <span className="font-bold text-gamdom-gold">
                              ${(n.amount ?? 0).toFixed(2)}
                            </span>{' '}
                            from the faucet
                          </>
                        ) : (
                          n.text
                        )}
                      </p>
                      <span className="text-[10px] text-gamdom-textDim">{timeAgo(n.createdAt)}</span>
                    </div>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-gamdom-red shrink-0 mt-1.5" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
