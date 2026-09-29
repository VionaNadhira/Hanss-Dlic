'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

interface BalanceContextType {
  balance: number
  addBalance: (amount: number) => void
  deductBalance: (amount: number) => boolean
  resetBalance: () => void
  refreshBalance: () => Promise<void>
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined)

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, updateUserBalance } = useAuth()
  const [balance, setBalance] = useState<number>(0)

  // Sync balance from auth user whenever it changes
  useEffect(() => {
    if (loading) return
    if (user) {
      setBalance(user.balance)
    } else {
      setBalance(0)
    }
  }, [user, loading])

  // Refresh balance from server (authoritative DB value)
  const refreshBalance = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        if (typeof data.balance === 'number') {
          setBalance(data.balance)
          updateUserBalance(data.balance)
        }
      }
    } catch {}
  }, [user, updateUserBalance])

  /**
   * Optimistic local deduction (for immediate UI feedback after bet).
   * The real deduction happens server-side in /api/bets.
   */
  const addBalance = (amount: number) => {
    if (amount <= 0) return
    setBalance((prev) => {
      const next = +(prev + amount).toFixed(2)
      updateUserBalance(next)
      return next
    })
  }

  const deductBalance = (amount: number): boolean => {
    if (amount <= 0) return true
    if (balance < amount) return false
    setBalance((prev) => {
      const next = +(prev - amount).toFixed(2)
      updateUserBalance(next)
      return next
    })
    return true
  }

  const resetBalance = () => {
    setBalance(0)
    updateUserBalance(0)
  }

  return (
    <BalanceContext.Provider value={{ balance, addBalance, deductBalance, resetBalance, refreshBalance }}>
      {children}
    </BalanceContext.Provider>
  )
}

export function useBalance() {
  const context = useContext(BalanceContext)
  if (!context) throw new Error('useBalance must be used within a BalanceProvider')
  return context
}
