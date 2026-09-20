import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

// Execute the actual script with synthetic k6 modules. No network or load runs.
const source = await readFile(new URL('./read-only.js', import.meta.url), 'utf8');
async function load(env = {}) {
  const calls = [];
  const context = vm.createContext({ __ENV: env });
  const http = {
    get: (...args) => { calls.push(args); return { status: 200 }; },
    expectedStatuses: (status) => status,
    setResponseCallback: () => {},
  };
  const modules = {
    'k6/http': new vm.SyntheticModule(['default'], function () { this.setExport('default', http); }, { context }),
    k6: new vm.SyntheticModule(['check', 'sleep'], function () {
      this.setExport('check', (response, checks) => Object.values(checks).every((check) => check(response)));
      this.setExport('sleep', () => {});
    }, { context }),
  };
  const script = new vm.SourceTextModule(source, { context });
  await script.link((specifier) => modules[specifier]);
  await script.evaluate();
  return { script: script.namespace, calls };
}

test('defaults to a short read-only localhost smoke test with no bodies or redirects', async () => {
  const { script, calls } = await load();
  script.default();
  assert.equal(script.options.scenarios.smoke.vus, 1);
  assert.equal(script.options.scenarios.smoke.duration, '15s');
  assert.equal(script.options.maxRedirects, 0);
  assert.equal(script.options.discardResponseBodies, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'http://127.0.0.1:3001/api/doctors');
  assert.equal(calls[0][1].tags.name, 'GET /api/doctors');
  assert.equal(script.options.systemTags.includes('url'), false);
});

for (const origin of [
  'https://dental-clinic-api-ylv9.onrender.com',
  'http://api.dental-clinic.svc.cluster.local.evil.example',
  'http://localhost@public.example', 'http://public.example',
  'http://localhost:3001/patients', 'http://localhost:3001?email=private',
]) {
  test(`rejects disallowed target ${origin}`, async () => {
    await assert.rejects(load({ BASE_URL: origin }), /Public targets are disabled/);
  });
}
for (const value of ['0', '101', 'NaN', '1.5']) {
  test(`rejects unsafe PEAK_VUS=${value}`, async () => {
    await assert.rejects(load({ PEAK_VUS: value }), /integer from 1 to 100/);
  });
}
test('rejects unrecognized profiles', async () => {
  await assert.rejects(load({ PROFILE: 'unbounded' }), /PROFILE must/);
});
test('ramp uses configured cluster origin and bounded gradual stages', async () => {
  const { script, calls } = await load({ BASE_URL: 'http://api.dental-clinic.svc.cluster.local:3001/', PROFILE: 'ramp', PEAK_VUS: '40' });
  script.default();
  assert.equal(calls[0][0], 'http://api.dental-clinic.svc.cluster.local:3001/api/doctors');
  assert.equal(JSON.stringify(script.options.scenarios.ramp.stages.map((stage) => stage.target)), '[10,20,40,40,0]');
  assert.equal(script.options.thresholds.http_req_failed[0].threshold, 'rate<0.01');
  assert.equal(script.options.thresholds.http_req_duration[0], 'p(95)<500');
});
