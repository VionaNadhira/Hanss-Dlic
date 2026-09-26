import crypto from 'crypto'

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

export function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex')
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

// In-memory cache to avoid repeated Pinata fetches within the same serverless invocation
let memoryCache: UserAccount[] | null = null

export async function getAllUsers(): Promise<UserAccount[]> {
  // Return memory cache if available (same serverless invocation)
  if (memoryCache !== null) {
    return memoryCache
  }

  const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'
  const authHeaders = getAuthHeaders()

  if (Object.keys(authHeaders).length === 0) {
    console.error('[pinataDb] No Pinata auth headers configured')
    return []
  }

  try {
    // Fetch pin list - sort by date_pinned descending to get the latest
    const listRes = await fetch(
      `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${DB_METADATA_NAME}&pageLimit=1&sortBy=date_pinned&sortOrder=DESC`,
      { headers: authHeaders as HeadersInit, cache: 'no-store' }
    )
    if (!listRes.ok) {
      const errText = await listRes.text()
      console.error('[pinataDb] pinList failed:', listRes.status, errText)
      throw new Error('pinList failed')
    }
    const listData = await listRes.json()
    if (!listData.rows?.length) {
      console.log('[pinataDb] No pins found, returning empty array')
      memoryCache = []
      return []
    }

    const ipfsHash = listData.rows[0].ipfs_pin_hash
    console.log('[pinataDb] Fetching latest pin:', ipfsHash)

    const ipfsRes = await fetch(`${gateway}/ipfs/${ipfsHash}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })
    if (!ipfsRes.ok) {
      console.error('[pinataDb] IPFS fetch failed:', ipfsRes.status)
      throw new Error('IPFS fetch failed')
    }
    const data = await ipfsRes.json()
    if (Array.isArray(data)) {
      memoryCache = data
      return data
    }
    throw new Error('Invalid data format from IPFS')
  } catch (err) {
    console.error('[pinataDb] getAllUsers error:', err)
    return memoryCache ?? []
  }
}

export async function saveAllUsers(users: UserAccount[]): Promise<boolean> {
  // Update memory cache immediately
  memoryCache = users

  const authHeaders = getAuthHeaders()
  if (Object.keys(authHeaders).length === 0) {
    console.error('[pinataDb] No auth headers, cannot save to Pinata')
    return false
  }

  try {
    // 1. Upload the new data first
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
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error('[pinataDb] pinJSONToIPFS failed:', uploadRes.status, errText)
      return false
    }

    const uploadData = await uploadRes.json()
    const newHash = uploadData.IpfsHash
    console.log('[pinataDb] Saved new pin:', newHash)

    // 2. Clean up old pins (keep only the latest one)
    try {
      const listRes = await fetch(
        `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${DB_METADATA_NAME}&pageLimit=50&sortBy=date_pinned&sortOrder=DESC`,
        { headers: authHeaders as HeadersInit, cache: 'no-store' }
      )
      if (listRes.ok) {
        const listData = await listRes.json()
        if (listData.rows?.length > 1) {
          // Unpin all except the newest one
          const oldPins = listData.rows.slice(1)
          for (const pin of oldPins) {
            try {
              await fetch(
                `https://api.pinata.cloud/pinning/unpin/${pin.ipfs_pin_hash}`,
                { method: 'DELETE', headers: authHeaders }
              )
            } catch {
              // Ignore individual unpin failures
            }
          }
          console.log(`[pinataDb] Cleaned up ${oldPins.length} old pins`)
        }
      }
    } catch {
      // Cleanup is best-effort, don't fail the save
      console.log('[pinataDb] Old pin cleanup skipped')
    }

    return true
  } catch (err) {
    console.error('[pinataDb] saveAllUsers error:', err)
    return false
  }
}
