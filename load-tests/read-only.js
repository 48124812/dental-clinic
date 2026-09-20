import http from 'k6/http';
import { check, sleep } from 'k6';

// No public-host override: use an isolated local API or the in-cluster Service.
const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
if (!/^http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|api\.dental-clinic\.svc\.cluster\.local)(:\d{1,5})?$/.test(baseUrl)) {
  throw new Error('BASE_URL must be an allowed local or in-cluster HTTP origin. Public targets are disabled.');
}
const profile = __ENV.PROFILE || 'smoke';
if (!['smoke', 'ramp'].includes(profile)) throw new Error('PROFILE must be smoke or ramp.');
const peakVus = Number(__ENV.PEAK_VUS || 20);
if (!Number.isInteger(peakVus) || peakVus < 1 || peakVus > 100) {
  throw new Error('PEAK_VUS must be an integer from 1 to 100.');
}

export const options = {
  scenarios: profile === 'smoke' ? {
    smoke: { executor: 'constant-vus', vus: 1, duration: '15s' },
  } : {
    ramp: {
      executor: 'ramping-vus', startVUs: 0,
      stages: [
        { duration: '1m', target: Math.max(1, Math.ceil(peakVus / 4)) },
        { duration: '2m', target: Math.max(1, Math.ceil(peakVus / 2)) },
        { duration: '2m', target: peakVus },
        { duration: '3m', target: peakVus },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
  // Responses are never stored or logged, and redirects cannot escape the allowlist.
  discardResponseBodies: true,
  maxRedirects: 0,
  // Distribute requests through the Service instead of pinning a persistent socket.
  noConnectionReuse: true,
  systemTags: ['status', 'method', 'name', 'scenario', 'check', 'expected_response'],
};

http.setResponseCallback(http.expectedStatuses(200));

export default function () {
  const response = http.get(`${baseUrl}/api/doctors`, {
    tags: { name: 'GET /api/doctors' },
    timeout: '5s',
  });
  check(response, { 'catalog responds with 200': (result) => result.status === 200 });
  sleep(1);
}
