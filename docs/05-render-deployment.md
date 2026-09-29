# Phase 7 - Render deployment

`render.yaml` manages the Fastify API and Next.js Web services in Singapore.
Create the demo PostgreSQL database separately and set API `DATABASE_URL` in
the Dashboard. The Blueprint uses `sync: false` for that secret, so a future
sync does not restore a connection to an expired database. Removing the old
database definition does not delete the existing database.

For the 2026-10-01 expiry and a fresh synthetic-data replacement, follow
[免費 PostgreSQL 換庫流程](13-render-database-replacement.md). Do not recreate
the Web/API services; their existing public URLs should remain in use.

## Create the Blueprint

For an existing database receiving the partial unique index migration, first
follow [Booking consistency: deployment and recovery](12-booking-consistency.md#deployment-and-recovery).
The operator must confirm the target service/database, backup, and maintenance
window before triggering deployment. Verify that non-CANCELLED doctor/time pairs
are unique; an intact old unique index guarantees this, otherwise perform a
read-only data/index check first. Do not print patient fields.

Pause booking, cancellation, and Staff writes, including traffic to old instances,
before migration. The old Staff API can reactivate cancelled records. Creating
the index can block writes; this is not a zero-downtime upgrade. This requirement
is the same as the Kubernetes deployment guide, even though Render executes
migration from the new container's startup script. A startup script does not
automatically stop old instances from receiving writes.

Coordinate automatic deployment so that it cannot bypass this maintenance window.
Only resume writes after migration succeeds, the compatible API is ready, the
index is verified, and old instances no longer serve traffic. If migration fails,
keep writes paused, inspect its status and actual indexes, and follow the linked
recovery procedure. Do not repeatedly redeploy or manually edit migration history.
The steps below provision services; they do not implement a maintenance gate.

1. Make the reviewed deployment changes available on the deployment branch.
   Create the database separately and wait for it to become Available.
2. In the Render Dashboard, select **New > Blueprint**.
3. Choose `48124812/dental-clinic`, set branch to `main`, and keep the default
   Blueprint path: `render.yaml`.
4. Review the two web services, supply `DATABASE_URL` privately, and select **Apply**.
5. Wait for the API, web service, and database to show **Live**.

## Verify

Open the URL shown for `dental-clinic-web`, then verify:

```text
https://<dental-clinic-api>.onrender.com/health
https://<dental-clinic-api>.onrender.com/ready
```

The API runs `prisma migrate deploy` from its container startup script before
starting Fastify because Render's pre-deploy command is a paid feature.

`RUN_SAMPLE_SEED` defaults to `false`. Temporarily set it to `true` only for a
new empty demo database, then return it to `false` after initialization.
The seed acquires transaction-scoped table locks, checks all application tables,
and inserts the synthetic catalog atomically only if they are all empty.
Existing data makes it skip the entire seed; it never overwrites rows or repairs
partial catalogs. A failed seed rolls back and exits nonzero, preventing startup.
Do not enable bootstrap while accepting application writes. This is a portfolio
demo, not a real-patient deployment procedure.

## Continuous deployment

Both services automatically rebuild and deploy after a commit reaches `main`.
GitHub Actions remains the CI gate before merging.

## Free-plan caveats

Free web services spin down after idle time. The free PostgreSQL instance
expires after 30 days and has no backups. Treat this as a portfolio demo.
