# Render — get the API working

## One-time: Blueprint (recommended)

1. [Render](https://dashboard.render.com/) → **New** → **Blueprint**
2. Repo: **Merrick17/rolinex-goal-api**
3. Apply — creates **prolinex-db** + **prolinex-goal-api** with `DATABASE_URL` linked
4. Wait until **Live**
5. **Shell** on the web service:

```bash
npm run seed:demo
```

## Manual service (if Blueprint already exists)

### Docker runtime (your current setup)

| Setting | Value |
|---------|--------|
| **Runtime** | Docker |
| **Dockerfile path** | `./Dockerfile` (repo root) |
| **Health check** | `/api/health` |

### Node runtime (alternative)

| Setting | Value |
|---------|--------|
| **Runtime** | Node |
| **Build** | `npm ci && npm run build` |
| **Pre-deploy** | `sh scripts/render-migrate.sh` |
| **Start** | `node dist/src/main.js` |
| **Health check** | `/api/health` |

**Environment** (required):

| Key | How |
|-----|-----|
| `DATABASE_URL` | **Add from database** → your Postgres |
| `DIRECT_URL` | Same as `DATABASE_URL` (or leave empty) |
| `NODE_ENV` | `production` |
| `DEPLOY_PROFILE` | `public-test` |
| `CORS_ORIGIN` | `https://prolinexgoal.vercel.app` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Generate (32+ chars) |

`API_PUBLIC_URL` is auto-set from `RENDER_EXTERNAL_URL` when missing.

## Verify

```bash
curl https://YOUR-SERVICE.onrender.com/api/health
curl https://YOUR-SERVICE.onrender.com/api/health/ready
```

Login: `demo@prolinexgoal.demo` / `DemoGoal26!` (after seed)

## Frontend (Vercel)

```env
NEXT_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com/api
NEXT_PUBLIC_WS_URL=https://YOUR-SERVICE.onrender.com
```

Redeploy Vercel after changing `NEXT_PUBLIC_*`.
