import {
  pgTable,
  serial,
  varchar,
  bigint,
  integer,
  numeric,
  timestamp,
  bigserial,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 128 }).notNull(),
  salt: varchar('salt', { length: 64 }).notNull(),
  balance: bigint('balance', { mode: 'bigint' }).notNull().default(BigInt(1000)),
  score: integer('score').notNull().default(1000),
  streakDays: integer('streak_days').notNull().default(0),
  lastBetDay: varchar('last_bet_day', { length: 10 }), // YYYY-MM-DD UTC
  lastFaucetAt: timestamp('last_faucet_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

export const rounds = pgTable(
  'rounds',
  {
    id: varchar('id', { length: 64 }).primaryKey(), // e.g. "btc-1727654400"
    asset: varchar('asset', { length: 16 }).notNull(), // 'btc', 'eth', 'sol'
    startAt: integer('start_at').notNull(), // Unix timestamp (multiples of 300)
    endAt: integer('end_at').notNull(), // startAt + 300
    targetPrice: numeric('target_price', { precision: 18, scale: 8 }),
    finalPrice: numeric('final_price', { precision: 18, scale: 8 }),
    status: varchar('status', { length: 16 }).notNull().default('scheduled'), // 'scheduled' | 'live' | 'settling' | 'resolved' | 'void'
    result: varchar('result', { length: 8 }), // 'up' | 'down' | null
    poolUp: bigint('pool_up', { mode: 'bigint' }).notNull().default(BigInt(0)),
    poolDown: bigint('pool_down', { mode: 'bigint' }).notNull().default(BigInt(0)),
    houseSeedUp: bigint('house_seed_up', { mode: 'bigint' }).notNull().default(BigInt(1000)),
    houseSeedDown: bigint('house_seed_down', { mode: 'bigint' }).notNull().default(BigInt(1000)),
    feeBps: integer('fee_bps').notNull().default(200), // 200 bps = 2%
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    unqAssetStart: uniqueIndex('unq_asset_start').on(table.asset, table.startAt),
    idxRoundsStatus: index('idx_rounds_status_end').on(table.asset, table.status, table.endAt),
  })
)

export const bets = pgTable(
  'bets',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roundId: varchar('round_id', { length: 64 })
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    side: varchar('side', { length: 8 }).notNull(), // 'up' | 'down'
    amount: bigint('amount', { mode: 'bigint' }).notNull(), // Points staked (>= 10)
    payout: bigint('payout', { mode: 'bigint' }), // Settled points returned
    status: varchar('status', { length: 16 }).notNull().default('open'), // 'open' | 'won' | 'lost' | 'refunded'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxBetsRoundUser: index('idx_bets_round_user').on(table.roundId, table.userId),
    idxBetsUserCreated: index('idx_bets_user_created').on(table.userId, table.createdAt),
  })
)

export const ledger = pgTable(
  'ledger',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    delta: bigint('delta', { mode: 'bigint' }).notNull(), // +credit or -debit
    reason: varchar('reason', { length: 16 }).notNull(), // 'bet' | 'payout' | 'refund' | 'faucet'
    refId: varchar('ref_id', { length: 64 }), // betId or roundId
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxLedgerUser: index('idx_ledger_user').on(table.userId, table.createdAt),
  })
)

export const priceTicks = pgTable(
  'price_ticks',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    asset: varchar('asset', { length: 16 }).notNull(),
    ts: integer('ts').notNull(), // Unix epoch seconds
    price: numeric('price', { precision: 18, scale: 8 }).notNull(),
  },
  (table) => ({
    idxPriceTicksAssetTs: index('idx_price_ticks_asset_ts').on(table.asset, table.ts),
  })
)

export const usersRelations = relations(users, ({ many }) => ({
  bets: many(bets),
  ledger: many(ledger),
}))

export const roundsRelations = relations(rounds, ({ many }) => ({
  bets: many(bets),
}))

export const betsRelations = relations(bets, ({ one }) => ({
  user: one(users, {
    fields: [bets.userId],
    references: [users.id],
  }),
  round: one(rounds, {
    fields: [bets.roundId],
    references: [rounds.id],
  }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Round = typeof rounds.$inferSelect
export type NewRound = typeof rounds.$inferInsert
export type Bet = typeof bets.$inferSelect
export type NewBet = typeof bets.$inferInsert
export type LedgerEntry = typeof ledger.$inferSelect
export type PriceTick = typeof priceTicks.$inferSelect
