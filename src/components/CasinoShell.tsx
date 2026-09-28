'use client'

import React, { useState, useCallback } from 'react'
import Header from './Header'
import MobileDrawer from './MobileDrawer'
import LiveChat from './LiveChat'
import DepositModal from './DepositModal'

export default function CasinoShell({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)

  // A notification click opens the chat and points it at the target message.
  const jumpToMessage = useCallback((messageId: string) => {
    setHighlightId(messageId)
    setIsChatOpen(true)
  }, [])

  const openDeposit = useCallback(() => setIsDepositOpen(true), [])

  return (
    <div className="min-h-screen bg-gamdom-bg flex flex-col text-gamdom-text">
      {/* Mobile slide-over menu — opened from the header hamburger */}
      <MobileDrawer
        open={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        isChatOpen={isChatOpen}
        onJumpToMessage={jumpToMessage}
        onOpenDeposit={openDeposit}
      />

      {/* Top Gamdom Header */}
      <Header
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        isChatOpen={isChatOpen}
        onJumpToMessage={jumpToMessage}
        onOpenDeposit={openDeposit}
        onToggleNav={() => setIsNavOpen((prev) => !prev)}
        isNavOpen={isNavOpen}
      />

      {/* Main Body with Center Content and Collapsible Chat */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <main className="flex-1 min-w-0 overflow-y-auto bg-gamdom-bg flex flex-col">
          {children}
        </main>
        <LiveChat
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          highlightMessageId={highlightId}
          onHighlightHandled={() => setHighlightId(null)}
        />
      </div>

      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </div>
  )
}
