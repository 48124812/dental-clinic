import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

/** Sends a queued notification. In Resend sandbox mode delivery is restricted
 * to EMAIL_TEST_RECIPIENT, preventing accidental patient-email delivery. */
export async function deliverEmailDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.emailDelivery.findUnique({
    where: { id: deliveryId },
    include: { appointment: { include: { doctor: { select: { name: true } } } } },
  });
  if (!delivery || delivery.status === 'SENT') return;
  if (!config.RESEND_API_KEY || !config.EMAIL_TEST_RECIPIENT || delivery.recipient !== config.EMAIL_TEST_RECIPIENT) return;

  const isCancellation = delivery.kind === 'CANCELLATION';
  const subject = isCancellation ? '光明牙醫診所：預約已取消' : '光明牙醫診所：預約確認';
  const action = isCancellation ? '已取消' : '已成立';
  const time = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'full', timeStyle: 'short', hour12: false }).format(delivery.appointment.startsAt);
  const html = `<p>您好，${delivery.appointment.patientName}：</p><p>您與 ${delivery.appointment.doctor.name} 的預約${action}。</p><p>時段：${time}<br>預約編號：${delivery.appointment.referenceCode}</p>`;

  await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { attempts: { increment: 1 }, lastError: null } });
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: config.RESEND_FROM, to: [delivery.recipient], subject, html }) });
    const body = await response.json() as { id?: string; message?: string };
    if (!response.ok || !body.id) throw new Error(body.message ?? `Resend returned ${response.status}`);
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', providerId: body.id, sentAt: new Date(), lastError: null } });
  } catch (error) {
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown email provider error' } });
  }
}
