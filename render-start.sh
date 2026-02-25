#!/usr/bin/env bash

echo "==> Environment check..."
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"
echo "JWT_SECRET set: $([ -n "$JWT_SECRET" ] && echo YES || echo NO)"
echo "JWT_REFRESH_SECRET set: $([ -n "$JWT_REFRESH_SECRET" ] && echo YES || echo NO)"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"

echo "==> Syncing database schema..."
cd apps/api
npx prisma db push --accept-data-loss || echo "WARNING: db push failed, continuing..."

echo "==> Seeding database..."
node dist/prisma/seed.js || echo "Seed skipped (may already exist)"

echo "==> Starting API server on port 4000..."
PORT=4000 node dist/main.js > /tmp/api.log 2>&1 &
API_PID=$!

echo "==> Waiting for API to be ready (PID: $API_PID)..."
sleep 5

if kill -0 $API_PID 2>/dev/null; then
  echo "==> API is running!"
else
  echo "==> ERROR: API crashed! Logs:"
  cat /tmp/api.log
  echo "==> Attempting to start anyway..."
fi

echo "==> Starting Web server on port ${PORT:-10000}..."
cd ../web
npx next start -p ${PORT:-10000}
