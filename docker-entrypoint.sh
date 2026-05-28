#!/bin/sh
set -e

if [ -z "$DIRECT_URL" ] && [ -n "$DATABASE_URL" ]; then
  export DIRECT_URL="$DATABASE_URL"
fi

if [ -n "$DIRECT_URL" ] || [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Applying database migrations..."
  npx prisma migrate deploy
fi

exec node dist/src/main.js
