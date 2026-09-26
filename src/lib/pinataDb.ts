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

const DB_METADATA_NAME = 'dlicom-users-db'
const LOCAL_DB_PATH = path.join(process.cwd(), '.users-db.json')
const TMP_DB_PATH = path.join('/tmp', '.users-db.json')

function readLocalUsers(): UserAccount[] | null {
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

function writeLocalUsers(users: UserAccount[]) {
  for (const p of [LOCAL_DB_PATH, TMP_DB_PATH]) {
    try {
      fs.writeFileSync(p, JSON.stringify(users))
    } catch {}
  }
}

export function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex')
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

// In-memory cache with TTL
let memoryCache: UserAccount[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 20000 // 20 seconds

// Background cleanup helper (non-blocking, parallel)
async function cleanupOldPins(authHeaders: Record<string, string>) {
  try {
    const listRes = await fetch(
      `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${DB_METADATA_NAME}&pageLimit=10&sortBy=date_pinned&sortOrder=DESC`,
      { headers: authHeaders as HeadersInit, cache: 'no-store', signal: AbortSignal.timeout(5000) }
    )
    if (listRes.ok) {
      const listData = await listRes.json()
      if (listData.rows?.length > 2) {
        // Keep the 2 most recent, unpin the rest (up to 5) in parallel
        const toDelete = listData.rows.slice(2, 7)
        await Promise.allSettled(
          toDelete.map((pin: { ipfs_pin_hash: string }) =>
            fetch(`https://api.pinata.cloud/pinning/unpin/${pin.ipfs_pin_hash}`, {
              method: 'DELETE',
              headers: authHeaders,
            })
          )
        )
      }
    }
  } catch {}
}

export async function getAllUsers(): Promise<UserAccount[]> {
  const now = Date.now()
  // Return memory cache if fresh
  if (memoryCache !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return memoryCache
  }

  // Check local file if memory cache is empty
  if (memoryCache === null) {
    const local = readLocalUsers()
    if (local && local.length > 0) {
      memoryCache = local
      cacheTimestamp = now
    }
  }

  const authHeaders = getAuthHeaders()
  if (Object.keys(authHeaders).length === 0) {
    return memoryCache ?? readLocalUsers() ?? []
  }

  const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'

  try {
    const listRes = await fetch(
      `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${DB_METADATA_NAME}&pageLimit=1&sortBy=date_pinned&sortOrder=DESC`,
      { headers: authHeaders as HeadersInit, cache: 'no-store', signal: AbortSignal.timeout(4000) }
    )
    if (!listRes.ok) throw new Error('pinList failed')
    const listData = await listRes.json()
    if (!listData.rows?.length) {
      if (!memoryCache) memoryCache = readLocalUsers() ?? []
      return memoryCache
    }

    const ipfsHash = listData.rows[0].ipfs_pin_hash
    const ipfsRes = await fetch(`${gateway}/ipfs/${ipfsHash}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    if (!ipfsRes.ok) throw new Error('IPFS fetch failed')
    const data = await ipfsRes.json()
    if (Array.isArray(data)) {
      memoryCache = data
      cacheTimestamp = Date.now()
      writeLocalUsers(data)
      return data
    }
  } catch {
    // If remote fails or times out, fallback to memory cache or local file
  }

  return memoryCache ?? readLocalUsers() ?? []
}

export async function saveAllUsers(users: UserAccount[]): Promise<boolean> {
  // Update memory cache and local file immediately for 0ms local read consistency
  memoryCache = users
  cacheTimestamp = Date.now()
  writeLocalUsers(users)

  const authHeaders = getAuthHeaders()
  if (Object.keys(authHeaders).length === 0) {
    return true
  }

  try {
    const uploadRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        pinataContent: users,
        pinataMetadata: { name: DB_METADATA_NAME },
      }),
      signal: AbortSignal.timeout(6000),
    })

    if (uploadRes.ok) {
      // Clean up old pins asynchronously in the background — never block response
      cleanupOldPins(authHeaders).catch(() => {})
      return true
    }
    return false
  } catch {
    return true // Local cache is already updated
  }
}
