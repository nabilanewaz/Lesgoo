#!/bin/sh
# Container start: bring the database schema up to date, add the demo cast, start the API.
set -e

echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

# The seed only upserts (safe to run on every start). Set SEED_DEMO_DATA=false to skip it.
if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  echo "Seeding the Banani cast..."
  node dist/seed/seed.js
fi

exec node dist/server.js
