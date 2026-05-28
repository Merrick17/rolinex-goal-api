# ProlineX unified backend architecture

**Repository:** `prolinex-goal-api` (NestJS)  
**Role:** API for the ProlineX crash game.

There is **no separate** Fastify service in this monorepo. This API is the one backend to extend.

## Layered model

```
┌─────────────────────────────────────────────────────────────┐
│  ProlineX web / mobile (Next.js, etc.)                       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS + JWT
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  prolinex-goal-api (BFF)                                     │
│  • Auth & sessions (local)                                   │
│  • Crash game engine + Socket.IO (local, authoritative)      │
│  • Game wallet: cash balance (local DB)                      │
│  • Payments: SentinelGate, webhooks (local)                  │
└──────────────┬──────────────────────────────┬─────────────────┘
               │                             │
               ▼                             ▼
   ┌───────────────────────┐     ┌───────────────────────────┐
   │  Local PostgreSQL      │     │  External integrations     │
   │  (Prisma)              │     │  • SentinelGate PSP        │
   │  Game data             │     │                             │
   └───────────────────────┘     └───────────────────────────┘
```

## What lives where

| Concern | Owner |
|--------|-------|
| Crash rounds, multiplier, fairness seeds | **Local DB + game engine** |
| Crash bets / cashouts | **Local DB** |
| Login, JWT, refresh tokens | **Local DB** |
| Card deposits | **SentinelGate** → local `balance` |
| Withdrawals | **Local pending + webhooks** |

## Player wallet rules (product)

All registered players use a **single cash wallet** (USD default):

| Action | How |
|--------|-----|
| Play | Deduct / credit `balance` |
| Deposit | Card via SentinelGate (`POST /wallet/deposit` `paymentMethod: "card"`) |
| Withdraw | `POST /wallet/withdraw` (queued; confirm via payout webhook when configured) |

## API surface (current)

| Prefix | Module | Notes |
|--------|--------|-------|
| `/api/auth` | Auth | Register, login, refresh, logout |
| `/api/users` | Users | Profile |
| `/api/wallet` | Wallet | Balance, deposit, withdraw, transactions |
| `/api/webhooks/sentinelgate` | Wallet | PSP callbacks |
| `/api/webhooks/payment/*` | Wallet | Manual payout/deposit confirm |
| `/api/rounds` | Rounds | Crash round state |
| `/api/bets` | Bets | Place / cashout |
| `/api/leaderboard` | Leaderboard | |
| `/api/referrals` | Referrals | |
| `/api/admin` | Admin | Ops |
| `/api/health` | Health | Liveness + readiness + **capabilities** |
| Socket.IO | Game | Real-time round events |

## Code layout

```
src/
  auth/
  users/
  wallet/               # balance, SentinelGate, webhooks
  bets/
  rounds/
  game/                 # engine + gateway
  platform/             # capability flags for health endpoint
```

## Environment (payments)

| Variable | Purpose |
|----------|---------|
| `SENTINELGATE_API_KEY` | Hosted checkout |
| `SENTINELGATE_API_SECRET` | API auth |
| `SENTINELGATE_WEBHOOK_SECRET` | Webhook HMAC |
| `API_PUBLIC_URL` | Callback base |
| `SENTINELGATE_SUCCESS_URL` / `CANCEL_URL` | Browser return URLs |

## Scope

This repository is currently scoped to the crash game product only.
