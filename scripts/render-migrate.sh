#!/bin/sh
set -e

log() {
  echo "[render-migrate] $*"
}

if [ -z "$DIRECT_URL" ] && [ -n "$DATABASE_URL" ]; then
  export DIRECT_URL="$DATABASE_URL"
fi

if [ -z "$DATABASE_URL" ] && [ -z "$DIRECT_URL" ]; then
  log "ERROR: DATABASE_URL is not set."
  log "Render → Web Service → Environment → Add from database → key DATABASE_URL"
  exit 1
fi

# External Render Postgres URLs need SSL; internal dpg-* hostnames do not.
maybe_ssl() {
  url="$1"
  case "$url" in
    ""|*sslmode=*|*@dpg-*|*@localhost*|*@127.0.0.1*)
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
  export DATABASE_URL="$(maybe_ssl "$DATABASE_URL")"
fi
if [ -n "$DIRECT_URL" ]; then
  export DIRECT_URL="$(maybe_ssl "$DIRECT_URL")"
fi

PRISMA_BIN="./node_modules/.bin/prisma"
if [ ! -x "$PRISMA_BIN" ]; then
  PRISMA_BIN="npx prisma"
fi

if [ -n "$SKIP_MIGRATIONS" ] && [ "$SKIP_MIGRATIONS" = "true" ]; then
  log "SKIP_MIGRATIONS=true"
  exit 0
fi

max_attempts="${MIGRATE_MAX_ATTEMPTS:-30}"
attempt=1
while [ "$attempt" -le "$max_attempts" ]; do
  log "Applying migrations (attempt $attempt/$max_attempts)..."
  if $PRISMA_BIN migrate deploy; then
    log "Migrations OK."
    exit 0
  fi
  if [ "$attempt" -eq "$max_attempts" ]; then
    log "ERROR: migrate deploy failed."
    $PRISMA_BIN migrate status || true
    exit 1
  fi
  sleep 3
  attempt=$((attempt + 1))
done
