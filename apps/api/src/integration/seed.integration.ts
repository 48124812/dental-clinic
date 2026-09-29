import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalUrl = process.env.DATABASE_URL;
if (process.env.INTEGRATION_TEST !== 'disposable-docker' || originalUrl !== 'postgresql://postgres@db:5432/dental_integration') {
  throw new Error('Only pnpm test:integration disposable infrastructure is allowed.');
}
process.env.DATABASE_URL = originalUrl.replace('dental_integration', 'dental_seed');
vi.mock('../services/email.service.js', () => ({ deliverEmailDelivery: vi.fn().mockResolvedValue(undefined) }));
const { prisma } = await import('../lib/prisma.js');
const { buildApp } = await import('../app.js');
const app = await buildApp();
const run = promisify(execFile);
const seed = () => run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], { env: process.env });
const payload = { doctorId: 'doc_wang', startsAt: '2100-01-04T01:00:00.000Z', patientName: 'Demo Patient',
  patientPhone: '0000005678', patientEmail: 'demo@example.invalid', nationalHealthId: 'DEMO_ONLY' };
const book = () => app.inject({ method: 'POST', url: '/api/appointments', payload });
const cancel = (reference: string) => app.inject({ method: 'POST', url: `/api/appointments/${reference}/cancel`, payload: { phoneLast4: '5678' } });
async function snapshot() {
  return Promise.all([prisma.doctor.findMany({ orderBy: { id: 'asc' } }), prisma.service.findMany({ orderBy: { id: 'asc' } }),
    prisma.businessHours.findMany({ orderBy: { id: 'asc' } }), prisma.caseStudy.findMany({ orderBy: { id: 'asc' } }),
    prisma.appointment.findMany({ orderBy: { id: 'asc' } }), prisma.emailDelivery.findMany({ orderBy: { id: 'asc' } }),
    prisma.user.findMany({ orderBy: { id: 'asc' } }), prisma.auditLog.findMany({ orderBy: { id: 'asc' } })]);
}
beforeAll(async () => {
  await run(process.execPath, ['/repo/node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { env: process.env });
});
beforeEach(async () => {
  await prisma.auditLog.deleteMany(); await prisma.emailDelivery.deleteMany(); await prisma.appointment.deleteMany();
  await prisma.user.deleteMany(); await prisma.doctor.deleteMany(); await prisma.service.deleteMany();
  await prisma.businessHours.deleteMany(); await prisma.caseStudy.deleteMany();
});
afterAll(async () => { await app.close(); await prisma.$disconnect(); process.env.DATABASE_URL = originalUrl; });

describe('empty database demo bootstrap', () => {
  it('serializes initializers and supports seeded catalog booking, lookup, cancellation and rebooking', async () => {
    const runs = await Promise.all([seed(), seed()]);
    expect(runs.filter((r) => r.stdout.includes('Demo seed complete'))).toHaveLength(1);
    expect(runs.filter((r) => r.stdout.includes('Demo seed skipped'))).toHaveLength(1);
    expect((await snapshot()).map((rows) => rows.length)).toEqual([4, 9, 7, 2, 0, 0, 0, 0]);
    expect((await app.inject('/ready')).statusCode).toBe(200);
    const first = await book(); expect(first.statusCode).toBe(201);
    const old = first.json();
    expect((await app.inject(`/api/appointments/${old.referenceCode}?phoneLast4=5678`)).statusCode).toBe(200);
    expect((await cancel(old.referenceCode)).statusCode).toBe(200);
    const second = await book(); expect(second.statusCode).toBe(201);
    expect(second.json().id).not.toBe(old.id); expect(second.json().referenceCode).not.toBe(old.referenceCode);
    expect((await book()).statusCode).toBe(409);
    expect((await app.inject(`/api/appointments/${old.referenceCode}?phoneLast4=5678`)).json().status).toBe('CANCELLED');
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`SELECT indexdef FROM pg_indexes
      WHERE indexname = 'Appointment_active_doctorId_startsAt_key'`;
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.indexdef).toContain(`WHERE (status <> 'CANCELLED'::"AppointmentStatus")`);
    expect((await cancel(second.json().referenceCode)).statusCode).toBe(200);
  });

  it('preserves edits, deletions, appointments and other existing rows on repeated invocation', async () => {
    await seed(); await book();
    await prisma.doctor.update({ where: { id: 'doc_wang' }, data: { name: 'Edited Demo Doctor', active: false } });
    await prisma.doctor.delete({ where: { id: 'doc_chen' } });
    await prisma.service.update({ where: { id: 'svc_checkup' }, data: { priceMin: 123, active: false } });
    await prisma.businessHours.update({ where: { dayOfWeek: 1 }, data: { isClosed: true } });
    await prisma.caseStudy.update({ where: { id: 'case_ortho_demo' }, data: { active: false } });
    const user = await prisma.user.create({ data: { email: 'demo@example.invalid', passwordHash: 'SYNTHETIC_NOT_A_PASSWORD' } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: 'DEMO', entityType: 'Doctor', entityId: 'doc_wang' } });
    const before = await snapshot();
    expect((await seed()).stdout).toContain('Demo seed skipped');
    expect((await seed()).stdout).toContain('Demo seed skipped');
    expect(await snapshot()).toEqual(before);
  });

  it('does not fill or overwrite a partially populated database', async () => {
    await prisma.businessHours.create({ data: { dayOfWeek: 0, isClosed: true } });
    const before = await snapshot();
    expect((await seed()).stdout).toContain('Demo seed skipped');
    expect(await snapshot()).toEqual(before);
  });

  it('rolls back all inserts if a later catalog insert fails, then permits a clean retry', async () => {
    await prisma.$executeRaw`ALTER TABLE "Service" ADD CONSTRAINT seed_test_failure CHECK (false) NOT VALID`;
    try {
      await expect(seed()).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('transaction rolled back') });
      expect((await snapshot()).every((rows) => rows.length === 0)).toBe(true);
    } finally {
      await prisma.$executeRaw`ALTER TABLE "Service" DROP CONSTRAINT seed_test_failure`;
    }
    expect((await seed()).stdout).toContain('Demo seed complete');
    expect((await snapshot()).map((rows) => rows.length)).toEqual([4, 9, 7, 2, 0, 0, 0, 0]);
  });
});
