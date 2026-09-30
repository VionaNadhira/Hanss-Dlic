'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { X, Send, MessageSquare, LogIn, CornerUpLeft, AtSign, Smile } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'

interface ChatReplyTo {
  id: string
  user: string
}

interface ChatMessage {
  id: string
  user: string
  message: string
  time: string
  timestamp?: number
  replyTo?: ChatReplyTo
  avatarUrl?: string
}

const MENTION_RE = /@([A-Za-z0-9_.-]{1,30})/g

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Split a message into plain text and @mention spans so mentions can be styled.
function renderMessage(text: string, selfName?: string) {
  if (/^https?:\/\/.*\.(gif|webp|png|jpe?g)($|\?)/i.test(text.trim()) || /^https?:\/\/(media\.giphy\.com|.*klipy\.co)\/.*/i.test(text.trim())) {
    return (
        <img
          src={text.trim()}
          alt="GIF"
          className="rounded-lg max-h-40 max-w-full mt-1 object-contain border border-gamdom-border"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.src = 'https://via.placeholder.com/150?text=GIF+not+found';
          }}
        />
    )
  }
  const out: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const name = match[1]
    const isSelf = selfName && name.toLowerCase() === selfName.toLowerCase()
    out.push(
      <span
        key={`${match.index}-${name}`}
        className={`font-bold ${isSelf ? 'text-gamdom-gold' : 'text-gamdom-green'}`}
      >
        @{name}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

interface LiveChatProps {
  isOpen: boolean
  onClose: () => void
  /** message to scroll to and highlight, set from a notification click */
  highlightMessageId?: string | null
  onHighlightHandled?: () => void
}

export default function LiveChat({
  isOpen,
  onClose,
  highlightMessageId,
  onHighlightHandled,
}: LiveChatProps) {
  const { user } = useAuth()
  const { messages, appendMessage } = useNotifications()
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifResults, setGifResults] = useState<{ id: string; title: string; url: string }[]>([])
  // index into `mentionMatches` for keyboard navigation
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Unique usernames currently in the loaded history, most recent first.
  const knownUsers = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (let i = messages.length - 1; i >= 0; i--) {
      const u = messages[i].user
      const k = u.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(u)
    }
    return out
  }, [messages])

  // Active @query under the caret, or null when the caret is not inside a mention.
  const mentionQuery = useMemo(() => {
    const el = inputRef.current
    const caret = el ? el.selectionStart ?? inputValue.length : inputValue.length
    const before = inputValue.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at === -1) return null
    const fragment = before.slice(at + 1)
    if (!/^[A-Za-z0-9_.-]*$/.test(fragment)) return null
    // Don't treat an email-like fragment as a mention
    if (at > 0 && /[A-Za-z0-9_.-]/.test(before[at - 1])) return null
    return { query: fragment, start: at }
  }, [inputValue])

  const mentionMatches = useMemo(() => {
    if (!mentionQuery) return []
    const q = mentionQuery.query.toLowerCase()
    return knownUsers
      .filter((u) => u.toLowerCase().startsWith(q) && u.toLowerCase() !== user?.username?.toLowerCase())
      .slice(0, 6)
  }, [mentionQuery, knownUsers, user])

  useEffect(() => {
    setMentionIndex(0)
  }, [mentionQuery?.query])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  // Jump to the message a notification pointed at, then flash it.
  useEffect(() => {
    if (!highlightMessageId) return
    const el = document.querySelector(`[data-msg-id="${highlightMessageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(highlightMessageId)
      const t = setTimeout(() => setHighlightId(null), 2600)
      onHighlightHandled?.()
      return () => clearTimeout(t)
    }
    // Message not in the loaded window yet; retry once after a fetch.
    const t = setTimeout(() => {
      const retry = document.querySelector(`[data-msg-id="${highlightMessageId}"]`)
      if (retry) {
        retry.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightId(highlightMessageId)
        setTimeout(() => setHighlightId(null), 2600)
        onHighlightHandled?.()
      }
    }, 900)
    onHighlightHandled?.()
    return () => clearTimeout(t)
  }, [highlightMessageId, messages, onHighlightHandled])

  // Close the reply preview if that message scrolls out of the loaded history
  useEffect(() => {
    if (replyTo && !messages.some((m) => m.id === replyTo.id)) {
      setReplyTo(null)
    }
  }, [messages, replyTo])

  // Escape clears the pending reply
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReplyTo(null)
        setMentionOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const startReply = (m: ChatMessage) => {
    if (!user) return
    setReplyTo(m)
    setMentionOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const applyMention = (name: string) => {
    const el = inputRef.current
    const caret = el ? el.selectionStart ?? inputValue.length : inputValue.length
    const at = mentionQuery ? mentionQuery.start : caret - 1
    const before = inputValue.slice(0, at)
    const after = inputValue.slice(caret)
    const insert = `@${name} `
    setInputValue(before + insert + after)
    setMentionOpen(false)
    requestAnimationFrame(() => {
      const next = inputRef.current
      if (!next) return
      const pos = (before + insert).length
      next.focus()
      next.setSelectionRange(pos, pos)
    })
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const showMenu = mentionOpen && mentionMatches.length > 0
    if (showMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % mentionMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applyMention(mentionMatches[mentionIndex])
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ;(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !inputValue.trim() || sending) return

    setSending(true)
    const text = inputValue.trim()
    const replyToId = replyTo?.id
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, replyToId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.message) {
          appendMessage(data.message)
        }
        setInputValue('')
        setReplyTo(null)
        setMentionOpen(false)
      }
    } catch {}
    setSending(false)
  }

  if (!isOpen) return null

  const showMentionMenu = mentionOpen && mentionMatches.length > 0

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 lg:static lg:h-[calc(100vh-64px)] bg-gamdom-sidebar border-l border-gamdom-border flex flex-col justify-between shrink-0 select-none transition-all duration-300 shadow-2xl lg:shadow-none">
      {/* Chat Header */}
      <div className="p-3.5 border-b border-gamdom-border bg-gamdom-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-gamdom-green" />
          <span className="text-xs font-black text-white uppercase tracking-wider">Live Chat</span>
        </div>
        <button
          onClick={onClose}
          className="text-gamdom-text hover:text-white transition p-1 rounded-lg hover:bg-gamdom-dark"
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages Stream */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gamdom-textDim space-y-2">
            <MessageSquare size={24} className="opacity-40" />
            <p className="text-xs font-bold text-gamdom-text">No messages yet</p>
            <p className="text-[11px]">Be the first real player to say hello!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = user?.username === m.user
            const mentionsMe =
              !!user &&
              new RegExp(`@${escapeRegExp(user.username)}\\b`, 'i').test(m.message)
            return (
              <div
                key={m.id}
                data-msg-id={m.id}
                onClick={() => startReply(m)}
                title={user ? 'Click to reply' : 'Log in to reply'}
                className={`border rounded-xl p-2.5 transition cursor-pointer ${
                  highlightId === m.id
                    ? 'bg-gamdom-gold/20 border-gamdom-gold ring-2 ring-gamdom-gold/60'
                    : isMe
                      ? 'bg-gamdom-green/10 border-gamdom-green/30'
                      : mentionsMe
                        ? 'bg-gamdom-gold/10 border-gamdom-gold/40'
                        : 'bg-gamdom-card/70 border-gamdom-border/40'
                } hover:border-gamdom-green/50`}
              >
                {m.replyTo && (
                  <div className="flex items-center gap-1 mb-1.5 pl-1.5 border-l-2 border-gamdom-green/50">
                    <CornerUpLeft size={10} className="text-gamdom-green shrink-0" />
                    <span className="text-[10px] text-gamdom-textDim truncate">
                      <span className="font-bold text-gamdom-green">@{m.replyTo.user}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-gamdom-dark border border-gamdom-border flex items-center justify-center text-[9px] font-black text-gamdom-green uppercase">
                      {m.user[0]}
                    </div>
                    <span
                      className={`font-bold text-xs ${
                        isMe ? 'text-gamdom-green' : 'text-white'
                      }`}
                    >
                      {m.user}
                    </span>
                    {mentionsMe && (
                      <span className="text-[9px] font-black uppercase text-gamdom-gold bg-gamdom-gold/10 border border-gamdom-gold/40 px-1 py-px rounded">
                        @you
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gamdom-textDim">{m.time}</span>
                </div>
                <p className="text-gamdom-text break-words leading-relaxed text-[12px]">
                  {renderMessage(m.message, user?.username)}
                </p>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input or Login Banner */}
      <div className="p-3 border-t border-gamdom-border bg-gamdom-header">
        {user ? (
          <div className="space-y-2">
            {replyTo && (
              <div className="flex items-center justify-between gap-2 bg-gamdom-dark border border-gamdom-green/30 rounded-lg pl-2.5 pr-1.5 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CornerUpLeft size={11} className="text-gamdom-green shrink-0" />
                  <span className="text-[10px] text-gamdom-textDim truncate">
                    Replying to{' '}
                    <span className="font-bold text-gamdom-green">@{replyTo.user}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  title="Cancel reply"
                  className="p-1 rounded-md text-gamdom-textDim hover:text-white hover:bg-gamdom-border/50 transition shrink-0"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                maxLength={200}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  setMentionOpen(true)
                }}
                onKeyDown={handleInputKeyDown}
                onBlur={() => setTimeout(() => setMentionOpen(false), 120)}
                placeholder="Type your message... @ to mention"
                disabled={sending}
                className="w-full bg-gamdom-input border border-gamdom-border rounded-xl py-2 pl-3 pr-20 text-xs text-white placeholder:text-gamdom-textDim focus:outline-none focus:border-gamdom-green transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={async () => {
                  setShowGifPicker(!showGifPicker)
                  if (!showGifPicker) {
                    try {
                      const res = await fetch('/api/klipy?type=gifs&q=fun')
                      const data = await res.json()
                      setGifResults(data.results || [])
                    } catch {}
                  }
                }}
                className="absolute right-12 p-1.5 bg-gamdom-card hover:bg-gamdom-cardHover text-gamdom-text hover:text-white rounded-lg transition"
              >
                <Smile size={13} />
              </button>
              <button
                type="submit"
                disabled={sending || !inputValue.trim()}
                className="absolute right-1.5 p-1.5 bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black rounded-lg transition disabled:opacity-40"
              >
                <Send size={13} />
              </button>
              {showGifPicker && (
                <div className="absolute bottom-full left-0 mb-2 max-h-64 w-64 overflow-y-auto bg-gamdom-card border border-gamdom-border rounded-lg p-2 shadow-lg">
                  <div className="grid grid-cols-2 gap-2">
                    {gifResults.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => {
                          setInputValue((prev) => `${prev} ${gif.url}`)
                          setShowGifPicker(false)
                        }}
                        className="p-1"
                      >
                        <img src={gif.url} alt={gif.title} className="w-full h-20 object-cover rounded" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showMentionMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-gamdom-card border border-gamdom-border rounded-xl overflow-hidden shadow-xl z-50">
                  {mentionMatches.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        applyMention(name)
                      }}
                      onMouseEnter={() => setMentionIndex(i)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition ${
                        i === mentionIndex
                          ? 'bg-gamdom-green/15'
                          : 'hover:bg-gamdom-border/40'
                      }`}
                    >
                      <div className="w-4 h-4 rounded bg-gamdom-dark border border-gamdom-border flex items-center justify-center text-[9px] font-black text-gamdom-green uppercase shrink-0">
                        {name[0]}
                      </div>
                      <span className="text-xs font-bold text-white truncate">{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>
            <div className="flex items-center justify-between text-[10px] text-gamdom-textDim">
              <span className="flex items-center gap-1">
                <AtSign size={9} /> @ mention · click a message to reply
              </span>
              <span className={inputValue.length > 180 ? 'text-gamdom-gold font-bold' : ''}>
                {inputValue.length}/200
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2 space-y-1.5">
            <p className="text-[11px] text-gamdom-text">You must be logged in to chat.</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black rounded-lg text-xs uppercase tracking-wider transition"
            >
              <LogIn size={13} /> Login to Chat
            </Link>
          </div>
        )}
      </div>
    </aside>
    </>
  )
}
