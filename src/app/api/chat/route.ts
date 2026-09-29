import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  getChatMessagesDb,
  saveChatMessageDb,
  ChatMessage,
  ChatReplyTo,
} from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

// Short in-memory cache for ultra-fast polling
let chatMemoryCache: ChatMessage[] | null = null
let lastChatFetchTime = 0
const CHAT_CACHE_TTL_MS = 2000 // 2 seconds

async function getChatMessages(): Promise<ChatMessage[]> {
  const now = Date.now()
  if (chatMemoryCache !== null && now - lastChatFetchTime < CHAT_CACHE_TTL_MS) {
    return chatMemoryCache
  }

  try {
    const messages = await getChatMessagesDb(50)
    chatMemoryCache = messages
    lastChatFetchTime = now
    return messages
  } catch (err) {
    console.error('[getChatMessages] DB error:', err)
    return chatMemoryCache || []
  }
}

export async function GET() {
  const messages = await getChatMessages()
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const username = req.cookies.get('dlicom_user')?.value
  if (!username) {
    return NextResponse.json({ error: 'Please login to chat' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if (!rawMessage) {
      return NextResponse.json({ error: 'Message is empty' }, { status: 400 })
    }
    if (rawMessage.length > 200) {
      return NextResponse.json({ error: 'Message too long (max 200)' }, { status: 400 })
    }

    const messages = await getChatMessages()

    // Resolve reply target from the stored message
    let replyTo: ChatReplyTo | undefined
    const replyToId = typeof body.replyToId === 'string' ? body.replyToId : ''
    if (replyToId) {
      const target = messages.find((m) => m.id === replyToId)
      if (target) replyTo = { id: target.id, user: target.user }
    }

    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const newMsg: ChatMessage = {
      id: crypto.randomBytes(8).toString('hex'),
      user: username,
      message: rawMessage,
      time: timeStr,
      timestamp: Date.now(),
      ...(replyTo ? { replyTo } : {}),
    }

    // Save to PostgreSQL
    await saveChatMessageDb(newMsg)

    // Update memory cache
    chatMemoryCache = [...(chatMemoryCache || []), newMsg].slice(-50)
    lastChatFetchTime = Date.now()

    return NextResponse.json({ success: true, message: newMsg })
  } catch (err) {
    console.error('[POST /api/chat] error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
