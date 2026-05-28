# Render deployment (API)

## Why deploys failed

1. **`DATABASE_URL` missing** — Postgres was not linked to the web service (common when using Docker without Blueprint env).
2. **Root `Dockerfile` auto-detected** — Render built Docker instead of using `render.yaml` Node settings, so `fromDatabase` env vars were never applied.
3. **Invalid blueprint property** — `internalConnectionString` is not valid; use `connectionString` (private network URL).

## Recommended fix (cleanest)

### Option A — New Blueprint (best)

1. Delete the old **Docker** web service on Render (keep Postgres if you want the data).
2. [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
3. Connect **Merrick17/rolinex-goal-api**
4. When prompted, set:
   - `CORS_ORIGIN` = `https://prolinexgoal.vercel.app`
   - `API_PUBLIC_URL` = `https://<your-service>.onrender.com`
   - `SENTINELGATE_SUCCESS_URL` / `SENTINELGATE_CANCEL_URL` = your Vercel wallet URLs
5. Wait for deploy (migrations run via `npm run start:render`).
6. **Shell**: `npx ts-node prisma/seed-demo.ts`

### Option B — Keep existing web service

1. **Environment** → **Add Environment Variable** → **Add from database**
2. Select Postgres → key **`DATABASE_URL`**
3. **Settings** → change **Runtime** from Docker to **Node**
4. Set:
   - **Build command**: `npm ci && npm run build`
   - **Start command**: `npm run start:render`
5. **Save** → **Manual Deploy**

Do **not** set `PORT` manually — Render injects it.

## Verify

Logs should show:

```text
[render-migrate] Applying migrations...
[render-migrate] Migrations OK.
Application is running on: http://localhost:10000
```

Health: `https://YOUR-SERVICE.onrender.com/api/health/ready`

## Demo user

`demo@prolinexgoal.demo` / `DemoGoal26!`
