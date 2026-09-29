import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/pinataDb'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const username = req.cookies.get('dlicom_user')?.value
    if (!username) {
      return NextResponse.json({ user: null })
    }

    const users = await getAllUsers()
    const user = users.find((u) => u.username === username.toLowerCase())

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        username: user.username,
        balance: user.balance,
        history: user.history ?? [],
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
