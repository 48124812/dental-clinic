#!/bin/sh
set -eu

# Render Free does not provide a pre-deploy command. Opt in to migration at
# startup there; local Compose continues to use its dedicated migrate job.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  node /app/node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma
fi

# The public Render demo uses idempotent upserts so a newly provisioned
# database has content immediately. Keep this opt-in: production systems
# should load real clinic data through an admin process instead.
if [ "${RUN_SAMPLE_SEED:-false}" = "true" ]; then
  node --import tsx prisma/seed.ts
fi

exec node dist/server.js
