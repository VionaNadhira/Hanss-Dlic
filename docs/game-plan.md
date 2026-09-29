# Up or Down (5-Minute Rounds) — Architecture & Implementation Plan

## 1. Executive Summary & Goal
Build a short-term crypto price prediction game ("Up or Down", 5-minute rounds) running strictly on **virtual points** (no real money, no external wallet, no crypto withdrawals, no on-chain transactions). The game draws inspiration from Melee Markets and Polymarket 5m rounds, integrating real-time spot price feeds from Pyth Network Hermes REST API.

---

## 2. Security & Data Cleanup Proposal

### Analysis of Current `.users-db.json`
- **Location & Status**: `.users-db.json` is located at the project root and is currently **tracked in git**.
- **Fields Present**:
  - `username` (string)
  - `passwordHash` (string)
  - `salt` (string)
  - `balance` (number)
  - `createdAt` (number, epoch timestamp)
  - `lastLogin` (number, epoch timestamp)
  - `history` (array of game outcome items)
  - `lastFaucetClaim` (number, optional epoch timestamp)
- **Vulnerabilities & Limitations**:
  1. **Git Exposure**: Committing user credentials (hashes and salts) to version control exposes data to anyone with repo access.
  2. **Vercel Ephemeral Filesystem**: Serverless functions on Vercel execute in read-only or ephemeral environments (`/tmp` is erased across container lifetimes). Local JSON writes do not persist.
  3. **Concurrency / Race Conditions**: Reading and overwriting an entire JSON file / Pinata IPFS pin cannot prevent race conditions (lost updates) when multiple users bet or claim faucets concurrently. No support for atomic `FOR UPDATE` transactions or ledger reconciliations.

### Migration & Remediation Plan
1. **Remove from Git Tracking**: Run `git rm --cached .users-db.json` so git ceases tracking changes.
2. **Update `.gitignore`**: Add `.users-db.json` directly to `.gitignore` under local storage entries.
3. **Database Migration Script**: Create a one-time migration utility (`src/lib/db/migrate-json-users.ts`) that reads `.users-db.json` and inserts existing user records into the Postgres `users` table, converting numerical balances into integer points (`bigint`).
4. **Security Notice**: Instruct the project owner to treat all past credentials previously pushed to git as compromised and reset them or force re-authentication in production.

---

## 3. Database Architecture (Neon Postgres + Drizzle ORM)

### Technology Selection
- **Database**: Neon Serverless Postgres (`@neondatabase/serverless`).
- **ORM / Query Builder**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`).
- **Rationale**: Serverless connection pooling (WebSocket / HTTP proxy) suited for Vercel edge/serverless runtimes, zero-cold-start queries, full support for row-level locking (`FOR UPDATE`), transactions, and type-safe schemas.

### Schema Design (`src/lib/db/schema.ts`)

#### 1. `users` Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  balance BIGINT NOT NULL DEFAULT 1000,
  score INT NOT NULL DEFAULT 1000,
  streak_days INT NOT NULL DEFAULT 0,
  last_bet_day VARCHAR(10),            -- YYYY-MM-DD in UTC
  last_faucet_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMP WITH TIME ZONE
);
```

#### 2. `rounds` Table
```sql
CREATE TABLE rounds (
  id VARCHAR(64) PRIMARY KEY,          -- e.g. "btc-1727654400"
  asset VARCHAR(16) NOT NULL,          -- "btc", "eth", "sol"
  start_at INT NOT NULL,               -- Unix seconds (multiple of 300)
  end_at INT NOT NULL,                 -- start_at + 300
  target_price NUMERIC(18, 8),         -- Locked price at start_at
  final_price NUMERIC(18, 8),          -- Settled price at end_at
  status VARCHAR(16) NOT NULL,         -- 'scheduled' | 'live' | 'settling' | 'resolved' | 'void'
  result VARCHAR(8),                   -- 'up' | 'down' | NULL (tie is 'up')
  pool_up BIGINT NOT NULL DEFAULT 0,
  pool_down BIGINT NOT NULL DEFAULT 0,
  house_seed_up BIGINT NOT NULL DEFAULT 1000,
  house_seed_down BIGINT NOT NULL DEFAULT 1000,
  fee_bps INT NOT NULL DEFAULT 200,    -- 200 bps = 2%
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT unq_asset_start UNIQUE (asset, start_at)
);
CREATE INDEX idx_rounds_status_end ON rounds(asset, status, end_at);
```

#### 3. `bets` Table
```sql
CREATE TABLE bets (
  id VARCHAR(64) PRIMARY KEY,          -- UUID or nanoid
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id VARCHAR(64) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  side VARCHAR(8) NOT NULL,            -- 'up' | 'down'
  amount BIGINT NOT NULL,              -- Points staked (>= 10)
  payout BIGINT,                       -- Points returned upon settlement
  status VARCHAR(16) NOT NULL,         -- 'open' | 'won' | 'lost' | 'refunded'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_bets_round_user ON bets(round_id, user_id);
CREATE INDEX idx_bets_user_created ON bets(user_id, created_at);
```

#### 4. `ledger` Table
```sql
CREATE TABLE ledger (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta BIGINT NOT NULL,               -- Positive (credit) or negative (debit)
  reason VARCHAR(16) NOT NULL,         -- 'bet' | 'payout' | 'refund' | 'faucet'
  ref_id VARCHAR(64),                  -- bet_id or round_id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_ledger_user ON ledger(user_id, created_at);
```

#### 5. `price_ticks` Table
```sql
CREATE TABLE price_ticks (
  id BIGSERIAL PRIMARY KEY,
  asset VARCHAR(16) NOT NULL,
  ts INT NOT NULL,                     -- Unix epoch seconds
  price NUMERIC(18, 8) NOT NULL
);
CREATE INDEX idx_price_ticks_asset_ts ON price_ticks(asset, ts DESC);
```

---

## 4. Market & Price Feed Architecture

### Verified Pyth Hermes Price Feeds
Pyth Hermes REST endpoint: `https://hermes.pyth.network`
Official, verified Mainnet Price Feed IDs:
- **BTC/USD**: `e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`
- **ETH/USD**: `ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`
- **SOL/USD**: `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`

### Price Feed Workflow
1. **Latest Price (`GET /api/price?asset=btc`)**:
   - Fetches from `https://hermes.pyth.network/v2/updates/price/latest?ids[]=<feedId>&parsed=true`.
   - Computes human price: `price * 10^expo`.
   - Server-side memory cache with 1-second TTL to avoid duplicate upstream requests.
   - Writes tick to `price_ticks` table at most once per second per asset.
   - Cleans up old ticks (> 2 hours) opportunistically in the background.
2. **Historical Price (`getPriceAt(feedId, unixSeconds)`)**:
   - Queries `https://hermes.pyth.network/v2/updates/price/{publish_time}?ids[]=<feedId>&parsed=true`.
   - Uses retry logic with exponential backoff (3 attempts).
3. **Chart History (`GET /api/price/history?asset=btc&from=<unix>`)**:
   - Fetches points from `price_ticks` from `from` timestamp to current time for custom SVG chart backfill.

---

## 5. Round Lifecycle & Settlement Logic

### 5-Minute Round Window
- `startAt` is aligned to UTC 5-minute boundaries (`floor(now / 300) * 300`).
- `endAt = startAt + 300`.
- Betting closes at `endAt - 30s` (last 30 seconds are locked to avoid front-running).

### Pluggable Settlement Interface
```typescript
export async function resolveFinalPrice(market: MarketConfig, round: RoundRecord): Promise<number> {
  if (market.settleMode === 'spot') {
    return await getPriceAt(market.pythFeedId, round.endAt)
  }
  // Pluggable for future TWAP calculation
  throw new Error(`Unsupported settle mode: ${market.settleMode}`)
}
```

### Lazy Settlement Pattern
Since Vercel Hobby does not allow minutely cron triggers:
- Any incoming API request to `/api/rounds/current`, `/api/price`, or `/api/bets` executes a lightweight synchronization pass:
  1. `ensureRounds(asset, now)`: Ensures current round and next 2 presale rounds exist.
  2. `lockTarget(round)`: Locks `targetPrice = getPriceAt(round.startAt)` once `now >= startAt` where `targetPrice IS NULL`.
  3. `settleDueRounds(now)`: Finds rounds where `now >= endAt + 5s` and status is `'live'` or `'settling'`. Resolves final price and triggers payout transaction.
- External cron/ping support: `POST /api/cron/tick` secured with `Authorization: Bearer <CRON_SECRET>`.

---

## 6. Betting Math & Parimutuel Settlement

### Formulas
- `effectiveUp = poolUp + houseSeedUp`
- `effectiveDown = poolDown + houseSeedDown`
- `total = effectiveUp + effectiveDown`
- `displayedChanceUp = effectiveUp / total`
- `multiplierUp = max(1.0, floor(total * (10000 - feeBps) / effectiveUp) / 10000)`
- `multiplierDown = max(1.0, floor(total * (10000 - feeBps) / effectiveDown) / 10000)`

### Settlement Rules
- **Winning Outcome**: If `finalPrice >= targetPrice`, result is `'up'`. Else `'down'`. (Tie goes to Up).
- **Winning Bet Payout**:
  `payout = floor(amount * total * (10000 - feeBps) / (10000 * effectiveWinningSide))`
- **Edge Cases**:
  - If winning side has 0 user bets, refund all user stakes on both sides.
  - If round status is `'void'` (e.g. Pyth price unavailable within 2m), refund all bets.
  - If round had no user bets, mark resolved.
  - Every payout and refund updates `users.balance` and records an entry in `ledger`.

---

## 7. Folder Layout for the Feature

```
src/
├── app/
│   ├── (casino)/
│   │   ├── play/                     <-- Up/Down game page (/play)
│   │   └── leaderboard/              <-- Leaderboard page
│   └── api/
│       ├── cron/
│       │   └── tick/route.ts         <-- Lazy/External cron endpoint
│       ├── price/
│       │   ├── route.ts              <-- Latest price & caching
│       │   └── history/route.ts      <-- Price tick history for chart
│       ├── rounds/
│       │   ├── current/route.ts      <-- Live + 2 presale rounds + odds
│       │   └── recent/route.ts       <-- Last 20 resolved rounds
│       ├── bets/
│       │   └── route.ts              <-- Place bet with atomic transaction
│       ├── faucet/
│       │   └── route.ts              <-- Hourly faucet claim
│       ├── me/
│       │   └── route.ts              <-- User rank, streak, score, tier
│       └── leaderboard/
│           └── route.ts              <-- Top 50 leaderboard
├── components/
│   └── game/
│       ├── MarketHeader.tsx          <-- Asset switcher, title, time window
│       ├── RoundCountdown.tsx        <-- Sync countdown, amber < 30s
│       ├── RoundChips.tsx            <-- Live dot + 2 Presale chips
│       ├── OddsButtons.tsx           <-- Up/Down multiplier buttons & split bar
│       ├── BetPanel.tsx              <-- Preset amounts, side toggle, submit
│       ├── PriceChart.tsx            <-- Custom SVG chart with target line & gradient
│       ├── RecentRoundsStrip.tsx     <-- Last 20 round indicators with tooltip
│       ├── MetaSidebar.tsx           <-- Score, tier, streak, faucet, top 5
│       └── ResultBanner.tsx          <-- Aria-live round resolution banner
├── lib/
│   ├── db/
│   │   ├── client.ts                 <-- Neon client connection
│   │   ├── schema.ts                 <-- Drizzle tables & relations
│   │   └── migrate-json-users.ts     <-- Migration script from .users-db.json
│   └── game/
│       ├── markets.ts                <-- BTC, ETH, SOL configuration
│       ├── pyth.ts                   <-- Hermes client & historical lookup
│       ├── rounds.ts                 <-- ensureRounds, lockTarget, settleDueRounds
│       ├── math.ts                   <-- Pure odds, payout, and parimutuel math
│       └── tiers.ts                  <-- Bronze -> Diamond tier levels
```

---

## 8. New Environment Variables

Add to `.env.example`:
```bash
# Neon Postgres Database URL
DATABASE_URL=postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# Secret token for protecting POST /api/cron/tick
CRON_SECRET=your_cron_secret_key_here
```

---

## 9. Order of Implementation

1. **Step 1: Security & Database Setup**
   - Untrack `.users-db.json` from git and add to `.gitignore`.
   - Install `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`.
   - Configure Drizzle schema and run initial migration.
   - Run migration script to transfer existing `.users-db.json` accounts into Postgres.
2. **Step 2: Backend Logic & Pure Math**
   - Implement `src/lib/game/markets.ts` with verified Pyth IDs.
   - Implement `src/lib/game/pyth.ts` and `GET /api/price`.
   - Implement `src/lib/game/math.ts` with unit tests (vitest).
   - Implement `src/lib/game/rounds.ts` (ensureRounds, lockTarget, settleDueRounds).
   - Implement `GET /api/rounds/current` and `GET /api/rounds/recent`.
3. **Step 3: Betting & Balance Ledger**
   - Implement `POST /api/bets` with atomic row lock (`FOR UPDATE`), balance checks, ledger writes.
   - Implement settlement payout distribution in transaction.
   - Add unit and integration tests for balance reconciliation.
4. **Step 4: Meta Layer (Score, Streak, Faucet, Leaderboard)**
   - Implement tier definitions and score progression.
   - Implement streak tracking based on UTC calendar day.
   - Implement `POST /api/faucet` and `GET /api/leaderboard`.
5. **Step 5: Frontend UI & Custom SVG Chart**
   - Build `/play` page matching the styling of Crash (`/crash`).
   - Implement `PriceChart` with custom responsive SVG, target dashed line, and gradient fill.
   - Wire real-time polling (1s interval) with serverTime offset calculation.
   - Build `/leaderboard` page.
6. **Step 6: Hardening & Validation**
   - Run lint, TypeScript type check, unit tests, and production build verification.
