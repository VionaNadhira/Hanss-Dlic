import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export interface GameHistoryItem {
  id: string
  game: 'dice' | 'mines' | 'crash' | 'blackjack'
  bet: number
  payout: number
  multiplier: number
  outcome: 'win' | 'lose' | 'push'
  timestamp: number
}

export interface UserAccount {
  username: string
  passwordHash: string
  salt: string
  balance: number
  createdAt: number
  lastLogin: number
  lastFaucetClaim?: number
  history: GameHistoryItem[]
}

function getAuthHeaders() {
  // Prefer Pinata API keys (client-prefixed) but fallback to generic env vars for server runtime
  const apiKey = process.env.VITE_PINATA_API_KEY || process.env.PINATA_API_KEY
  const secretKey = process.env.VITE_PINATA_SECRET_KEY || process.env.PINATA_SECRET_KEY
  if (apiKey && secretKey) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    }
  }
  const jwt = process.env.PINATA_JWT
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

const DB_METADATA_NAME = 'dlicom-users-db'
const LOCAL_DB_PATH = path.join(process.cwd(), '.users-db.json')

export function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex')
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function getAllUsers(): Promise<UserAccount[]> {
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

export async function saveAllUsers(users: UserAccount[]): Promise<boolean> {
  try { fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(users)) } catch {}
  const authHeaders = getAuthHeaders()
  // If no auth headers, skip Pinata upload (fallback to local DB)
  if (Object.keys(authHeaders).length === 0) {
    return true
  }
  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeaders as Record<string, string>),
        },
        body: JSON.stringify({
          pinataContent: users,
          pinataMetadata: { name: DB_METADATA_NAME },
        }),
      })
    // ignore response status, assume success
    return true
  } catch {
    return true
  }
}
