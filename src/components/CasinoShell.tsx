'use client'

import React, { useState, useCallback } from 'react'
import Header from './Header'
import LiveChat from './LiveChat'
import NotificationBell from './NotificationBell'

export default function CasinoShell({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // A notification click opens the chat and points it at the target message.
  const jumpToMessage = useCallback((messageId: string) => {
    setHighlightId(messageId)
    setIsChatOpen(true)
  }, [])

  return (
    <div className="min-h-screen bg-gamdom-bg flex flex-col text-gamdom-text">
      {/* Top Gamdom Header */}
      <Header
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        isChatOpen={isChatOpen}
        onJumpToMessage={jumpToMessage}
      />

      {/* Main Body with Center Content and Collapsible Chat */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-gamdom-bg flex flex-col">
          {children}
        </main>
        <LiveChat
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          highlightMessageId={highlightId}
          onHighlightHandled={() => setHighlightId(null)}
        />
      </div>
    </div>
  )
}
