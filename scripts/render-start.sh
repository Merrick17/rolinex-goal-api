#!/bin/sh
set -e
cd "$(dirname "$0")/.."
sh scripts/render-migrate.sh
exec node dist/src/main.js
