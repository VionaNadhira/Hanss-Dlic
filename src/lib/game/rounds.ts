import { db, pool } from '../db/client'
import { rounds, bets, users, ledger, type Round } from '../db/schema'
import { eq, and, lte, or, inArray, sql } from 'drizzle-orm'
import { getMarket, resolveFinalPrice } from './markets'
import { getPriceAt, getLatestPrice } from './pyth'
import { computePayouts, computeOdds } from './math'
import { randomUUID } from 'crypto'

export const ROUND_DURATION_SEC = 300 // 5 minutes
export const BETTING_CLOSE_BUFFER_SEC = 10 // Closes 10s before round ends

/**
 * Returns aligned start timestamp (UTC 5-min boundary)
 */
export function getAlignedRoundStart(unixSec: number): number {
  return Math.floor(unixSec / ROUND_DURATION_SEC) * ROUND_DURATION_SEC
}

/**
 * Idempotently ensures the current round and next 2 presale rounds exist in DB.
 */
export async function ensureRounds(assetInput: string, nowSec: number): Promise<Round[]> {
  const asset = assetInput.toLowerCase()
  const currentStart = getAlignedRoundStart(nowSec)

  const starts = [
    currentStart, // current round (scheduled or live)
    currentStart + ROUND_DURATION_SEC, // presale round 1
    currentStart + ROUND_DURATION_SEC * 2, // presale round 2
  ]

  for (const startAt of starts) {
    const endAt = startAt + ROUND_DURATION_SEC
    const roundId = `${asset}-${startAt}`

    await db
      .insert(rounds)
      .values({
        id: roundId,
        asset,
        startAt,
        endAt,
        status: nowSec >= startAt ? 'live' : 'scheduled',
        poolUp: 0n,
        poolDown: 0n,
        houseSeedUp: 1000n,
        houseSeedDown: 1000n,
        feeBps: 200,
      })
      .onConflictDoNothing({ target: [rounds.asset, rounds.startAt] })
  }

  // Fetch the rounds for the given starts
  const rows = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.asset, asset), inArray(rounds.startAt, starts)))
    .orderBy(rounds.startAt)

  return rows
}

/**
 * Once now >= startAt and targetPrice is null, lock the target price.
 * Safe under concurrent calls (updates only where targetPrice is null).
 */
export async function lockTarget(round: Round, nowSec: number): Promise<void> {
  if (round.targetPrice !== null || nowSec < round.startAt) {
    return
  }

  const market = getMarket(round.asset)
  let targetPrice = await getPriceAt(market.pythFeedId, round.startAt)

  if (targetPrice === null) {
    // If exact historical is unavailable, grab latest price if close to start
    try {
      const latest = await getLatestPrice(round.asset)
      targetPrice = latest.price
    } catch {}
  }

  if (targetPrice !== null) {
    await db
      .update(rounds)
      .set({
        targetPrice: targetPrice.toFixed(4),
        status: round.status === 'scheduled' ? 'live' : round.status,
      })
      .where(and(eq(rounds.id, round.id), sql`${rounds.targetPrice} IS NULL`))
  }
}

/**
 * Settles rounds where now >= endAt + 5s and status is live/settling.
 * Runs atomically inside a transaction. Idempotent.
 */
export async function settleDueRounds(nowSec: number): Promise<void> {
  // Find rounds eligible for settlement
  const dueRounds = await db
    .select()
    .from(rounds)
    .where(
      and(
        lte(rounds.endAt, nowSec - 5),
        or(eq(rounds.status, 'live'), eq(rounds.status, 'settling'), eq(rounds.status, 'scheduled'))
      )
    )
    .limit(10)

  for (const round of dueRounds) {
    await settleSingleRound(round, nowSec)
  }
}

/**
 * Settles an individual round with ACID transactions and row locking.
 */
export async function settleSingleRound(
  round: Round,
  nowSec: number,
  finalPriceOverride?: number
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock the round row to ensure only one worker/request settles it
    const res = await client.query(
      `SELECT * FROM rounds WHERE id = $1 AND status IN ('scheduled', 'live', 'settling') FOR UPDATE`,
      [round.id]
    )

    if (res.rows.length === 0) {
      await client.query('ROLLBACK')
      return // Already settled or being settled
    }

    const currentRound = res.rows[0]

    // Set status to settling to indicate processing
    await client.query(`UPDATE rounds SET status = 'settling' WHERE id = $1`, [round.id])

    const market = getMarket(round.asset)
    const finalPrice = finalPriceOverride !== undefined ? finalPriceOverride : await resolveFinalPrice(market, round)

    // Check if price couldn't be fetched within 2 minutes after endAt
    if (finalPrice === null) {
      if (nowSec >= round.endAt + 120) {
        // Void the round and refund all bets
        await client.query(`UPDATE rounds SET status = 'void' WHERE id = $1`, [round.id])
        await processPayoutsAndRefunds(client, round.id, 'void', currentRound)
        await client.query('COMMIT')
      } else {
        // Retry next tick
        await client.query('COMMIT')
      }
      return
    }

    // Ensure target price exists (if never locked, lock it to final price or historical)
    let targetPriceNum = currentRound.target_price ? Number(currentRound.target_price) : null
    if (targetPriceNum === null) {
      targetPriceNum = (await getPriceAt(market.pythFeedId, round.startAt)) || finalPrice
      await client.query(`UPDATE rounds SET target_price = $1 WHERE id = $2`, [
        targetPriceNum.toFixed(4),
        round.id,
      ])
    }

    // Determine winner: tie goes to Up
    const result: 'up' | 'down' = finalPrice >= targetPriceNum ? 'up' : 'down'

    // Update round with resolved status, final price and result
    await client.query(
      `UPDATE rounds SET status = 'resolved', final_price = $1, result = $2 WHERE id = $3`,
      [finalPrice.toFixed(4), result, round.id]
    )

    // Process payouts for all bets in this round
    await processPayoutsAndRefunds(client, round.id, result, currentRound)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`[settleSingleRound] Error settling round ${round.id}:`, err)
  } finally {
    client.release()
  }
}

/**
 * Disburse payouts or refunds, update user balances, ledger, score, and streaks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPayoutsAndRefunds(
  client: any,
  roundId: string,
  result: 'up' | 'down' | 'void',
  roundRow: any
) {
  const betsRes = await client.query(`SELECT * FROM bets WHERE round_id = $1 FOR UPDATE`, [roundId])

  if (betsRes.rows.length === 0) {
    return
  }

  const rawBets = betsRes.rows.map((b: any) => ({
    id: b.id,
    userId: b.user_id,
    side: b.side as 'up' | 'down',
    amount: BigInt(b.amount),
  }))

  const pools = {
    poolUp: BigInt(roundRow.pool_up || 0),
    poolDown: BigInt(roundRow.pool_down || 0),
  }
  const seeds = {
    houseSeedUp: BigInt(roundRow.house_seed_up || 1000),
    houseSeedDown: BigInt(roundRow.house_seed_down || 1000),
  }
  const feeBps = roundRow.fee_bps ?? 200

  const payoutResults = computePayouts(rawBets, result, pools, seeds, feeBps)

  for (const p of payoutResults) {
    // 1. Update bet record status & payout
    await client.query(`UPDATE bets SET status = $1, payout = $2 WHERE id = $3`, [
      p.status,
      p.payout.toString(),
      p.betId,
    ])

    // 2. Score calculation:
    // Every settled bet gives +10 participation points, +20 more if won, +0 if refunded
    let scoreAdd = 0
    if (p.status === 'won') {
      scoreAdd = 30 // +10 participation + 20 win
    } else if (p.status === 'lost') {
      scoreAdd = 10 // +10 participation
    }

    // 3. Credit payout / refund to user balance and update score
    if (p.payout > 0n || scoreAdd > 0) {
      await client.query(
        `UPDATE users SET balance = balance + $1, score = score + $2 WHERE id = $3`,
        [p.payout.toString(), scoreAdd, p.userId]
      )

      if (p.payout > 0n) {
        const reason = p.status === 'refunded' ? 'refund' : 'payout'
        await client.query(
          `INSERT INTO ledger (id, user_id, delta, reason, ref_id) VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), p.userId, p.payout.toString(), reason, roundId]
        )
      }
    }
  }
}

/**
 * Lazy synchronization helper: runs ensureRounds, lockTarget, and settleDueRounds.
 * Called at the start of every game API request.
 */
export async function runLazySync(asset: string): Promise<void> {
  try {
    const nowSec = Math.floor(Date.now() / 1000)
    const activeRounds = await ensureRounds(asset, nowSec)
    for (const r of activeRounds) {
      if (r.targetPrice === null && nowSec >= r.startAt) {
        await lockTarget(r, nowSec)
      }
    }
    await settleDueRounds(nowSec)
  } catch (err) {
    console.error('[runLazySync] Error running lazy sync:', err)
  }
}
