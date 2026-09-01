import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

const metricsPath = '/metrics';

/**
 * Registers Prometheus-compatible metrics for the API process.
 *
 * Request labels deliberately use Fastify's route template (for example,
 * `/api/doctors/:id`) instead of concrete URLs, preventing unbounded metric
 * cardinality from user-controlled path parameters.
 */
export function registerMetrics(app: FastifyInstance): void {
  const registry = new Registry();
  const startedAt = new WeakMap<FastifyRequest, number>();

  collectDefaultMetrics({
    prefix: 'dental_clinic_',
    register: registry,
  });

  const requestsTotal = new Counter({
    name: 'dental_clinic_http_requests_total',
    help: 'Total HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });

  const requestDurationSeconds = new Histogram({
    name: 'dental_clinic_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  });

  app.addHook('onRequest', async (request) => {
    startedAt.set(request, performance.now());
  });

  app.addHook('onResponse', async (request, reply) => {
    const start = startedAt.get(request);
    if (start === undefined) return;

    const route = request.routeOptions?.url ?? request.url.split('?')[0];
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };

    requestsTotal.inc(labels);
    requestDurationSeconds.observe(labels, (performance.now() - start) / 1000);
  });

  app.get(metricsPath, async (_request, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });
}
