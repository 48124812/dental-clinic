import { timingSafeEqual } from 'node:crypto';
import type { AppointmentStatus } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

export class StaffAuthenticationError extends Error {}

export function assertStaffToken(value: string | undefined): void {
  const expected = config.STAFF_DASHBOARD_TOKEN;
  if (!expected || !value) throw new StaffAuthenticationError();
  const providedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) throw new StaffAuthenticationError();
}

function taipeiDayBounds(day: string) {
  return { gte: new Date(`${day}T00:00:00+08:00`), lte: new Date(`${day}T23:59:59.999+08:00`) };
}

async function staffActor() {
  return prisma.user.upsert({ where: { email: config.STAFF_EMAIL }, update: { role: 'STAFF' }, create: { email: config.STAFF_EMAIL, passwordHash: 'environment-token-managed', role: 'STAFF' } });
}

export async function listStaffAppointments(day: string) {
  return prisma.appointment.findMany({ where: { startsAt: taipeiDayBounds(day) }, include: { doctor: { select: { name: true } } }, orderBy: { startsAt: 'asc' } });
}

export async function updateAttendance(id: string, status: Extract<AppointmentStatus, 'CHECKED_IN' | 'NO_SHOW'>) {
  const before = await prisma.appointment.findUnique({ where: { id }, select: { status: true } });
  if (!before) return null;
  const actor = await staffActor();
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.update({ where: { id }, data: { status }, include: { doctor: { select: { name: true } } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: 'APPOINTMENT_ATTENDANCE_UPDATED', entityType: 'Appointment', entityId: id, before: { status: before.status }, after: { status } } });
    return appointment;
  });
}
