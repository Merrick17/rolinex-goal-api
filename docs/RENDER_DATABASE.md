# Render: fix “DATABASE_URL is not set”

The API Docker image **does not** embed a database URL. Render must inject `DATABASE_URL` at runtime.

## Quick fix (existing web service)

1. Open [Render Dashboard](https://dashboard.render.com/)
2. Open your **Postgres** instance (`prolinex-db` or similar) — note that it exists and is **Available**
3. Open your **Web Service** (`prolinex-goal-api`)
4. Go to **Environment**
5. Click **Add Environment Variable** → **Add from database**
6. Select your Postgres database
7. Set the key to **`DATABASE_URL`** (Render sets the value to the internal URL)
8. Click **Save Changes**
9. **Manual Deploy** the web service

`DIRECT_URL` is optional; the entrypoint copies `DATABASE_URL` into `DIRECT_URL` when it is missing.

## Also set (if not already)

| Variable | Example |
|----------|---------|
| `CORS_ORIGIN` | `https://prolinexgoal.vercel.app` |
| `API_PUBLIC_URL` | `https://YOUR-SERVICE.onrender.com` |
| `SENTINELGATE_SUCCESS_URL` | `https://prolinexgoal.vercel.app/wallet/deposit/success` |
| `SENTINELGATE_CANCEL_URL` | `https://prolinexgoal.vercel.app/wallet/deposit/cancel` |

## New stack from Blueprint

1. **New** → **Blueprint**
2. Connect repo `Merrick17/rolinex-goal-api`
3. Apply `render.yaml` (creates DB + web service with `DATABASE_URL` linked)
4. Fill sync env vars when prompted (`CORS_ORIGIN`, `API_PUBLIC_URL`, …)

## After a successful deploy

Render **Shell** on the web service:

```bash
npx ts-node prisma/seed-demo.ts
```

Demo login: `demo@prolinexgoal.demo` / `DemoGoal26!`
