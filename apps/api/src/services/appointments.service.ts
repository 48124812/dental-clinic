import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { deliverEmailDelivery } from './email.service.js';

export class AppointmentConflictError extends Error {}

export async function listAvailability(doctorId: string, day: string) {
  const startOfDay = new Date(`${day}T00:00:00+08:00`);
  const endOfDay = new Date(`${day}T23:59:59.999+08:00`);
  const booked = await prisma.appointment.findMany({
    where: { doctorId, startsAt: { gte: startOfDay, lte: endOfDay }, status: { not: 'CANCELLED' } },
    select: { startsAt: true },
  });
  const bookedTimes = new Set(booked.map((item) => item.startsAt.toISOString()));
  return Array.from({ length: 10 }, (_, index) => {
    const startsAt = new Date(`${day}T${String(index + 9).padStart(2, '0')}:00:00+08:00`).toISOString();
    return { startsAt, available: !bookedTimes.has(startsAt) };
  });
}

export async function createAppointment(input: {
  doctorId: string; startsAt: string; patientName: string; patientPhone: string;
  nationalHealthId: string; patientEmail: string;
}) {
  const referenceCode = `DC-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: { ...input, startsAt: new Date(input.startsAt), referenceCode },
        include: { doctor: { select: { name: true } } },
      });
      const delivery = await tx.emailDelivery.create({
        data: { appointmentId: appointment.id, kind: 'BOOKING_CONFIRMATION', recipient: appointment.patientEmail },
      });
      return { appointment, deliveryId: delivery.id };
    });
    void deliverEmailDelivery(result.deliveryId);
    return result.appointment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppointmentConflictError('The selected appointment slot is no longer available.');
    }
    throw error;
  }
}

export async function findAppointment(referenceCode: string, phoneLast4: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { referenceCode }, include: { doctor: { select: { name: true } } },
  });
  if (!appointment || !appointment.patientPhone.endsWith(phoneLast4)) return null;
  return appointment;
}

export async function cancelAppointment(referenceCode: string, phoneLast4: string) {
  const appointment = await findAppointment(referenceCode, phoneLast4);
  if (!appointment) return null;
  if (appointment.status === 'CANCELLED') return appointment;
  if (appointment.startsAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
    throw new Error('Appointments can only be cancelled at least 24 hours in advance.');
  }
  const result = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.appointment.update({
      where: { id: appointment.id }, data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: { doctor: { select: { name: true } } },
    });
    const delivery = await tx.emailDelivery.create({ data: { appointmentId: cancelled.id, kind: 'CANCELLATION', recipient: cancelled.patientEmail } });
    return { cancelled, deliveryId: delivery.id };
  });
  void deliverEmailDelivery(result.deliveryId);
  return result.cancelled;
}
