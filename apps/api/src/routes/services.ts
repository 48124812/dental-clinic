import type { FastifyInstance } from 'fastify';
import * as service from '../services/services.service.js';

/**
 * Services routes (US-04: 服務 / 療程列表).
 */
export async function servicesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/services', async () => {
    return service.listServices();
  });
}
