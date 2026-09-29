import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

const connectionString =
  process.env.DATABASE_URL || 'postgresql://hanss:hansspass@localhost:5432/hanssdlic'

const pool =
  global.__pgPool ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
  })

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool
}

export const db = drizzle(pool, { schema })
export { pool }
