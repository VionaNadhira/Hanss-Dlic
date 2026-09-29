import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername, setUserBalance } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/sync
 * Syncs balance to Postgres and returns the current balance.
 */
export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { balance } = await req.json().catch(() => ({}))

    const user = await getUserByUsername(username)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let currentBalance = user.balance
    // If balance provided by client, update it
    if (typeof balance === 'number' && isFinite(balance) && balance >= 0) {
      const updated = await setUserBalance(username, balance)
      if (updated.success && updated.balance !== undefined) {
        currentBalance = updated.balance
      }
    }

    return NextResponse.json({ success: true, balance: currentBalance })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
