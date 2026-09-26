'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthContext'

export interface ChatMessage {
  id: string
  user: string
  message: string
  time: string
  timestamp?: number
  replyTo?: { id: string; user: string }
}

export type NotificationKind = 'mention' | 'reply' | 'faucet'

export interface AppNotification {
  id: string
  kind: NotificationKind
  text: string
  createdAt: number
  read: boolean
  /** chat message to jump to; absent for faucet notifications */
  messageId?: string
  fromUser?: string
  amount?: number
}

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void
  markAllRead: () => void
  clearAll: () => void
  markRead: (id: string) => void
  /** shared chat feed, polled here so notifications work while the chat is closed */
  messages: ChatMessage[]
  refreshMessages: () => Promise<void>
  appendMessage: (m: ChatMessage) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const POLL_MS = 4000
const MAX_MESSAGES = 50
const MAX_NOTIFICATIONS = 30

const MENTION_RE = /@([A-Za-z0-9_.-]{1,30})/g

function mentionsUser(text: string, username: string) {
  MENTION_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m[1].toLowerCase() === username.toLowerCase()) return true
  }
  return false
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  // First successful load needs no notification burst for pre-existing history.
  const primedRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())

  const storageKey = user ? `dlicom_notif_${user.username}` : null

  useEffect(() => {
    if (loading) return
    setNotifications([])
    primedRef.current = false
    seenIdsRef.current = new Set()
    if (!user) {
      setMessages([])
      return
    }
    try {
      const raw = window.localStorage.getItem(`dlicom_notif_${user.username}`)
      const parsed = raw ? JSON.parse(raw) : []
      setNotifications(Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [])
    } catch {
      setNotifications([])
    }
  }, [user, loading])

  useEffect(() => {
    if (!storageKey) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(notifications))
    } catch {}
  }, [notifications, storageKey])

  const addNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
      setNotifications((prev) => {
        // One notification per chat message, even if it both mentions and replies.
        if (n.messageId && prev.some((x) => x.messageId === n.messageId)) return prev
        const entry: AppNotification = {
          ...n,
          id: `${n.kind}-${n.messageId ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          read: false,
        }
        return [entry, ...prev].slice(0, MAX_NOTIFICATIONS)
      })
    },
    []
  )

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const isFetchingRef = useRef(false)

  const refreshMessages = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data.messages)) return
      const incoming: ChatMessage[] = data.messages

      setMessages(incoming)

      if (!user) {
        seenIdsRef.current = new Set(incoming.map((m) => m.id))
        primedRef.current = true
        return
      }

      if (!primedRef.current) {
        // Adopt existing history silently on first load.
        seenIdsRef.current = new Set(incoming.map((m) => m.id))
        primedRef.current = true
        return
      }

      const fresh = incoming.filter((m) => !seenIdsRef.current.has(m.id))
      seenIdsRef.current = new Set(incoming.map((m) => m.id))

      for (const m of fresh) {
        if (m.user === user.username) continue
        const isReply = m.replyTo?.user?.toLowerCase() === user.username.toLowerCase()
        const isMention = mentionsUser(m.message, user.username)
        if (!isReply && !isMention) continue
        const verb = isReply ? 'replied to' : 'tagged you at'
        addNotification({
          kind: isReply ? 'reply' : 'mention',
          text: `Hey ${user.username}, ${m.user} ${verb} chat, check it out`,
          messageId: m.id,
          fromUser: m.user,
        })
      }
    } catch {} finally {
      isFetchingRef.current = false
    }
  }, [user, addNotification])

  const appendMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev
      return [...prev, m].slice(-MAX_MESSAGES)
    })
    if (user) seenIdsRef.current.add(m.id)
  }, [user])

  useEffect(() => {
    if (loading) return
    refreshMessages()
    const id = setInterval(refreshMessages, POLL_MS)
    return () => clearInterval(id)
  }, [loading, refreshMessages])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      addNotification,
      markAllRead,
      clearAll,
      markRead,
      messages,
      refreshMessages,
      appendMessage,
    }),
    [notifications, addNotification, markAllRead, clearAll, markRead, messages, refreshMessages, appendMessage]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider')
  return ctx
}
