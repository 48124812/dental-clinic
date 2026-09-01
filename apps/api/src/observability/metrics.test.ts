import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerMetrics } from './metrics.js';

describe('registerMetrics', () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('exposes Prometheus metrics and counts route-template requests', async () => {
    const app = Fastify();
    apps.push(app);
    registerMetrics(app);
    app.get('/items/:id', async () => ({ ok: true }));

    const itemResponse = await app.inject({ method: 'GET', url: '/items/123' });
    const metricsResponse = await app.inject({ method: 'GET', url: '/metrics' });

    expect(itemResponse.statusCode).toBe(200);
    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.headers['content-type']).toContain('text/plain');
    expect(metricsResponse.body).toContain('dental_clinic_http_requests_total');
    expect(metricsResponse.body).toContain(
      'route="/items/:id",status_code="200"',
    );
  });
});
