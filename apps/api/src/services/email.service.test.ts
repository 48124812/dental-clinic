import Fastify, { type FastifyInstance } from 'fastify';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({ config: {
  RESEND_API_KEY: 'synthetic-provider-key', EMAIL_TEST_RECIPIENT: 'patient@example.invalid', RESEND_FROM: 'sender@example.invalid',
} }));
vi.mock('../lib/prisma.js', () => ({ prisma: { emailDelivery: { findUnique: vi.fn(), update: vi.fn() } } }));
import { prisma } from '../lib/prisma.js';
import { deliverEmailDelivery } from './email.service.js';

const secrets = ['SYNTHETIC_PATIENT_NAME', '0000005678', 'patient@example.invalid', 'SYNTHETIC_NHI',
  'postgresql://private:secret@internal.invalid/db', 'SENSITIVE_ERROR_MESSAGE', '<p>PRIVATE_HTML</p>', 'PRIVATE_PROVIDER_BODY'];
const delivery = { id: 'delivery-test', kind: 'BOOKING_CONFIRMATION', recipient: secrets[2], status: 'PENDING',
  appointment: { patientName: secrets[0], patientPhone: secrets[1], nationalHealthId: secrets[3],
    startsAt: new Date('2100-01-01T01:00:00Z'), referenceCode: 'DC-SYNTHETIC', doctor: { name: 'Synthetic Doctor' } } };

describe('best-effort email error boundary', () => {
  let app: FastifyInstance;
  let logs: string[];
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.resetAllMocks();
    logs = [];
    app = Fastify({ logger: { level: 'error', stream: new Writable({ write(chunk, _encoding, done) { logs.push(chunk.toString()); done(); } }) } });
    vi.mocked(prisma.emailDelivery.findUnique).mockResolvedValue(delivery as never);
    vi.mocked(prisma.emailDelivery.update).mockResolvedValue({} as never);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'synthetic-provider-id' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(async () => { await app.close(); vi.unstubAllGlobals(); });

  it.each(['initial-query', 'attempt-update', 'provider-reject', 'provider-500', 'provider-400', 'invalid-json', 'sent-update', 'failure-update'])(
    'contains %s failure and emits only safe structured metadata', async (stage) => {
      const sensitiveError = new Error(secrets.join(' '));
      if (stage === 'initial-query') vi.mocked(prisma.emailDelivery.findUnique).mockRejectedValue(sensitiveError);
      if (stage === 'attempt-update') vi.mocked(prisma.emailDelivery.update).mockRejectedValueOnce(sensitiveError);
      if (stage === 'provider-reject' || stage === 'failure-update') fetchMock.mockRejectedValue(sensitiveError);
      if (stage === 'provider-500' || stage === 'provider-400') fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: secrets.join(' ') }), { status: stage === 'provider-500' ? 500 : 400 }));
      if (stage === 'invalid-json') fetchMock.mockResolvedValue(new Response('PRIVATE_PROVIDER_BODY', { status: 200 }));
      if (stage === 'sent-update') vi.mocked(prisma.emailDelivery.update).mockResolvedValueOnce({} as never).mockRejectedValueOnce(sensitiveError);
      if (stage === 'failure-update') vi.mocked(prisma.emailDelivery.update).mockResolvedValueOnce({} as never).mockRejectedValueOnce(sensitiveError);
      await expect(deliverEmailDelivery('delivery-test', app.log)).resolves.toBeUndefined();
      await new Promise<void>((resolve) => setImmediate(resolve));
      const events = logs.map((line) => JSON.parse(line));
      expect(events[0]).toMatchObject({ event: 'email_delivery_failed', deliveryId: 'delivery-test',
        errorCategory: ['initial-query', 'attempt-update', 'sent-update'].includes(stage) ? 'database' : 'provider',
        retryable: stage !== 'provider-400' });
      expect(events).toHaveLength(stage === 'failure-update' ? 2 : 1);
      if (stage === 'failure-update') expect(events[1].event).toBe('email_delivery_failure_record_failed');
      for (const secret of secrets) expect(logs.join('')).not.toContain(secret);
      expect(logs.join('')).not.toContain('stack');
      if (stage === 'initial-query') expect(prisma.emailDelivery.update).not.toHaveBeenCalled();
      else expect(prisma.emailDelivery.update).toHaveBeenLastCalledWith({ where: { id: 'delivery-test' }, data: { status: 'FAILED', lastError: expect.stringMatching(/^(database|provider)$/) } });
    },
  );

  it('still records successful delivery and sends no failure event', async () => {
    await deliverEmailDelivery('delivery-test', app.log);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.emailDelivery.update).toHaveBeenLastCalledWith({ where: { id: 'delivery-test' }, data: { status: 'SENT', providerId: 'synthetic-provider-id', sentAt: expect.any(Date), lastError: null } });
    expect(logs).toEqual([]);
  });

  it('does not send to a recipient outside the sandbox allowlist', async () => {
    vi.mocked(prisma.emailDelivery.findUnique).mockResolvedValue({ ...delivery, recipient: 'other@example.invalid' } as never);
    await deliverEmailDelivery('delivery-test', app.log);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.emailDelivery.update).not.toHaveBeenCalled();
  });
});
