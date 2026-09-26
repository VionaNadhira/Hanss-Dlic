import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveAllUsers, GameHistoryItem } from '@/lib/pinataDb'

export async function POST(req: NextRequest) {
  try {
    const username = req.cookies.get('dlicom_user')?.value
    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { balance, newHistoryItem } = body as {
      balance?: number
      newHistoryItem?: GameHistoryItem
    }

    const users = await getAllUsers()
    const user = users.find((u) => u.username === username)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (typeof balance === 'number' && balance >= 0) {
      user.balance = +balance.toFixed(2)
    }

    if (newHistoryItem) {
      if (!user.history) user.history = []
      user.history.unshift(newHistoryItem)
      if (user.history.length > 50) {
        user.history = user.history.slice(0, 50)
      }
    }

    await saveAllUsers(users)
    return NextResponse.json({ success: true, balance: user.balance })
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
