import crypto from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { db, pool } from './client'
import * as schema from './schema'

export interface DbUser {
  id: number
  username: string
  passwordHash: string
  salt: string
  balance: number
  score: number
  streakDays: number
  lastBetDay?: string | null
  lastFaucetAt?: Date | null
  createdAt: Date
  lastLoginAt?: Date | null
  avatarUrl?: string | null
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

export function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex')
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const clean = username.trim().toLowerCase()
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(sql`LOWER(${schema.users.username})`, clean))
    .limit(1)

  if (!rows.length) return null
  const u = rows[0]
  return {
    ...u,
    balance: Number(u.balance),
    score: u.score ?? 1000,
    streakDays: u.streakDays ?? 0,
    avatarUrl: u.avatarUrl || 'https://xsgames.co/randomusers/avatar.php?g=pixel',
  }
}

export async function createUser(data: {
  avatarUrl?: string
  username: string
  passwordHash: string
  salt: string
  balance?: number
}): Promise<DbUser> {
  const clean = data.username.trim().toLowerCase()
  const startingBalance = (data.balance ?? 1000).toFixed(2)
  const rows = await db
    .insert(schema.users)
    .values({
      username: clean,
      passwordHash: data.passwordHash,
      salt: data.salt,
      balance: startingBalance,
      score: 1000,
      streakDays: 0,
      avatarUrl: data.avatarUrl || 'https://xsgames.co/randomusers/avatar.php?g=pixel',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    })
    .returning()

  const u = rows[0]
  return {
    ...u,
    balance: Number(u.balance),
    score: u.score ?? 1000,
    streakDays: u.streakDays ?? 0,
    avatarUrl: u.avatarUrl || 'https://xsgames.co/randomusers/avatar.php?g=pixel',
  }
}

export async function updateLastLogin(username: string): Promise<void> {
  const clean = username.trim().toLowerCase()
  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(sql`LOWER(${schema.users.username})`, clean))
}

export async function getUserRank(username: string, balance: number): Promise<number> {
  const res = await pool.query(
    'SELECT COUNT(*) as higher_count FROM users WHERE balance > $1',
    [balance]
  )
  return parseInt(res.rows[0]?.higher_count || '0', 10) + 1
}

export async function deductUserBalanceAtomic(
  username: string,
  amount: number
): Promise<{ success: boolean; balance?: number; error?: string }> {
  if (amount <= 0) return { success: false, error: 'Invalid amount' }
  const clean = username.trim().toLowerCase()

  const res = await pool.query(
    `UPDATE users
     SET balance = balance - $1
     WHERE LOWER(username) = LOWER($2) AND balance >= $1
     RETURNING balance`,
    [amount, clean]
  )

  if (res.rows.length === 0) {
    return { success: false, error: 'Insufficient balance or user not found' }
  }

  return { success: true, balance: Number(res.rows[0].balance) }
}

export async function creditUserBalanceAtomic(
  username: string,
  amount: number
): Promise<{ success: boolean; balance?: number; error?: string }> {
  if (amount <= 0) return { success: false, error: 'Invalid amount' }
  const clean = username.trim().toLowerCase()

  const res = await pool.query(
    `UPDATE users
     SET balance = balance + $1
     WHERE LOWER(username) = LOWER($2)
     RETURNING balance`,
    [amount, clean]
  )

  if (res.rows.length === 0) {
    return { success: false, error: 'User not found' }
  }

  return { success: true, balance: Number(res.rows[0].balance) }
}

export async function setUserBalance(
  username: string,
  balance: number
): Promise<{ success: boolean; balance?: number }> {
  const clean = username.trim().toLowerCase()
  const clamped = Math.max(0, balance)
  const res = await pool.query(
    `UPDATE users
     SET balance = $1
     WHERE LOWER(username) = LOWER($2)
     RETURNING balance`,
    [clamped, clean]
  )

  if (res.rows.length === 0) return { success: false }
  return { success: true, balance: Number(res.rows[0].balance) }
}

export async function claimFaucetAtomic(
  username: string,
  amount: number,
  cooldownMs: number
): Promise<
  | { success: true; newBalance: number; nextClaimMs: number }
  | { success: false; error: string; remainingMs?: number; requiresLogin?: boolean }
> {
  const clean = username.trim().toLowerCase()
  const cooldownSec = Math.ceil(cooldownMs / 1000)

  // Atomic update: only updates if last_faucet_at is null OR expired
  const res = await pool.query(
    `UPDATE users
     SET balance = balance + $1,
         last_faucet_at = NOW()
     WHERE LOWER(username) = LOWER($2)
       AND (last_faucet_at IS NULL OR last_faucet_at <= NOW() - ($3 || ' seconds')::INTERVAL)
     RETURNING balance, last_faucet_at`,
    [amount, clean, cooldownSec]
  )

  if (res.rows.length > 0) {
    return {
      success: true,
      newBalance: Number(res.rows[0].balance),
      nextClaimMs: cooldownMs,
    }
  }

  // Not updated: find out whether user doesn't exist or cooldown is still active
  const user = await getUserByUsername(clean)
  if (!user) {
    return { success: false, error: 'User not found' }
  }

  const lastClaim = user.lastFaucetAt ? new Date(user.lastFaucetAt).getTime() : 0
  const elapsed = Date.now() - lastClaim
  const remainingMs = Math.max(0, cooldownMs - elapsed)

  return {
    success: false,
    error: 'Faucet cooldown active',
    remainingMs,
  }
}

export async function getLeaderboardUsers(limit = 50) {
  const res = await pool.query(
     `SELECT username, balance, score, streak_days as "streakDays", COALESCE(avatar_url, 'https://xsgames.co/randomusers/avatar.php?g=pixel') as "avatarUrl"
     FROM users
      ORDER BY balance DESC
      LIMIT $1`,
    [limit]
  )

  return res.rows.map((r, index) => ({
    rank: index + 1,
    username: r.username,
    avatarUrl: r.avatarUrl as string,
    balance: Number(r.balance),
    score: Number(r.score || Math.floor(Number(r.balance))),
    streakDays: Number(r.streakDays || 0),
  }))
}

export async function getChatMessagesDb(limit = 50): Promise<ChatMessage[]> {
  const res = await pool.query(
    `SELECT id, username as user, message, time, timestamp, reply_to_id as "replyToId", reply_to_user as "replyToUser"
     FROM chat_messages
     ORDER BY timestamp ASC
     LIMIT $1`,
    [limit]
  )

  return res.rows.map((r) => ({
    id: r.id,
    user: r.user,
    message: r.message,
    time: r.time,
    timestamp: Number(r.timestamp),
    replyTo: r.replyToId ? { id: r.replyToId, user: r.replyToUser } : undefined,
  }))
}

export async function saveChatMessageDb(msg: ChatMessage): Promise<void> {
  await pool.query(
    `INSERT INTO chat_messages (id, username, message, time, timestamp, reply_to_id, reply_to_user)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      msg.id,
      msg.user,
      msg.message,
      msg.time,
      msg.timestamp,
      msg.replyTo?.id || null,
      msg.replyTo?.user || null,
    ]
  )

  // Prune older messages keeping the latest 100 in the background
  pool.query(`
    DELETE FROM chat_messages
    WHERE id NOT IN (
      SELECT id FROM chat_messages ORDER BY timestamp DESC LIMIT 100
    )
  `).catch(() => {})
}
