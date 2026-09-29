import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const username = req.cookies.get('dlicom_user')?.value
    if (!username) {
      return NextResponse.json({ user: null })
    }

    const user = await getUserByUsername(username)
    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        username: user.username,
        balance: user.balance,
        history: [],
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
