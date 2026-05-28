# Production operations guide

Checklist and reference for deploying **prolinex-goal-api** with payments, Redis scaling, and the game engine.

## Environment variables

Copy `.env.example` and set every value below before production. Never commit real secrets.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection (pooler URL for the app, e.g. Supabase `:6543?pgbouncer=true`) |
| `DIRECT_URL` | Yes (Prisma) | Direct PostgreSQL URL for migrations (`:5432`) |
| `JWT_SECRET` | Yes | Access token signing secret (long random string) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret (distinct from JWT_SECRET) |
| `PORT` | No | HTTP port (default `3001`) |
| `CORS_ORIGIN` | Yes | Comma-separated allowed origins (e.g. `https://app.example.com`) |
| **SentinelGate** | | [API Reference](https://github.com/SentinelGateLLC/SentinelgateDocumentation/blob/main/API_Reference.md) |
| `SENTINELGATE_API_KEY` | Prod card deposits | Merchant API key (`sg_key_...`) |
| `SENTINELGATE_API_SECRET` | With SentinelGate | Merchant API secret (`sg_secret_...`) |
| `SENTINELGATE_WEBHOOK_SECRET` | With SentinelGate | HMAC secret for `X-Sentinel-Signature` verification |
| `SENTINELGATE_SUCCESS_URL` | With SentinelGate | Redirect after successful payment |
| `SENTINELGATE_CANCEL_URL` | With SentinelGate | Redirect if customer cancels |
| `API_PUBLIC_URL` | With SentinelGate | Public API base (used to build `.../api/webhooks/sentinelgate`) |
| `SENTINELGATE_CALLBACK_URL` | Alt. to `API_PUBLIC_URL` | Full webhook URL if not using `API_PUBLIC_URL` |
| `SENTINELGATE_CURRENCY` | No | Override checkout currency (default **USD**; also GHS, KES, etc.) |
| `SENTINELGATE_BASE_URL` | No | API host (default `https://sentinelgate.biz`) |
| **Manual / provider webhooks** | | |
| `PAYMENT_WEBHOOK_SECRET` | Manual payouts | Shared secret for `X-Payment-Webhook-Secret` on internal payment webhooks |
| `PAYMENT_BASE_URL` | Manual deposits | Base URL for pending deposit payment links (`/pay/{transactionId}`) |
| `PAYMENT_SIMULATION_INSTANT` | Dev only | `true` = instant simulated deposit credit; **must be `false` in production** |
| **Scaling & game** | | |
| `REDIS_URL` | Multi-instance | Redis URL for Socket.IO adapter and BullMQ (e.g. `redis://host:6379`) |
| `GAME_ENGINE_ENABLED` | No | Set `false` to disable round lifecycle on this instance (API-only mode) |
| **Admin** | | |
| `ADMIN_API_KEY` | Admin routes | Key for `X-Admin-Key` on admin endpoints |

## Webhook URLs

Configure SentinelGate `callback_url` (set automatically from `API_PUBLIC_URL` or `SENTINELGATE_CALLBACK_URL`) to receive payment status updates.

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `POST /api/webhooks/sentinelgate` | SentinelGate payment events (`captured`, `failed`, `refunded`) | `X-Sentinel-Signature` header (HMAC-SHA256) |
| `POST /api/webhooks/payment/deposit-confirmed` | Manual/provider deposit success | `X-Payment-Webhook-Secret` |
| `POST /api/webhooks/payment/deposit-failed` | Manual/provider deposit failure | `X-Payment-Webhook-Secret` |
| `POST /api/webhooks/payment/withdraw-confirmed` | Payout provider confirms withdrawal sent | `X-Payment-Webhook-Secret` |
| `POST /api/webhooks/payment/withdraw-failed` | Payout provider reports withdrawal failure | `X-Payment-Webhook-Secret` |

Example production URLs (replace host):

```
https://api.example.com/api/webhooks/sentinelgate
https://api.example.com/api/webhooks/payment/deposit-confirmed
https://api.example.com/api/webhooks/payment/withdraw-confirmed
```

### Deposit flow (card)

1. User calls `POST /api/wallet/deposit` with `paymentMethod: "card"` → pending transaction + SentinelGate `redirect_url`.
2. Customer completes payment on SentinelGate hosted checkout.
3. SentinelGate POSTs to `callback_url` with status `captured` → balance credited.
4. Customer is redirected to `SENTINELGATE_SUCCESS_URL`.

### Withdraw flow (pending, no instant debit)

1. User calls `POST /api/wallet/withdraw` → creates a **pending** `withdraw` transaction; balance is **not** debited yet.
2. Ops or payout provider sends funds externally.
3. Provider calls `POST /api/webhooks/payment/withdraw-confirmed` with `{ eventId, transactionId }` → balance debited, transaction marked `completed`.
4. On failure, call `withdraw-failed` → transaction marked `failed`; balance unchanged.

Pending withdrawals reduce **available** balance so users cannot over-request while payouts are in flight.

## Local SentinelGate webhook testing

Expose your local API with [ngrok](https://ngrok.com) (or similar):

```bash
ngrok http 3001
```

Set in `.env`:

```env
SENTINELGATE_CALLBACK_URL=https://YOUR-NGROK-ID.ngrok-free.app/api/webhooks/sentinelgate
```

Use the same webhook secret SentinelGate provides as `SENTINELGATE_WEBHOOK_SECRET`.

Test cards (sandbox): `4111 1111 1111 1111` (approved), `4000 0000 0000 0002` (declined). See [SentinelGate API Reference](https://github.com/SentinelGateLLC/SentinelgateDocumentation/blob/main/API_Reference.md#testing).

For manual payment webhooks locally:

```bash
curl -X POST http://localhost:3001/api/webhooks/payment/deposit-confirmed \
  -H "Content-Type: application/json" \
  -H "X-Payment-Webhook-Secret: YOUR_PAYMENT_WEBHOOK_SECRET" \
  -d '{"eventId":"dev-deposit-001","transactionId":"<pending-deposit-tx-id>"}'
```

## Deploy checklist

1. Run migrations: `npm run migrate:deploy` (also runs on `npm run start:prod`).
2. Set `PAYMENT_SIMULATION_INSTANT=false`.
3. Configure SentinelGate API credentials and ensure `callback_url` is reachable over HTTPS.
4. Set strong `PAYMENT_WEBHOOK_SECRET` and `ADMIN_API_KEY` (≥ 32 random bytes).
5. Enable `REDIS_URL` when running more than one API instance or using the game WebSocket layer.
6. Restrict `CORS_ORIGIN` to your frontend origin(s) only.
7. Expose `/api/docs` only in non-production or protect it behind auth if needed.

## Security: rotate secrets

Rotate credentials on a schedule and immediately after any suspected leak.

| Secret | Where used | Rotation steps |
|--------|------------|----------------|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth tokens | Generate new values, deploy, invalidate old refresh tokens in DB if needed |
| `SENTINELGATE_API_KEY` / `SENTINELGATE_API_SECRET` | Hosted checkout | Rotate in SentinelGate merchant dashboard → update env → redeploy |
| `SENTINELGATE_WEBHOOK_SECRET` | Payment webhooks | Update in SentinelGate → update env |
| `PAYMENT_WEBHOOK_SECRET` | Manual webhooks | Update env and notify payout/deposit integrators |
| `ADMIN_API_KEY` | Admin API | Update env; revoke old key from any CI/scripts |
| Database password | `DATABASE_URL` / `DIRECT_URL` | Rotate in provider → update env → verify connectivity |

**General rules**

- Use separate secrets per environment (dev/staging/prod).
- Never log webhook secrets or `X-Sentinel-Signature` values.
- Prefer secret managers (Vercel env, AWS SSM, etc.) over plain files on servers.
- After rotation, redeploy all API instances so env is consistent.

## Health & observability

- `GET /health` — liveness/readiness probe target.
- OpenAPI: `/api/docs` and `/api/docs/json`.
- Monitor SentinelGate webhook delivery and `webhook_deliveries` idempotency (duplicate `eventKey` = safe replay).
