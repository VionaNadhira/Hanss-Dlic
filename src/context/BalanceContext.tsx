'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

interface BalanceContextType {
  balance: number
  addBalance: (amount: number) => void
  deductBalance: (amount: number) => boolean
  resetBalance: () => void
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined)

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, updateUserBalance } = useAuth()
  const [balance, setBalance] = useState<number>(0)

  useEffect(() => {
    if (loading) return
    if (user) {
      setBalance(user.balance)
    } else {
      setBalance(0)
    }
  }, [user, loading])

  const syncToServer = async (newBal: number, historyItem?: unknown) => {
    if (!user) return
    try {
      await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBal, newHistoryItem: historyItem }),
      })
    } catch {}
  }

  const addBalance = (amount: number) => {
    if (amount <= 0) return
    setBalance((prev) => {
      const next = +(prev + amount).toFixed(2)
      if (user) {
        updateUserBalance(next)
        syncToServer(next)
      }
      return next
    })
  }

  const deductBalance = (amount: number): boolean => {
    if (amount <= 0) return true
    if (balance < amount) return false
    setBalance((prev) => {
      const next = +(prev - amount).toFixed(2)
      if (user) {
        updateUserBalance(next)
        syncToServer(next)
      }
      return next
    })
    return true
  }

  const resetBalance = () => {
    setBalance(() => {
      const next = 0
      if (user) {
        updateUserBalance(next)
        syncToServer(next)
      }
      return next
    })
  }

  return (
    <BalanceContext.Provider value={{ balance, addBalance, deductBalance, resetBalance }}>
      {children}
    </BalanceContext.Provider>
  )
}

export function useBalance() {
  const context = useContext(BalanceContext)
  if (!context) throw new Error('useBalance must be used within a BalanceProvider')
  return context
}
