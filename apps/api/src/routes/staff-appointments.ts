import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from '../services/staff-appointments.service.js';

function authorize(request: { headers: { authorization?: string } }) {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer') throw new service.StaffAuthenticationError();
  service.assertStaffToken(token);
}

export async function staffAppointmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { date?: string } }>('/api/staff/appointments', async (request, reply) => {
    try { authorize(request); } catch { return reply.code(401).send({ error: 'Staff authentication required.' }); }
    const parsed = z.string().date().safeParse(request.query.date);
    if (!parsed.success) return reply.code(400).send({ error: 'date (YYYY-MM-DD) is required.' });
    return service.listStaffAppointments(parsed.data);
  });
  app.patch<{ Params: { id: string }; Body: { status?: string } }>('/api/staff/appointments/:id/status', async (request, reply) => {
    try { authorize(request); } catch { return reply.code(401).send({ error: 'Staff authentication required.' }); }
    const parsed = z.enum(['CHECKED_IN', 'NO_SHOW']).safeParse(request.body?.status);
    if (!parsed.success) return reply.code(400).send({ error: 'status must be CHECKED_IN or NO_SHOW.' });
    try {
      const appointment = await service.updateAttendance(request.params.id, parsed.data);
      return appointment ?? reply.code(404).send({ error: 'Appointment not found.' });
    } catch (error) {
      if (error instanceof service.AppointmentTransitionError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });
}
