import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveAllUsers } from '@/lib/pinataDb'

const FAUCET_AMOUNT = parseInt(process.env.NEXT_PUBLIC_FAUCET_AMOUNT || '1000', 10)
const COOLDOWN_MS = parseInt(process.env.FAUCET_COOLDOWN_HOURS || '24', 10) * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ canClaim: false, remainingMs: 0, requiresLogin: true }, { status: 401 })
  }
  const users = await getAllUsers()
  const user = users.find((u) => u.username === username)
  if (!user) {
    return NextResponse.json({ canClaim: false, remainingMs: 0, requiresLogin: true }, { status: 401 })
  }
  const elapsed = Date.now() - user.lastLogin
  const lastFaucetClaim = (user as unknown as Record<string, unknown>).lastFaucetClaim as number | undefined
  if (!lastFaucetClaim) {
    return NextResponse.json({ canClaim: true, remainingMs: 0, amount: FAUCET_AMOUNT })
  }
  const remaining = COOLDOWN_MS - (Date.now() - lastFaucetClaim)
  if (remaining <= 0) {
    return NextResponse.json({ canClaim: true, remainingMs: 0, amount: FAUCET_AMOUNT })
  }
  return NextResponse.json({ canClaim: false, remainingMs: remaining, amount: FAUCET_AMOUNT })
}

export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ success: false, error: 'Please login to claim faucet' }, { status: 401 })
  }
  const users = await getAllUsers()
  const user = users.find((u) => u.username === username)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Please login to claim faucet' }, { status: 401 })
  }
  const lastFaucetClaim = (user as unknown as Record<string, unknown>).lastFaucetClaim as number | undefined
  if (lastFaucetClaim) {
    const elapsed = Date.now() - lastFaucetClaim
    if (elapsed < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - elapsed
      return NextResponse.json({ success: false, error: 'Cooldown active', remainingMs: remaining }, { status: 429 })
    }
  }
  ;(user as unknown as Record<string, unknown>).lastFaucetClaim = Date.now()
  user.balance = +(user.balance + FAUCET_AMOUNT).toFixed(2)
  await saveAllUsers(users)

  return NextResponse.json({ success: true, amount: FAUCET_AMOUNT, nextClaimMs: COOLDOWN_MS, newBalance: user.balance })
}
