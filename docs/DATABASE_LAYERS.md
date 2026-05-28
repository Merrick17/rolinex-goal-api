# Database layers

## Local PostgreSQL (this API — Prisma)

**Implemented today**

| Table | Purpose |
|-------|---------|
| `users` | Auth identity, cash balance, currency |
| `rounds` | Crash game rounds |
| `bets` | Crash bets |
| `transactions` | Ledger (deposits, bets, wins, withdrawals, …) |
| `refresh_tokens` | JWT refresh |
| `webhook_deliveries` | Idempotent PSP webhooks |

## Scope

This database currently serves crash-game features only (auth, wallet, rounds, bets, leaderboard, referrals, and payment webhooks).
