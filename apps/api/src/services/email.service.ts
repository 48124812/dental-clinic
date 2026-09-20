import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

/** Sends a queued notification. In Resend sandbox mode delivery is restricted
 * to EMAIL_TEST_RECIPIENT, preventing accidental patient-email delivery. */
export async function deliverEmailDelivery(deliveryId: string, logger: FastifyBaseLogger): Promise<void> {
  let loaded = false;
  let errorCategory: 'database' | 'provider' | 'unexpected' = 'database';
  let retryable = true;
  try {
    const delivery = await prisma.emailDelivery.findUnique({
      where: { id: deliveryId },
      include: { appointment: { include: { doctor: { select: { name: true } } } } },
    });
    if (!delivery || delivery.status === 'SENT') return;
    if (!config.RESEND_API_KEY || !config.EMAIL_TEST_RECIPIENT || delivery.recipient !== config.EMAIL_TEST_RECIPIENT) return;

    loaded = true;
    errorCategory = 'unexpected';
    retryable = false;
    const isCancellation = delivery.kind === 'CANCELLATION';
    const subject = isCancellation ? '光明牙醫診所：預約已取消' : '光明牙醫診所：預約確認';
    const action = isCancellation ? '已取消' : '已成立';
    const time = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'full', timeStyle: 'short', hour12: false }).format(delivery.appointment.startsAt);
    const html = `<p>您好，${delivery.appointment.patientName}：</p><p>您與 ${delivery.appointment.doctor.name} 的預約${action}。</p><p>時段：${time}<br>預約編號：${delivery.appointment.referenceCode}</p>`;

    errorCategory = 'database';
    retryable = true;
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { attempts: { increment: 1 }, lastError: null } });
    errorCategory = 'provider';
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: config.RESEND_FROM, to: [delivery.recipient], subject, html }) });
    retryable = response.ok || response.status === 408 || response.status === 429 || response.status >= 500;
    const body = await response.json() as { id?: string };
    if (!response.ok || !body.id) throw new Error('Email provider rejected delivery');
    errorCategory = 'database';
    retryable = true;
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', providerId: body.id, sentAt: new Date(), lastError: null } });
  } catch {
    // Never attach the error, recipient, HTML, provider body, or connection details.
    logger.error({ event: 'email_delivery_failed', deliveryId, errorCategory, retryable }, 'Email delivery failed');
    if (loaded) {
      try {
        await prisma.emailDelivery.update({ where: { id: deliveryId }, data: { status: 'FAILED', lastError: errorCategory } });
      } catch {
        logger.error({ event: 'email_delivery_failure_record_failed', deliveryId, errorCategory: 'database', retryable: true }, 'Unable to record email failure');
      }
    }
  }
}
