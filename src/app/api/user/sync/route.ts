import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveAllUsers } from '@/lib/pinataDb'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/sync
 * Syncs balance to Pinata and returns the current balance.
 */
export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { balance } = await req.json().catch(() => ({}))

    const users = await getAllUsers()
    const user = users.find((u) => u.username === username.toLowerCase())
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If balance provided by client, update it
    if (typeof balance === 'number' && isFinite(balance) && balance >= 0) {
      user.balance = balance
      await saveAllUsers(users)
    }

    return NextResponse.json({ success: true, balance: user.balance })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
