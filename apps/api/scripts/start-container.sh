#!/bin/sh
set -eu

# Render Free does not provide a pre-deploy command. Opt in to migration at
# startup there; local Compose continues to use its dedicated migrate job.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  node /app/node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma
fi

exec node dist/server.js
