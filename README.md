# prolinex-goal-api

Backend API for the **ProlineX crash game**.

- Local PostgreSQL for game state, wallet, auth, and payments.
- SentinelGate card deposits + webhook processing.

## Docs

| Doc | Description |
|-----|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Current game architecture and request flow |
| [docs/DATABASE_LAYERS.md](docs/DATABASE_LAYERS.md) | Local schema ownership |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Deploy, env, webhooks |
| `Dockerfile` | Production container (migrations on start) |
| `.env.production.example` | Production env template |

Frontend architecture: `prolinexgoal/docs/ARCHITECTURE.md`

## Quick start

```bash
npm install
cp .env.example .env
# set DATABASE_URL, DIRECT_URL, JWT_* 
npm run migrate:deploy
npm run start:dev
```

- API: `http://localhost:3001`
- Swagger (dev): `http://localhost:3001/api/docs`
- Capabilities: `GET /api/health/capabilities`

## Implemented modules

- Auth, users, wallet (SentinelGate card deposits, withdraw queue)
- Crash game engine + Socket.IO
- Bets, rounds, leaderboard, referrals
- Admin

## Scripts

```bash
npm run start:dev
npm run build
npm run migrate:deploy   # apply Prisma migrations
npm run test             # unit tests
npm run test:integration # DB schema + wallet/bets flow (needs DATABASE_URL)
npm run test:e2e         # health endpoints
npm run test:all         # unit + integration + e2e
npm run seed:demo
```
