# Booking consistency and PostgreSQL verification

## Invariant and root cause

For a given doctor and exact `startsAt` timestamp, at most one appointment may have a status other than `CANCELLED`. `BOOKED`, `CHECKED_IN`, and `NO_SHOW` all reserve the slot. Cancelling preserves the original row, reference code, and email-delivery history; the next booking gets a new identity.

Previously availability excluded cancelled appointments, but `Appointment_doctorId_startsAt_key` included every row. The UI therefore advertised a slot that PostgreSQL rejected. Application prechecks alone cannot arbitrate concurrent inserts.

The new migration `20260920000000_active_appointment_slot_unique` uses database-level concurrency protection:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE UNIQUE INDEX "Appointment_active_doctorId_startsAt_key"
ON "Appointment" ("doctorId", "startsAt")
WHERE "status" <> 'CANCELLED'::"AppointmentStatus";
DROP INDEX "Appointment_doctorId_startsAt_key";
COMMIT;
```

The original migration creates a standalone unique index, not a named table constraint. The stricter old index remains until the new index exists. Both DDL operations commit atomically; no data is deleted or rewritten. Unique conflicts continue through the existing Prisma `P2002` to HTTP `409` mapping. Appointment and outbox writes remain transactional.

## Deployment and recovery

1. Back up the target database using the deployment environment's existing process. Verify the old migrations are applied with `pnpm --filter @dental-clinic/api exec prisma migrate status` against the explicitly selected environment.
2. Pause booking, cancellation, and Staff writes (including old API replicas). This migration uses ordinary `CREATE UNIQUE INDEX`, which blocks writes while scanning; it is not a zero-downtime migration. The configured timeouts bound waiting/execution and may need a separately reviewed strategy for large tables.
3. Run `pnpm --filter @dental-clinic/api db:migrate:deploy`, or the separate SHA-tagged migration Job described in the [Kubernetes guide](06-kubernetes-deployment.md).
4. Deploy the matching API revision with the Staff transition guard, check `/ready`, and inspect the index below before resuming writes. Migrating without replacing an old Staff API can allow that old code to reactivate cancelled records when no replacement exists.
5. Use synthetic demo records to cancel/rebook and confirm old history remains. Do not run seeds or the integration suite against a real patient database.

If DDL fails or times out, the transaction rolls back both index changes. Prisma may retain a failed migration record: keep writes paused, inspect the failure and actual indexes, and only after confirming rollback use `prisma migrate resolve --rolled-back 20260920000000_active_appointment_slot_unique` followed by `migrate deploy`. Do not mark a partially inspected database as applied. This failure-recovery procedure has not been fault-injection tested.

Do not recreate the old unconditional index as an automatic rollback: valid cancellation/rebooking history now contains duplicate doctor/time pairs. Prefer a reviewed forward repair while preserving history.

## Prisma representation and drift

The pinned Prisma 6.19.3 schema cannot represent this partial unique index; `@@unique([doctorId, startsAt])` is removed and replaced by a schema comment pointing to SQL. Existing migrations remain unchanged. Use migration history to create databases, not `db push` or schema-only SQL generation: those paths do not establish this invariant.

The suite replays migrations into a shadow database and compares both fresh/upgraded databases to migration history and the Prisma schema (`migrate diff --exit-code`). It also verifies migration checksums and explicitly checks the partial index's keys, predicate, uniqueness, validity and readiness. Prisma-visible diff alone can miss unsupported database objects.

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'Appointment';

SELECT indisunique, indisvalid, indisready, pg_get_expr(indpred, indrelid)
FROM pg_index
WHERE indexrelid = '"Appointment_active_doctorId_startsAt_key"'::regclass;
```

Future migrations and Prisma upgrades must retain this custom index and rerun the integration suite. No current Prisma-visible drift was detected; that does not eliminate future drift risk. See [Prisma 6 unsupported database features](https://docs.prisma.io/docs/orm/v6/prisma-migrate/workflows/unsupported-database-features) and [PostgreSQL partial uniqueness](https://www.postgresql.org/docs/16/ddl-constraints.html).

## Staff transition policy

| Source | Requested Staff target | Result |
| --- | --- | --- |
| BOOKED / CHECKED_IN / NO_SHOW | CHECKED_IN or NO_SHOW | Allowed, including attendance corrections and repeated status |
| CANCELLED | CHECKED_IN or NO_SHOW | 409, no appointment or audit write |
| Any | BOOKED, CANCELLED, unknown value | 400 validation error |
| Missing appointment | Valid target | 404 |
| State changed since the Staff read | Valid target | 409; refresh before retrying |

The update uses `WHERE id = ... AND status = previously_read_status` within the audit transaction. If cancellation commits first, the conditional update affects zero rows and raises a typed conflict instead of restoring the record. If the Staff update wins first, subsequent cancellation still leaves the record cancelled. Attendance correction semantics are preserved; cancellation eligibility remains the existing 24-hour rule.

## Reproducible tests

From the repository root, with Node.js, pnpm, and Docker Engine available:

```powershell
pnpm test
pnpm test:integration
```

The second command builds the existing API Dockerfile's builder stage, starts PostgreSQL 16 on a uniquely named internal network, creates fresh/upgrade/shadow databases, and runs Fastify `inject()` against real Prisma services. It publishes no host ports, does not forward host environment files, and uses only synthetic records. Trust authentication is confined to this disposable internal network. Database storage is tmpfs; the runner cleans up its own containers (including anonymous volumes), network, and temporary image in `finally`, including test-failure paths. Docker build cache/base images are retained. Forced process termination or Docker failure can require removal of the printed uniquely named resources; never run a blanket prune to clean this suite.

The email sender alone is replaced, so no messages leave the test. Every booking test clears its fixtures; migration tests use a separate upgrade database. The clock-dependent appointment is fixed in year 2100, beyond the cancellation cutoff. A real PostgreSQL row lock and `pg_stat_activity` wait observation control the Staff/cancel interleaving without sleeps or mocked persistence. The original HTTP tests continue to use a frozen clock for precise 24-hour boundaries.

The 11 cases cover fresh migrations and idempotent redeploy; three cancellation/rebooking cycles with retained rows and distinct identities; all three active statuses; different doctors; two batches of eight concurrent requests; Staff restoration attempts before/after replacement; cancellation racing with Staff; attendance corrections and unknown IDs; upgrade from both historical migrations with existing rows; checksums, index health, and schema/history comparisons.

Each concurrent batch must return exactly one `201` and seven `409`, with one effective appointment. Failed inserts must not leave extra booking outbox entries. These are bounded local correctness tests, not capacity, browser E2E, HPA, or distributed recovery verification. The new suite is an explicit local command; the existing CI workflow is unchanged.
