#!/bin/sh
set -eu

# Render Free does not provide a pre-deploy command. Opt in to migration at
# startup there; local Compose continues to use its dedicated migrate job.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  node /app/node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma
fi

# Temporarily opt in only to initialize a new, empty demo database.
# The seed transaction skips any populated database and never updates rows.
# Set this flag back to false after bootstrap; restarts must not seed normally.
if [ "${RUN_SAMPLE_SEED:-false}" = "true" ]; then
  node --import tsx prisma/seed.ts
fi

exec node dist/server.js
