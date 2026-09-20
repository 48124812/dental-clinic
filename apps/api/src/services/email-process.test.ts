import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const run = promisify(execFile);

// A separate process has no Vitest unhandledRejection listener to mask a crash.
// Real routes/services execute; all database and provider IO is synthetic.
it.each(['initial-query', 'failure-record'])('survives background %s errors with strict unhandled-rejection handling', async (stage) => {
  const script = `
    import { buildApp } from ${JSON.stringify(new URL('../app.ts', import.meta.url).href)};
    import { prisma } from ${JSON.stringify(new URL('../lib/prisma.ts', import.meta.url).href)};
    import { Writable } from 'node:stream';
    const privateValue = 'SYNTHETIC_PRIVATE_PROCESS_MARKER';
    const row = { id: 'appointment-test', referenceCode: 'DC-SYNTHETIC', doctorId: 'doctor-test',
      startsAt: new Date('2100-01-03T01:00:00Z'), status: 'BOOKED', patientPhone: '0000005678',
      patientName: privateValue, patientEmail: 'patient@example.invalid', nationalHealthId: 'SYNTHETIC_NHI',
      doctor: { name: 'Synthetic Doctor' } };
    prisma.$transaction = async (callback) => callback({
      appointment: { create: async () => row, update: async () => { row.status = 'CANCELLED'; return row; } },
      emailDelivery: { create: async () => ({ id: 'delivery-test' }) },
    });
    prisma.appointment.findUnique = async () => row;
    prisma.emailDelivery.findUnique = async () => {
      if (${JSON.stringify(stage)} === 'initial-query') throw new Error(privateValue);
      return { id: 'delivery-test', recipient: row.patientEmail, status: 'PENDING', kind: 'BOOKING_CONFIRMATION', appointment: row };
    };
    prisma.emailDelivery.update = async ({ data }) => {
      if (data.status === 'FAILED') throw new Error(privateValue);
      return {};
    };
    globalThis.fetch = async () => { throw new Error(privateValue); };
    const logs = [];
    const app = await buildApp({ logStream: new Writable({ write(chunk, _encoding, done) { logs.push(chunk.toString()); done(); } }) });
    const created = await app.inject({ method: 'POST', url: '/api/appointments', payload: {
      doctorId: row.doctorId, startsAt: row.startsAt.toISOString(), patientName: row.patientName,
      patientPhone: row.patientPhone, nationalHealthId: row.nationalHealthId, patientEmail: row.patientEmail,
    } });
    await new Promise(resolve => setImmediate(resolve));
    const cancelled = await app.inject({ method: 'POST', url: '/api/appointments/DC-SYNTHETIC/cancel', payload: { phoneLast4: '5678' } });
    await new Promise(resolve => setImmediate(resolve));
    await app.close(); await prisma.$disconnect();
    // Drain another turn after closing: no dangling background failure may escape.
    await new Promise(resolve => setImmediate(resolve));
    if (created.statusCode !== 201 || cancelled.statusCode !== 200 || row.status !== 'CANCELLED') throw new Error('Appointment contract failed');
    if (logs.join('').includes(privateValue)) throw new Error('Log privacy failed');
    const events = logs.map(line => JSON.parse(line));
    if (events.filter(entry => entry.event === 'email_delivery_failed').length !== 2) throw new Error('Missing safe failure events');
    if (${JSON.stringify(stage)} === 'failure-record' && events.filter(entry => entry.event === 'email_delivery_failure_record_failed').length !== 2) throw new Error('Missing persistence failure events');
    console.log('PROCESS_SURVIVED');
  `;
  const result = await run(process.execPath, ['--unhandled-rejections=strict', '--import', 'tsx', '--input-type=module', '--eval', script], {
    timeout: 10000,
    env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error', DATABASE_URL: 'postgresql://synthetic@127.0.0.1:1/unused',
      RESEND_API_KEY: 'synthetic-provider-key', EMAIL_TEST_RECIPIENT: 'patient@example.invalid', RESEND_FROM: 'sender@example.invalid' },
  });
  expect(result.stdout.trim()).toBe('PROCESS_SURVIVED');
  expect(result.stderr).toBe('');
}, 15000);
