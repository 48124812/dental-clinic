import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Only external email IO is replaced. HTTP handlers, services, transactions and PostgreSQL are real.
vi.mock('../services/email.service.js', () => ({ deliverEmailDelivery: vi.fn().mockResolvedValue(undefined) }));
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

const url = process.env.DATABASE_URL ?? '';
if (process.env.INTEGRATION_TEST !== 'disposable-docker' || url !== 'postgresql://postgres@db:5432/dental_integration') {
  throw new Error('Run through pnpm test:integration; only the disposable Docker database is allowed.');
}
const upgradeUrl = url.replace('dental_integration', 'dental_upgrade');
const upgrade = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
const schema = join(process.cwd(), 'prisma/schema.prisma');
const migrations = join(process.cwd(), 'prisma/migrations');
const newMigration = '20260920000000_active_appointment_slot_unique';
function cli(args: string[], databaseUrl = url) {
  return execFileSync(process.execPath, ['/repo/node_modules/prisma/build/index.js', ...args], {
    env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', timeout: 45000,
  });
}
const doctorData = { name: 'Synthetic Doctor', title: 'Demo', specialties: [], credentials: [], bioMd: 'Synthetic fixture' };
const payload = { doctorId: 'doctor-a', startsAt: '2100-01-03T01:00:00.000Z', patientName: 'Synthetic Patient',
  patientPhone: '0000005678', nationalHealthId: 'SYNTHETIC', patientEmail: 'fixture@example.invalid' };
const app = await buildApp();
const book = (doctorId = payload.doctorId) => app.inject({ method: 'POST', url: '/api/appointments', payload: { ...payload, doctorId } });
const cancel = (reference: string) => app.inject({ method: 'POST', url: `/api/appointments/${reference}/cancel`, payload: { phoneLast4: '5678' } });
const attendance = (id: string, status: string) => app.inject({ method: 'PATCH', url: `/api/staff/appointments/${id}/status`,
  headers: { authorization: 'Bearer synthetic-integration-staff-token' }, payload: { status } });

beforeAll(() => { cli(['migrate', 'deploy', '--schema', schema]); });
beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.doctor.createMany({ data: ['doctor-a', 'doctor-b'].map((id) => ({ ...doctorData, id })) });
});
afterAll(async () => { await app.close(); await prisma.$disconnect(); await upgrade.$disconnect(); });

async function assertIndex(client: PrismaClient) {
  const indexes = await client.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Appointment'`;
  expect(indexes.some((index) => index.indexname === 'Appointment_doctorId_startsAt_key')).toBe(false);
  const active = indexes.find((index) => index.indexname === 'Appointment_active_doctorId_startsAt_key');
  expect(active?.indexdef).toContain('UNIQUE INDEX');
  expect(active?.indexdef).toContain('("doctorId", "startsAt")');
  expect(active?.indexdef).toContain(`WHERE (status <> 'CANCELLED'::"AppointmentStatus")`);
  const health = await client.$queryRaw<{ indisvalid: boolean; indisready: boolean }[]>`
    SELECT indisvalid, indisready FROM pg_index
    WHERE indexrelid = '"Appointment_active_doctorId_startsAt_key"'::regclass`;
  expect(health).toEqual([{ indisvalid: true, indisready: true }]);
}

function assertNoDrift(databaseUrl: string) {
  cli(['migrate', 'diff', '--from-migrations', migrations, '--to-url', databaseUrl,
    '--shadow-database-url', url.replace('dental_integration', 'dental_shadow'), '--exit-code']);
  cli(['migrate', 'diff', '--from-url', databaseUrl, '--to-schema-datamodel', schema, '--exit-code']);
}

describe('real PostgreSQL booking invariants', () => {
  it('applies all migrations to an empty database and preserves the partial index on redeploy', async () => {
    await assertIndex(prisma);
    expect(cli(['migrate', 'deploy', '--schema', schema])).toContain('No pending migrations');
    expect(cli(['migrate', 'status', '--schema', schema])).toContain('up to date');
    await assertIndex(prisma);
  });

  it('retains history and unique identities across three cancel/rebook cycles', async () => {
    const ids = new Set<string>();
    const references = new Set<string>();
    for (let cycle = 0; cycle < 3; cycle++) {
      const result = await book();
      expect(result.statusCode).toBe(201);
      const row = result.json();
      ids.add(row.id); references.add(row.referenceCode);
      expect((await cancel(row.referenceCode)).statusCode).toBe(200);
      const availability = await app.inject('/api/appointments/availability?doctorId=doctor-a&date=2100-01-03');
      expect(availability.json().find((slot: { startsAt: string }) => slot.startsAt === payload.startsAt).available).toBe(true);
      expect(await prisma.appointment.findUnique({ where: { id: row.id } })).toMatchObject({ status: 'CANCELLED', cancelledAt: expect.any(Date) });
    }
    const replacement = await book();
    expect(replacement.statusCode).toBe(201);
    ids.add(replacement.json().id); references.add(replacement.json().referenceCode);
    expect(ids.size).toBe(4); expect(references.size).toBe(4);
    expect(await prisma.appointment.count()).toBe(4);
    expect(await prisma.appointment.count({ where: { status: { not: 'CANCELLED' } } })).toBe(1);
  });

  it.each(['BOOKED', 'CHECKED_IN', 'NO_SHOW'] as const)('reserves slots for %s and permits another doctor', async (status) => {
    const row = (await book()).json();
    if (status !== 'BOOKED') expect((await attendance(row.id, status)).statusCode).toBe(200);
    expect((await book()).statusCode).toBe(409);
    expect((await book('doctor-b')).statusCode).toBe(201);
  });

  it('arbitrates eight concurrent HTTP requests, including after cancellation', async () => {
    for (let round = 0; round < 2; round++) {
      const results = await Promise.all(Array.from({ length: 8 }, () => book()));
      expect(results.filter((result) => result.statusCode === 201)).toHaveLength(1);
      expect(results.filter((result) => result.statusCode === 409)).toHaveLength(7);
      expect(await prisma.appointment.count({ where: { status: { not: 'CANCELLED' } } })).toBe(1);
      const winner = results.find((result) => result.statusCode === 201)!.json();
      expect((await cancel(winner.referenceCode)).statusCode).toBe(200);
    }
    expect(await prisma.appointment.count()).toBe(2);
    expect(await prisma.emailDelivery.count({ where: { kind: 'BOOKING_CONFIRMATION' } })).toBe(2);
  });

  it('rejects staff restoration before and after rebooking without writing an audit entry', async () => {
    const old = (await book()).json();
    expect((await cancel(old.referenceCode)).statusCode).toBe(200);
    for (const replacement of [false, true]) {
      if (replacement) expect((await book()).statusCode).toBe(201);
      expect((await attendance(old.id, 'BOOKED')).statusCode).toBe(400);
      for (const status of ['CHECKED_IN', 'NO_SHOW']) {
        const result = await attendance(old.id, status);
        expect(result.statusCode).toBe(409);
        expect(result.json().error).toContain('Cancelled');
      }
    }
    expect(await prisma.auditLog.count()).toBe(0);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe('CANCELLED');
  });

  it('rejects a staff update whose initial read preceded a concurrent cancellation', async () => {
    const old = (await book()).json();
    await prisma.user.create({ data: { email: 'staff@local.invalid', passwordHash: 'synthetic', role: 'STAFF' } });
    let markLocked!: () => void;
    let resume!: () => void;
    const locked = new Promise<void>((resolve) => { markLocked = resolve; });
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    // A real row lock blocks staffActor's upsert after its appointment read.
    const blocker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE email = 'staff@local.invalid' FOR UPDATE`;
      markLocked();
      await gate;
    }, { timeout: 15000 });
    await locked;
    const pending = attendance(old.id, 'CHECKED_IN').then((result) => result);
    try {
      await expect.poll(async () => {
        const rows = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
          AND wait_event_type = 'Lock' AND query LIKE '%"User"%'`;
        return Number(rows[0]?.count ?? 0);
      }, { timeout: 5000 }).toBeGreaterThan(0);
      expect((await cancel(old.referenceCode)).statusCode).toBe(200);
      expect((await book()).statusCode).toBe(201);
      resume();
      expect((await pending).statusCode).toBe(409);
      expect(await prisma.auditLog.count()).toBe(0);
      expect((await prisma.appointment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe('CANCELLED');
    } finally { resume(); await blocker; await pending; }
  });

  it('keeps attendance corrections and unknown-id behavior', async () => {
    const row = (await book()).json();
    for (const status of ['CHECKED_IN', 'NO_SHOW', 'NO_SHOW']) {
      expect((await attendance(row.id, status)).statusCode).toBe(200);
    }
    expect((await attendance('missing-appointment', 'CHECKED_IN')).statusCode).toBe(404);
    expect(await prisma.auditLog.count()).toBe(3);
  });

  it('upgrades the previous migration history without losing booked or cancelled rows', async () => {
    const temporary = mkdtempSync(join(tmpdir(), 'dental-migrations-'));
    try {
      cpSync(schema, join(temporary, 'schema.prisma'));
      cpSync(migrations, join(temporary, 'migrations'), { recursive: true });
      rmSync(join(temporary, 'migrations', newMigration), { recursive: true });
      cli(['migrate', 'deploy', '--schema', join(temporary, 'schema.prisma')], upgradeUrl);
      await upgrade.doctor.create({ data: { ...doctorData, id: 'doctor-a' } });
      const old = await upgrade.appointment.create({ data: { ...payload, referenceCode: 'OLD-CANCELLED', status: 'CANCELLED' } });
      const booked = await upgrade.appointment.create({ data: { ...payload, startsAt: new Date('2100-01-04T01:00:00Z'), referenceCode: 'OLD-BOOKED' } });
      await expect(upgrade.appointment.create({ data: { ...payload, referenceCode: 'OLD-CONFLICT' } })).rejects.toMatchObject({ code: 'P2002' });
      cli(['migrate', 'deploy', '--schema', schema], upgradeUrl);
      await assertIndex(upgrade);
      expect(await upgrade.appointment.findUnique({ where: { id: old.id } })).toEqual(old);
      expect(await upgrade.appointment.findUnique({ where: { id: booked.id } })).toEqual(booked);
      await upgrade.appointment.create({ data: { ...payload, referenceCode: 'NEW-BOOKED' } });
      await expect(upgrade.appointment.create({ data: { ...payload, referenceCode: 'NEW-CONFLICT' } })).rejects.toMatchObject({ code: 'P2002' });
      const history = await upgrade.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null }[]>`
        SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" ORDER BY migration_name`;
      expect(history).toHaveLength(readdirSync(migrations, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length);
      for (const entry of history) {
        expect(entry.finished_at).not.toBeNull();
        expect(entry.checksum).toBe(createHash('sha256').update(readFileSync(join(migrations, entry.migration_name, 'migration.sql'))).digest('hex'));
      }
      assertNoDrift(upgradeUrl);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });

  it('has no Prisma-visible drift against migration replay or the schema', () => {
    assertNoDrift(url);
  });
});
