import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const DB_METADATA_NAME = 'dlicom-chat'
const LOCAL_DB_PATH = path.join(process.cwd(), '.chat-db.json')
const TMP_DB_PATH = path.join('/tmp', '.chat-db.json')

function getAuthHeaders(): Record<string, string> {
  const jwt = process.env.PINATA_JWT
  if (jwt) {
    return { Authorization: `Bearer ${jwt}` }
  }
  const apiKey = process.env.VITE_PINATA_API_KEY || process.env.PINATA_API_KEY
  const secretKey = process.env.VITE_PINATA_SECRET_KEY || process.env.PINATA_SECRET_KEY
  if (apiKey && secretKey) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    }
  }
  return {}
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

// In-memory cache for ultra-fast chat polling
let chatMemoryCache: ChatMessage[] | null = null
let lastChatFetchTime = 0
const CHAT_CACHE_TTL_MS = 3000 // 3 seconds

function readLocalChat(): ChatMessage[] | null {
  for (const p of [LOCAL_DB_PATH, TMP_DB_PATH]) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
  }
  return null
}

function writeLocalChat(messages: ChatMessage[]) {
  for (const p of [LOCAL_DB_PATH, TMP_DB_PATH]) {
    try {
      fs.writeFileSync(p, JSON.stringify(messages))
    } catch {}
  }
}

async function getChatMessages(): Promise<ChatMessage[]> {
  const now = Date.now()
  if (chatMemoryCache !== null && now - lastChatFetchTime < CHAT_CACHE_TTL_MS) {
    return chatMemoryCache
  }

  if (chatMemoryCache === null) {
    const local = readLocalChat()
    if (local && local.length > 0) {
      chatMemoryCache = local
      lastChatFetchTime = now
    }
  }

  const authHeaders = getAuthHeaders()
  if (Object.keys(authHeaders).length === 0) {
    return chatMemoryCache ?? readLocalChat() ?? []
  }

  const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'
  try {
    const listRes = await fetch(
      `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${DB_METADATA_NAME}&pageLimit=1&sortBy=date_pinned&sortOrder=DESC`,
      { headers: authHeaders as HeadersInit, cache: 'no-store', signal: AbortSignal.timeout(3500) }
    )
    if (!listRes.ok) throw new Error('pinList failed')
    const listData = await listRes.json()
    if (!listData.rows?.length) {
      return chatMemoryCache ?? readLocalChat() ?? []
    }

    const ipfsHash = listData.rows[0].ipfs_pin_hash
    const ipfsRes = await fetch(`${gateway}/ipfs/${ipfsHash}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    })
    if (!ipfsRes.ok) throw new Error('ipfs fetch failed')
    const data = await ipfsRes.json()
    if (Array.isArray(data)) {
      chatMemoryCache = data
      lastChatFetchTime = Date.now()
      writeLocalChat(data)
      return data
    }
  } catch {
    // If network fails or times out, return cached
  }

  return chatMemoryCache ?? readLocalChat() ?? []
}

async function saveChatMessages(messages: ChatMessage[]): Promise<void> {
  chatMemoryCache = messages
  lastChatFetchTime = Date.now()
  writeLocalChat(messages)

  const authHeaders = getAuthHeaders()
  if (Object.keys(authHeaders).length === 0) return

  // Asynchronous background upload to Pinata
  fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      pinataContent: messages,
      pinataMetadata: { name: DB_METADATA_NAME },
    }),
    signal: AbortSignal.timeout(6000),
  }).then(async (res) => {
    if (res.ok) {
      // Async clean up older pins
      try {
        const listRes = await fetch(
          `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${DB_METADATA_NAME}&pageLimit=10&sortBy=date_pinned&sortOrder=DESC`,
          { headers: authHeaders as HeadersInit, cache: 'no-store', signal: AbortSignal.timeout(4000) }
        )
        if (listRes.ok) {
          const listData = await listRes.json()
          if (listData.rows?.length > 2) {
            const oldPins = listData.rows.slice(2, 6)
            await Promise.allSettled(
              oldPins.map((p: { ipfs_pin_hash: string }) =>
                fetch(`https://api.pinata.cloud/pinning/unpin/${p.ipfs_pin_hash}`, {
                  method: 'DELETE',
                  headers: authHeaders,
                })
              )
            )
          }
        }
      } catch {}
    }
  }).catch(() => {})
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
