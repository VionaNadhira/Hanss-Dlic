import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername, claimFaucetAtomic } from '@/lib/db/queries'

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
    const user = await getUserByUsername(username)
    if (!user) {
      return NextResponse.json({ canClaim: false, remainingMs: 0, requiresLogin: true }, { status: 401 })
    }

    const lastClaim = user.lastFaucetAt ? new Date(user.lastFaucetAt).getTime() : 0
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
    const result = await claimFaucetAtomic(username, FAUCET_AMOUNT, COOLDOWN_MS)
    if (result.success === false) {
      const status = result.error === 'User not found' ? 404 : 429
      return NextResponse.json(result, { status })
    }

    return NextResponse.json({
      success: true,
      amount: FAUCET_AMOUNT,
      newBalance: result.newBalance,
      nextClaimMs: result.nextClaimMs,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Faucet claim failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
