import type { Appointment } from '@prisma/client';
import { Writable } from 'node:stream';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only IO boundaries are replaced: real routes, Zod, auth, and services execute.
// No .env files, database connection, HTTP port, or email provider are needed.
vi.mock('../config.js', () => ({ config: {
  LOG_LEVEL: 'error', CORS_ORIGIN: ['http://localhost:3000'], APP_VERSION: 'test',
  STAFF_DASHBOARD_TOKEN: 'test-staff-token-000000000000',
  ADMIN_DASHBOARD_TOKEN: 'test-admin-token-000000000000',
} }));
vi.mock('../lib/prisma.js', () => ({ prisma: {
  appointment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  emailDelivery: { create: vi.fn() },
  doctor: { findMany: vi.fn() }, service: { findMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
} }));
vi.mock('../services/email.service.js', () => ({ deliverEmailDelivery: vi.fn().mockResolvedValue(undefined) }));

import { buildApp } from '../app.js';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { deliverEmailDelivery } from '../services/email.service.js';

const now = new Date('2030-01-01T01:00:00Z');
const payload = {
  doctorId: 'doctor-test', startsAt: '2030-01-03T01:00:00Z',
  patientName: 'Test Patient', patientPhone: '0912345678',
  nationalHealthId: 'TEST000000', patientEmail: 'patient@example.invalid',
};
type StoredAppointment = Appointment & { doctor: { name: string } };

describe('appointment HTTP flow with isolated persistence', () => {
  let app: FastifyInstance;
  let records: StoredAppointment[];

  beforeEach(async () => {
    vi.resetAllMocks();
    config.STAFF_DASHBOARD_TOKEN = 'test-staff-token-000000000000';
    config.ADMIN_DASHBOARD_TOKEN = 'test-admin-token-000000000000';
    // Freeze Date only; Fastify's timers and performance clock remain real.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    records = [];
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      // Deliberately narrow fake: supports only the callback transaction used here.
      return (callback as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });
    vi.mocked(prisma.appointment.create as unknown as (args: Prisma.AppointmentCreateArgs) => Promise<StoredAppointment>).mockImplementation(async ({ data }) => {
      const startsAt = new Date(data.startsAt);
      if (records.some((row) => row.status !== 'CANCELLED' && row.doctorId === data.doctorId && row.startsAt.getTime() === startsAt.getTime())) {
        throw new Prisma.PrismaClientKnownRequestError('Unique slot constraint', {
          code: 'P2002', clientVersion: 'test', meta: { target: ['doctorId', 'startsAt'] },
        });
      }
      const row = { ...data, startsAt, id: `appointment-${records.length + 1}`,
        status: 'BOOKED', cancelledAt: null, createdAt: now, updatedAt: now,
        doctor: { name: 'Test Doctor' },
      } as StoredAppointment;
      records.push(row);
      return row;
    });
    vi.mocked(prisma.appointment.findUnique as unknown as (args: Prisma.AppointmentFindUniqueArgs) => Promise<StoredAppointment | null>).mockImplementation(async ({ where }) =>
      records.find((row) => row.referenceCode === where.referenceCode) ?? null);
    vi.mocked(prisma.appointment.update as unknown as (args: Prisma.AppointmentUpdateArgs) => Promise<StoredAppointment>).mockImplementation(async ({ where, data }) => {
      const row = records.find((item) => item.id === where.id)!;
      Object.assign(row, data);
      return row;
    });
    vi.mocked(prisma.emailDelivery.create).mockResolvedValue({ id: 'delivery-test' } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.doctor.findMany).mockResolvedValue([]);
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);
    app = await buildApp();
  });

  afterEach(async () => {
    await app?.close();
    config.LOG_LEVEL = 'error';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps synthetic private values out of access/error logs and metrics', async () => {
    await app.close();
    const logs: string[] = [];
    const logStream = new Writable({ write(chunk, _encoding, callback) { logs.push(chunk.toString()); callback(); } });
    config.LOG_LEVEL = 'info';
    app = await buildApp({ logStream });
    const privateValue = 'SYNTHETIC_PRIVATE_MARKER';
    app.post('/privacy-test/:id', async () => { throw new Error(privateValue); });
    const result = await app.inject({
      method: 'POST', url: `/privacy-test/${privateValue}?email=${privateValue}`,
      headers: { authorization: `Bearer ${privateValue}` },
      payload: { patientName: privateValue, patientPhone: privateValue, patientEmail: privateValue, nationalHealthId: privateValue },
    });
    expect(result.statusCode).toBe(500);
    expect(result.json()).toEqual({ error: 'Internal server error' });
    await app.inject(`/unknown/${privateValue}`);
    const metrics = await app.inject('/metrics');
    expect(metrics.body).not.toContain(privateValue);
    expect(logs.join('')).toContain('Request failed');
    expect(logs.join('')).toContain('Request completed');
    expect(logs.join('')).not.toContain(privateValue);
  });

  async function book(startsAt = payload.startsAt) {
    const response = await app.inject({ method: 'POST', url: '/api/appointments', payload: { ...payload, startsAt } });
    expect(response.statusCode).toBe(201);
    return response.json<StoredAppointment>();
  }

  it('creates an appointment with 201 and queues its confirmation', async () => {
    const appointment = await book();
    expect(appointment).toMatchObject({ doctorId: payload.doctorId, status: 'BOOKED', startsAt: new Date(payload.startsAt).toISOString() });
    expect(appointment.referenceCode).toMatch(/^DC-[A-F0-9]{8}$/);
    expect(records).toHaveLength(1);
    expect(prisma.emailDelivery.create).toHaveBeenCalledWith({ data: {
      appointmentId: appointment.id, kind: 'BOOKING_CONFIRMATION', recipient: payload.patientEmail,
    } });
    expect(deliverEmailDelivery).toHaveBeenCalledWith('delivery-test');
  });

  it.each([{ patientEmail: 'invalid' }, { startsAt: 'invalid' }, { patientName: '' }, { doctorId: '' }])(
    'rejects invalid input with 400: %j', async (invalid) => {
      const response = await app.inject({ method: 'POST', url: '/api/appointments', payload: { ...payload, ...invalid } });
      expect(response.statusCode).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('returns 409 for duplicate doctor/time without queuing another email', async () => {
    await book();
    const duplicate = await app.inject({ method: 'POST', url: '/api/appointments', payload });
    expect(duplicate.statusCode).toBe(409);
    expect(records).toHaveLength(1);
    expect(prisma.emailDelivery.create).toHaveBeenCalledTimes(1);
  });

  it('finds an appointment with its reference and phone suffix', async () => {
    const appointment = await book();
    const response = await app.inject(`/api/appointments/${appointment.referenceCode}?phoneLast4=5678`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: appointment.id });
  });

  it.each(['9999', '', '8', '678', '45678', 'abcd'])('denies lookup and cancellation with suffix "%s"', async (phoneLast4) => {
    const appointment = await book();
    const url = `/api/appointments/${appointment.referenceCode}`;
    const response = await app.inject(`${url}?phoneLast4=${phoneLast4}`);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Appointment not found.' });
    const cancelled = await app.inject({ method: 'POST', url: `${url}/cancel`, payload: { phoneLast4 } });
    expect(cancelled.statusCode).toBe(404);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('denies lookup and cancellation when the suffix is omitted', async () => {
    const appointment = await book();
    const url = `/api/appointments/${appointment.referenceCode}`;
    expect((await app.inject(url)).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `${url}/cancel`, payload: {} })).statusCode).toBe(404);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it.each([48, 24])('cancels %i hours before the appointment', async (hours) => {
    const appointment = await book(new Date(now.getTime() + hours * 3600000).toISOString());
    const response = await app.inject({ method: 'POST', url: `/api/appointments/${appointment.referenceCode}/cancel`, payload: { phoneLast4: '5678' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'CANCELLED', cancelledAt: now.toISOString() });
    expect(records[0]!.status).toBe('CANCELLED');
    expect(prisma.emailDelivery.create).toHaveBeenLastCalledWith({ data: {
      appointmentId: appointment.id, kind: 'CANCELLATION', recipient: payload.patientEmail,
    } });
  });

  it('rejects cancellation one millisecond inside the 24-hour deadline', async () => {
    const appointment = await book(new Date(now.getTime() + 24 * 3600000 - 1).toISOString());
    const response = await app.inject({ method: 'POST', url: `/api/appointments/${appointment.referenceCode}/cancel`, payload: { phoneLast4: '5678' } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('24 hours');
    expect(records[0]!.status).toBe('BOOKED');
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(prisma.emailDelivery.create).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 'Bearer wrong', 'Bearer test-staff-token-000000000001', 'Basic test-staff-token-000000000000'])(
    'denies Staff read and write without the correct Bearer token: %s', async (authorization) => {
      const headers = authorization ? { authorization } : {};
      expect((await app.inject({ url: '/api/staff/appointments?date=2030-01-03', headers })).statusCode).toBe(401);
      expect((await app.inject({ method: 'PATCH', url: '/api/staff/appointments/test/status', headers, payload: { status: 'CHECKED_IN' } })).statusCode).toBe(401);
      expect(prisma.appointment.findMany).not.toHaveBeenCalled();
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, 'Bearer wrong', 'Bearer test-admin-token-000000000001', 'Basic test-admin-token-000000000000'])(
    'denies every Admin catalog endpoint without the correct token: %s', async (authorization) => {
      const headers = authorization ? { authorization } : {};
      for (const kind of ['doctors', 'services']) {
        for (const method of ['GET', 'POST', 'PUT'] as const) {
          const url = `/api/admin/${kind}${method === 'PUT' ? '/test' : ''}`;
          expect((await app.inject({ method, url, headers })).statusCode).toBe(401);
        }
      }
      expect(prisma.doctor.findMany).not.toHaveBeenCalled();
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    },
  );

  it('accepts configured Staff and Admin tokens on their respective APIs', async () => {
    expect((await app.inject({ url: '/api/staff/appointments?date=2030-01-03', headers: { authorization: `Bearer ${config.STAFF_DASHBOARD_TOKEN}` } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/admin/doctors', headers: { authorization: `Bearer ${config.ADMIN_DASHBOARD_TOKEN}` } })).statusCode).toBe(200);
  });

  it('fails closed when environment tokens are not configured', async () => {
    config.STAFF_DASHBOARD_TOKEN = undefined;
    config.ADMIN_DASHBOARD_TOKEN = undefined;
    expect((await app.inject({ url: '/api/staff/appointments?date=2030-01-03', headers: { authorization: 'Bearer test-staff-token-000000000000' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/admin/doctors', headers: { authorization: 'Bearer test-admin-token-000000000000' } })).statusCode).toBe(401);
  });

  it('keeps health independent of DB and reports ready for a reachable DB', async () => {
    expect((await app.inject('/health')).statusCode).toBe(200);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    const ready = await app.inject('/ready');
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ status: 'ready', checks: { db: { ok: true } } });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports ready=503 but health=200 when DB is unavailable', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Test database unavailable'));
    const ready = await app.inject('/ready');
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({ status: 'not-ready', checks: { db: { ok: false } } });
    expect((await app.inject('/health')).statusCode).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
