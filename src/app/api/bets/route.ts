import { NextRequest, NextResponse } from 'next/server'
import { placeMemoryBet } from '@/lib/game/memoryRounds'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ error: 'Please log in to place a bet' }, { status: 401 })
  }

  let body: { roundId?: string; side?: string; amount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { roundId, side, amount } = body

  if (!roundId || typeof roundId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid roundId' }, { status: 400 })
  }

  if (side !== 'up' && side !== 'down') {
    return NextResponse.json({ error: 'Side must be "up" or "down"' }, { status: 400 })
  }

  const amountNum = parseFloat(Number(amount).toFixed(2))
  if (isNaN(amountNum) || amountNum < 0.1) {
    return NextResponse.json({ error: 'Minimum bet amount is $0.10' }, { status: 400 })
  }
  if (amountNum > 10000) {
    return NextResponse.json({ error: 'Maximum bet amount is $10,000' }, { status: 400 })
  }

  try {
    const { bet, newBalance } = await placeMemoryBet(username, roundId, side, amountNum)

    return NextResponse.json({
      success: true,
      bet: {
        id: bet.id,
        roundId: bet.roundId,
        side: bet.side,
        amount: bet.amount.toString(),
        payout: bet.payout ? bet.payout.toString() : null,
        status: bet.status,
      },
      balance: newBalance,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to place bet'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
