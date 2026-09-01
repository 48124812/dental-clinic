# Phase 5 — Containerization

## Goal

Run the production-shaped application locally as three independently built
services: Next.js web, Fastify API, and PostgreSQL. Configuration stays outside
the images and the database schema is migrated before the API accepts traffic.

## Architecture

```text
Browser → web :3000 → API :3001 → Postgres :5432
                    ↑
          migrate job runs first
```

- `web` is a multi-stage Next.js standalone image.
- `api` is the existing multi-stage Fastify image.
- `postgres` owns its data through the `postgres-data` named volume.
- `migrate` runs `prisma migrate deploy` after PostgreSQL becomes healthy; the
  API waits for that one-off job to succeed.
- Each long-running service has a health check. `/health` is liveness, while
  `/ready` is available for readiness checks that must include the database.

## Run locally

1. Start Docker Desktop and wait until its engine is running.
2. Create the local configuration once: `Copy-Item .env.example .env`.
3. Build and start the full stack: `docker compose up --build -d`.
4. Check all services: `docker compose ps`.
5. Visit `http://localhost:3000`; API health is at
   `http://localhost:3001/health`.

Useful commands:

```powershell
docker compose logs -f migrate api web
docker compose down
docker compose down -v # removes the local PostgreSQL data volume
```

`NEXT_PUBLIC_API_URL` is intentionally a build argument because Next.js embeds
public variables into the browser bundle. Set it to the public API URL before
building a deployment image; it cannot be changed only by restarting the web
container.

## Verification

```powershell
pnpm --filter @dental-clinic/web typecheck
pnpm --filter @dental-clinic/web build
docker compose config
docker compose up --build -d
docker compose ps
```

The last two commands require Docker Desktop to be running.
