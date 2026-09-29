import fs from 'fs'
import path from 'path'
import { pool } from './client'

export async function initDb(): Promise<void> {
  const client = await pool.connect()
  try {
    // 1. Create tables and indexes
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL,
        password_hash VARCHAR(128) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        balance BIGINT NOT NULL DEFAULT 1000,
        score INT NOT NULL DEFAULT 1000,
        streak_days INT NOT NULL DEFAULT 0,
        last_bet_day VARCHAR(10),
        last_faucet_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        last_login_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS rounds (
        id VARCHAR(64) PRIMARY KEY,
        asset VARCHAR(16) NOT NULL,
        start_at INT NOT NULL,
        end_at INT NOT NULL,
        target_price NUMERIC(18, 8),
        final_price NUMERIC(18, 8),
        status VARCHAR(16) NOT NULL DEFAULT 'scheduled',
        result VARCHAR(8),
        pool_up BIGINT NOT NULL DEFAULT 0,
        pool_down BIGINT NOT NULL DEFAULT 0,
        house_seed_up BIGINT NOT NULL DEFAULT 1000,
        house_seed_down BIGINT NOT NULL DEFAULT 1000,
        fee_bps INT NOT NULL DEFAULT 200,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT unq_asset_start UNIQUE (asset, start_at)
      );

      CREATE INDEX IF NOT EXISTS idx_rounds_status_end ON rounds(asset, status, end_at);

      CREATE TABLE IF NOT EXISTS bets (
        id VARCHAR(64) PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        round_id VARCHAR(64) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        side VARCHAR(8) NOT NULL,
        amount BIGINT NOT NULL,
        payout BIGINT,
        status VARCHAR(16) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bets_round_user ON bets(round_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_bets_user_created ON bets(user_id, created_at);

      CREATE TABLE IF NOT EXISTS ledger (
        id VARCHAR(64) PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delta BIGINT NOT NULL,
        reason VARCHAR(16) NOT NULL,
        ref_id VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, created_at);

      CREATE TABLE IF NOT EXISTS price_ticks (
        id BIGSERIAL PRIMARY KEY,
        asset VARCHAR(16) NOT NULL,
        ts INT NOT NULL,
        price NUMERIC(18, 8) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_price_ticks_asset_ts ON price_ticks(asset, ts DESC);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(32) NOT NULL,
        message VARCHAR(500) NOT NULL,
        time VARCHAR(16) NOT NULL,
        timestamp BIGINT NOT NULL,
        reply_to_id VARCHAR(64),
        reply_to_user VARCHAR(32),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_ts ON chat_messages(timestamp ASC);
    `)

    // Ensure balance column is numeric(18, 2)
    try {
      await client.query(`
        ALTER TABLE users ALTER COLUMN balance TYPE NUMERIC(18, 2) USING balance::NUMERIC(18, 2);
      `)
    } catch {}

    // 2. Migrate existing users from .users-db.json if available
    const localDbPath = path.join(process.cwd(), '.users-db.json')
    if (fs.existsSync(localDbPath)) {
      try {
        const raw = fs.readFileSync(localDbPath, 'utf-8')
        const usersData = JSON.parse(raw)
        if (Array.isArray(usersData)) {
          for (const u of usersData) {
            if (!u.username || !u.passwordHash) continue
            const cleanUser = String(u.username).trim().toLowerCase()
            const balanceNum = Math.max(0, Number(u.balance) || 1000)
            const createdAtDate = u.createdAt ? new Date(u.createdAt) : new Date()
            const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : new Date()
            const lastFaucetDate = u.lastFaucetClaim ? new Date(u.lastFaucetClaim) : null

            await client.query(
              `
              INSERT INTO users (username, password_hash, salt, balance, score, streak_days, last_faucet_at, created_at, last_login_at)
              VALUES ($1, $2, $3, $4, 1000, 0, $5, $6, $7)
              ON CONFLICT (username) DO UPDATE
              SET balance = EXCLUDED.balance,
                  last_login_at = EXCLUDED.last_login_at,
                  last_faucet_at = EXCLUDED.last_faucet_at
            `,
              [
                cleanUser,
                u.passwordHash,
                u.salt || '',
                balanceNum,
                lastFaucetDate,
                createdAtDate,
                lastLoginDate,
              ]
            )
          }
        }
      } catch (err) {
        console.error('Migration from .users-db.json error:', err)
      }
    }

    // 3. Migrate existing chat messages from .chat-db.json if available
    const localChatPath = path.join(process.cwd(), '.chat-db.json')
    if (fs.existsSync(localChatPath)) {
      try {
        const rawChat = fs.readFileSync(localChatPath, 'utf-8')
        const chatData = JSON.parse(rawChat)
        if (Array.isArray(chatData)) {
          for (const msg of chatData) {
            if (!msg.id || !msg.user || !msg.message) continue
            await client.query(
              `
              INSERT INTO chat_messages (id, username, message, time, timestamp, reply_to_id, reply_to_user)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO NOTHING
            `,
              [
                msg.id,
                msg.user,
                msg.message,
                msg.time || '',
                msg.timestamp || Date.now(),
                msg.replyTo?.id || null,
                msg.replyTo?.user || null,
              ]
            )
          }
        }
      } catch (err) {
        console.error('Migration from .chat-db.json error:', err)
      }
    }
  } finally {
    client.release()
  }
}

// Auto-run if executed directly via node or tsx
if (require.main === module) {
  initDb()
    .then(() => {
      console.log('Database initialized successfully')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Database initialization failed:', err)
      process.exit(1)
    })
}
