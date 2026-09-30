import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  'postgresql://hanss:hansspass@localhost:5432/hanssdlic'

const isRemote =
  connectionString.includes('neon.tech') ||
  connectionString.includes('vercel-storage.com') ||
  connectionString.includes('supabase.co') ||
  connectionString.includes('sslmode=require') ||
  (process.env.NODE_ENV === 'production' && !connectionString.includes('localhost'))

const pool =
  global.__pgPool ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  })

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool
}

export const db = drizzle(pool, { schema })
export { pool }

let ensurePromise: Promise<void> | null = null

/**
 * Adds columns that may be missing on an existing production database.
 * Runs once per server instance, lazily, and never throws.
 */
export function ensureSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = pool
      .query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
         UPDATE users SET avatar_url = 'https://xsgames.co/randomusers/avatar.php?g=pixel' WHERE avatar_url IS NULL;`
      )
      .then(() => undefined)
      .catch((err) => {
        console.error('[ensureSchema] failed:', err)
        ensurePromise = null
      })
  }
  return ensurePromise
}
