import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from '../services/appointments.service.js';

const createSchema = z.object({
  doctorId: z.string().min(1), startsAt: z.string().datetime(), patientName: z.string().min(2).max(80),
  patientPhone: z.string().min(8).max(20), nationalHealthId: z.string().min(6).max(20), patientEmail: z.string().email(),
});

export async function appointmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { doctorId: string; date: string } }>('/api/appointments/availability', async (request, reply) => {
    const parsed = z.object({ doctorId: z.string().min(1), date: z.string().date() }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'doctorId and date (YYYY-MM-DD) are required.' });
    return service.listAvailability(parsed.data.doctorId, parsed.data.date);
  });
  app.post('/api/appointments', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid appointment data.', details: parsed.error.flatten() });
    try { return reply.code(201).send(await service.createAppointment(parsed.data)); }
    catch (error) {
      if (error instanceof service.AppointmentConflictError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });
  app.get<{ Params: { referenceCode: string }; Querystring: { phoneLast4: string } }>('/api/appointments/:referenceCode', async (request, reply) => {
    const appointment = await service.findAppointment(request.params.referenceCode, request.query.phoneLast4 ?? '');
    return appointment ? appointment : reply.code(404).send({ error: 'Appointment not found.' });
  });
  app.post<{ Params: { referenceCode: string }; Body: { phoneLast4: string } }>('/api/appointments/:referenceCode/cancel', async (request, reply) => {
    try {
      const appointment = await service.cancelAppointment(request.params.referenceCode, request.body?.phoneLast4 ?? '');
      return appointment ? appointment : reply.code(404).send({ error: 'Appointment not found.' });
    } catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : 'Unable to cancel appointment.' }); }
  });
}
