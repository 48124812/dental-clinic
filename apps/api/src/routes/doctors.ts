import type { FastifyInstance } from 'fastify';
import * as service from '../services/doctors.service.js';

/**
 * Doctor routes.
 *
 * 對應 US-03 (Issue #4): 病患看到每位醫師的學經歷與專長。
 */
export async function doctorsRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/doctors → 列表 */
  app.get('/api/doctors', async () => {
    return service.listDoctors();
  });

  /** GET /api/doctors/:id → 單筆，找不到回 404 */
  app.get<{ Params: { id: string } }>(
    '/api/doctors/:id',
    async (req, reply) => {
      const doctor = await service.getDoctorById(req.params.id);
      if (!doctor) {
        reply.code(404);
        return { error: 'Doctor not found' };
      }
      return doctor;
    },
  );
}
