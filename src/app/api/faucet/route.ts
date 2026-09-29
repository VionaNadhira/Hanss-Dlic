import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveAllUsers } from '@/lib/pinataDb'

export const dynamic = 'force-dynamic'

const FAUCET_AMOUNT = Number(process.env.NEXT_PUBLIC_FAUCET_AMOUNT) || 200
const COOLDOWN_HOURS = Number(process.env.FAUCET_COOLDOWN_HOURS) || 1
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ canClaim: false, remainingMs: 0, requiresLogin: true }, { status: 401 })
  }

  try {
    const users = await getAllUsers()
    const user = users.find((u) => u.username === username.toLowerCase())
    if (!user) {
      return NextResponse.json({ canClaim: false, remainingMs: 0, requiresLogin: true }, { status: 401 })
    }

    const lastClaim = user.lastFaucetClaim ?? 0
    const elapsed = Date.now() - lastClaim
    if (elapsed >= COOLDOWN_MS) {
      return NextResponse.json({ canClaim: true, remainingMs: 0, amount: FAUCET_AMOUNT })
    }
    return NextResponse.json({ canClaim: false, remainingMs: COOLDOWN_MS - elapsed, amount: FAUCET_AMOUNT })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ success: false, error: 'Please log in to claim faucet' }, { status: 401 })
  }

  try {
    const users = await getAllUsers()
    const user = users.find((u) => u.username === username.toLowerCase())
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const lastClaim = user.lastFaucetClaim ?? 0
    const elapsed = Date.now() - lastClaim
    if (elapsed < COOLDOWN_MS) {
      return NextResponse.json(
        { success: false, error: 'Faucet cooldown active', remainingMs: COOLDOWN_MS - elapsed },
        { status: 429 }
      )
    }

    user.balance += FAUCET_AMOUNT
    user.lastFaucetClaim = Date.now()
    await saveAllUsers(users)

    return NextResponse.json({
      success: true,
      amount: FAUCET_AMOUNT,
      newBalance: user.balance,
      nextClaimMs: COOLDOWN_MS,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Faucet claim failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
