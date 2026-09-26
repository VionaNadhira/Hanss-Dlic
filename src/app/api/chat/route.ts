import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const DB_METADATA_NAME = 'dlicom-chat'
const LOCAL_DB_PATH = path.join(process.cwd(), '.chat-db.json')

function getAuthHeaders() {
  const apiKey = process.env.VITE_PINATA_API_KEY
  const secretKey = process.env.VITE_PINATA_SECRET_KEY
  if (apiKey && secretKey) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    }
  }
  const jwt = process.env.PINATA_JWT
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

export interface ChatReplyTo {
  id: string
  user: string
}

export interface ChatMessage {
  id: string
  user: string
  message: string
  time: string
  timestamp: number
  replyTo?: ChatReplyTo
}

async function getChatMessages(): Promise<ChatMessage[]> {
  const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'
  try {
    const authHeaders = getAuthHeaders()
    const listRes = await fetch(
      `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${DB_METADATA_NAME}&pageLimit=5`,
      { headers: authHeaders as HeadersInit, cache: 'no-store' }
    )
    if (!listRes.ok) throw new Error('pinList failed')
    const listData = await listRes.json()
    if (!listData.rows?.length) throw new Error('no rows')
    const sorted = [...listData.rows].sort((a: { date_pinned: string }, b: { date_pinned: string }) => new Date(b.date_pinned).getTime() - new Date(a.date_pinned).getTime())
    for (const row of sorted) {
      const ipfsHash = row.ipfs_pin_hash
      const ipfsRes = await fetch(`${gateway}/ipfs/${ipfsHash}`, { cache: 'no-store' })
      if (ipfsRes.ok) {
        const data = await ipfsRes.json()
        if (Array.isArray(data)) {
          try { fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data)) } catch {}
          return data
        }
      }
    }
    throw new Error('no valid pin')
  } catch {
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
    return []
  }
}

async function saveChatMessages(messages: ChatMessage[]): Promise<void> {
  try { fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(messages)) } catch {}
  const authHeaders = getAuthHeaders()
  try {
    await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeaders as Record<string, string>),
      },
      body: JSON.stringify({
        pinataContent: messages,
        pinataMetadata: { name: DB_METADATA_NAME },
      }),
    })
  } catch {}
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

    // Resolve reply target from the stored message rather than trusting the client,
    // so a client cannot fake the author of the message being replied to.
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

    const updated = [...messages, newMsg].slice(-50)
    await saveChatMessages(updated)

    return NextResponse.json({ success: true, message: newMsg })
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
