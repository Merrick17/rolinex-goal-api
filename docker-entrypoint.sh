#!/bin/sh
set -e

log() {
  echo "[entrypoint] $*"
}

# Render / Docker inject DATABASE_URL at runtime — never rely on build-time placeholders.
if [ -z "$DIRECT_URL" ] && [ -n "$DATABASE_URL" ]; then
  export DIRECT_URL="$DATABASE_URL"
fi

if [ -z "$DATABASE_URL" ] && [ -z "$DIRECT_URL" ]; then
  log "ERROR: DATABASE_URL (or DIRECT_URL) is not set — cannot run migrations."
  log ""
  log "Fix on Render (required once per web service):"
  log "  1. Dashboard → your API web service → Environment"
  log "  2. Add Environment Variable → Add from database → select Postgres (prolinex-db)"
  log "  3. Key: DATABASE_URL  (Render fills the internal connection string)"
  log "  4. Optional: add DIRECT_URL the same way, or leave unset (entrypoint copies DATABASE_URL)"
  log "  5. Save → Manual Deploy"
  log ""
  log "If you used Blueprint: Environment → Blueprint sync, or recreate the stack from render.yaml"
  log "so fromDatabase links prolinex-db → DATABASE_URL."
  log ""
  if [ -n "$RENDER" ]; then
    log "(Running on Render: RENDER=$RENDER — DB link is missing from this service config.)"
  fi
  exit 1
fi

# Render Postgres often requires SSL on external URLs; harmless if already present.
append_ssl_if_needed() {
  url="$1"
  case "$url" in
    *sslmode=*|*ssl=*|"")
      printf '%s' "$url"
      ;;
    *)
      case "$url" in
        *\?*) printf '%s&sslmode=require' "$url" ;;
        *) printf '%s?sslmode=require' "$url" ;;
      esac
      ;;
  esac
}

if [ -n "$DATABASE_URL" ]; then
  export DATABASE_URL="$(append_ssl_if_needed "$DATABASE_URL")"
fi
if [ -n "$DIRECT_URL" ]; then
  export DIRECT_URL="$(append_ssl_if_needed "$DIRECT_URL")"
fi

PRISMA_BIN="/app/node_modules/.bin/prisma"
if [ ! -x "$PRISMA_BIN" ]; then
  PRISMA_BIN="npx prisma"
fi

run_migrations() {
  log "Applying database migrations..."
  $PRISMA_BIN migrate deploy
}

if [ -n "$SKIP_MIGRATIONS" ] && [ "$SKIP_MIGRATIONS" = "true" ]; then
  log "SKIP_MIGRATIONS=true — skipping prisma migrate deploy"
else
  max_attempts="${MIGRATE_MAX_ATTEMPTS:-30}"
  attempt=1
  while [ "$attempt" -le "$max_attempts" ]; do
    if run_migrations; then
      log "Migrations applied successfully."
      break
    fi
    if [ "$attempt" -eq "$max_attempts" ]; then
      log "ERROR: migrate deploy failed after $max_attempts attempts."
      $PRISMA_BIN migrate status || true
      exit 1
    fi
    log "Migration attempt $attempt failed — database may still be starting. Retrying in 3s..."
    sleep 3
    attempt=$((attempt + 1))
  done
fi

exec node dist/src/main.js
