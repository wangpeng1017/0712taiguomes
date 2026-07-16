#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  git pull --ff-only origin main
fi
npm ci
npm run db:mysql:generate
npm run db:mysql:migrate
npm run db:process-bootstrap
npm run db:process-backfill
NEXT_PUBLIC_BASE_PATH=/taiguo-mes npm run build

if pm2 describe taiguo-mes >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --only taiguo-mes --update-env
else
  pm2 start ecosystem.config.cjs --only taiguo-mes
fi

pm2 save
