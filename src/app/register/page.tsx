'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, User, Lock, AlertCircle, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await register(username, password)
      setSuccess('Account created successfully! Redirecting...')
      setTimeout(() => router.push('/'), 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Register failed'
      setError(msg)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 lg:p-8 max-w-sm mx-auto w-full flex flex-col items-center">
      <div className="w-full bg-gamdom-card border border-gamdom-border rounded-2xl p-6 shadow-gamdom-card space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gamdom-green/15 border border-gamdom-green/30 flex items-center justify-center mx-auto mb-3">
            <UserPlus size={20} className="text-gamdom-green" />
          </div>
          <h1 className="text-xl font-black text-white tracking-wider">REGISTER</h1>
          <p className="text-xs text-gamdom-text mt-1">Create your Dlicom casino account</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs font-bold text-gamdom-red bg-gamdom-red/10 border border-gamdom-red/30 p-3 rounded-xl">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-xs font-bold text-gamdom-green bg-gamdom-green/15 border border-gamdom-green/40 p-3 rounded-xl animate-pulse">
            <Check size={14} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-black text-gamdom-text uppercase tracking-wider mb-1.5 block">Username</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gamdom-textDim" />
              <input
                required
                minLength={3}
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="min. 3 chars, a-z 0-9 _"
                className="w-full bg-gamdom-input border border-gamdom-border rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-gamdom-textDim focus:outline-none focus:border-gamdom-green transition"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-gamdom-text uppercase tracking-wider mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gamdom-textDim" />
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gamdom-input border border-gamdom-border rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-gamdom-textDim focus:outline-none focus:border-gamdom-green transition"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-gamdom-text uppercase tracking-wider mb-1.5 block">Confirm Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gamdom-textDim" />
              <input
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gamdom-input border border-gamdom-border rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-gamdom-textDim focus:outline-none focus:border-gamdom-green transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gamdom-green hover:bg-gamdom-greenHover text-gamdom-dark font-black rounded-xl text-xs uppercase tracking-wider shadow-gamdom-green hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <UserPlus size={14} /> {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center text-xs text-gamdom-text">
          Already have an account? <Link href="/login" className="text-gamdom-green font-bold hover:underline">Login</Link>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gamdom-textDim justify-center">
          <Check size={12} className="text-gamdom-green" /> Balance $1000 starting credits • Stored via Pinata IPFS
        </div>
      </div>
    </div>
  )
}
