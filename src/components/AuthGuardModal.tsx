'use client'

import React from 'react'
import Link from 'next/link'
import { Lock, LogIn, UserPlus } from 'lucide-react'

export default function AuthGuardModal({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-gamdom-card border border-gamdom-border rounded-2xl p-6 shadow-2xl space-y-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gamdom-green/15 border border-gamdom-green/30 flex items-center justify-center mx-auto text-gamdom-green">
          <Lock size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">LOGIN REQUIRED</h2>
          <p className="text-xs text-gamdom-text mt-1.5">You must have an account to play and claim faucet.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Link
            href="/login"
            className="py-3 bg-gamdom-dark border border-gamdom-border hover:border-gamdom-green/50 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
          >
            <LogIn size={13} /> Sign In
          </Link>
          <Link
            href="/register"
            className="py-3 bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-gamdom-green"
          >
            <UserPlus size={13} /> Register
          </Link>
        </div>
      </div>
    </div>
  )
}
