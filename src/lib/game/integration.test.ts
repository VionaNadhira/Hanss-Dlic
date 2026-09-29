import { describe, it, expect, beforeAll } from 'vitest'
import { pool } from '../db/client'
import { initDb } from '../db/migrate'
import { settleSingleRound } from './rounds'
import { randomUUID } from 'crypto'

describe('End-to-End Bet & Settlement Integration Test', () => {
  beforeAll(async () => {
    await initDb()
  })

  it('simulates two users betting on opposite sides, settles the round, and checks balances and ledger reconcile', async () => {
    const client = await pool.connect()
    try {
      const nowSec = Math.floor(Date.now() / 1000)
      const startAt = Math.floor(nowSec / 300) * 300 - 300 // round in the past
      const endAt = startAt + 300
      const roundId = `test-btc-${startAt}`
      const userA = `test_alice_${Date.now()}`
      const userB = `test_bob_${Date.now()}`

      // 1. Create two test users with 1000 balance
      const resA = await client.query(
        `INSERT INTO users (username, password_hash, salt, balance, score)
         VALUES ($1, 'hash', 'salt', 1000, 1000) RETURNING id`,
        [userA]
      )
      const userAId = resA.rows[0].id

      const resB = await client.query(
        `INSERT INTO users (username, password_hash, salt, balance, score)
         VALUES ($1, 'hash', 'salt', 1000, 1000) RETURNING id`,
        [userB]
      )
      const userBId = resB.rows[0].id

      // 2. Create the test round
      await client.query(
        `INSERT INTO rounds (id, asset, start_at, end_at, target_price, status, pool_up, pool_down, house_seed_up, house_seed_down, fee_bps)
         VALUES ($1, 'btc', $2, $3, '60000.0000', 'live', 500, 500, 1000, 1000, 200)
         ON CONFLICT (id) DO UPDATE SET status = 'live'`,
        [roundId, startAt, endAt]
      )

      // 3. User A bets 500 on UP
      const betAId = randomUUID()
      await client.query(`UPDATE users SET balance = balance - 500 WHERE id = $1`, [userAId])
      await client.query(
        `INSERT INTO ledger (id, user_id, delta, reason, ref_id) VALUES ($1, $2, -500, 'bet', $3)`,
        [randomUUID(), userAId, roundId]
      )
      await client.query(
        `INSERT INTO bets (id, user_id, round_id, side, amount, status) VALUES ($1, $2, $3, 'up', 500, 'open')`,
        [betAId, userAId, roundId]
      )

      // User B bets 500 on DOWN
      const betBId = randomUUID()
      await client.query(`UPDATE users SET balance = balance - 500 WHERE id = $1`, [userBId])
      await client.query(
        `INSERT INTO ledger (id, user_id, delta, reason, ref_id) VALUES ($1, $2, -500, 'bet', $3)`,
        [randomUUID(), userBId, roundId]
      )
      await client.query(
        `INSERT INTO bets (id, user_id, round_id, side, amount, status) VALUES ($1, $2, $3, 'down', 500, 'open')`,
        [betBId, userBId, roundId]
      )

      // 4. Settle the round with final price 65000 (>= target 60000 => UP WINS)
      const roundRow = (
        await client.query(`SELECT * FROM rounds WHERE id = $1`, [roundId])
      ).rows[0]

      // We pass nowSec > endAt + 5 and explicit 65000 price override to trigger deterministic settlement
      await settleSingleRound(
        {
          id: roundRow.id,
          asset: roundRow.asset,
          startAt: roundRow.start_at,
          endAt: roundRow.end_at,
          targetPrice: roundRow.target_price,
          finalPrice: '65000.0000',
          status: 'live',
          result: null,
          poolUp: 500n,
          poolDown: 500n,
          houseSeedUp: 1000n,
          houseSeedDown: 1000n,
          feeBps: 200,
          createdAt: new Date(),
        },
        endAt + 10,
        65000
      )

      // 5. Verify round is resolved and UP won
      const settledRound = (
        await client.query(`SELECT * FROM rounds WHERE id = $1`, [roundId])
      ).rows[0]
      expect(settledRound.status).toBe('resolved')
      expect(settledRound.result).toBe('up')

      // 6. Verify bet statuses
      const betARow = (await client.query(`SELECT * FROM bets WHERE id = $1`, [betAId])).rows[0]
      const betBRow = (await client.query(`SELECT * FROM bets WHERE id = $1`, [betBId])).rows[0]

      expect(betARow.status).toBe('won')
      expect(BigInt(betARow.payout)).toBeGreaterThan(0n)
      expect(betBRow.status).toBe('lost')
      expect(BigInt(betBRow.payout)).toBe(0n)

      // 7. Verify Ledger Reconciles for both users:
      // sum of ledger deltas == (final balance - initial balance 1000)
      for (const [uid, uName] of [[userAId, userA], [userBId, userB]] as const) {
        const userRow = (await client.query(`SELECT balance FROM users WHERE id = $1`, [uid])).rows[0]
        const currentBalance = BigInt(userRow.balance)

        const ledgerRows = (await client.query(`SELECT delta FROM ledger WHERE user_id = $1`, [uid])).rows
        const sumDeltas = ledgerRows.reduce((acc, row) => acc + BigInt(row.delta), 0n)

        // Starting balance was 1000
        expect(1000n + sumDeltas).toBe(currentBalance)
      }
    } finally {
      client.release()
    }
  })
})
