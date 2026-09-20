// Disposable integration infrastructure. No host ports, .env files or persistent volumes.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const prefix = `dental-integration-${randomUUID().slice(0, 8)}`;
const network = `${prefix}-net`;
const database = `${prefix}-db`;
const runner = `${prefix}-runner`;
const image = `${prefix}:test`;
const cleanup = [];
function docker(args, check = true) {
  const result = spawnSync('docker', args, { cwd: root, stdio: 'inherit' });
  if (check && result.status !== 0) throw new Error(`Docker ${args[0]} failed (${result.status})`);
  return result.status;
}
try {
  docker(['build', '--target', 'builder', '-f', 'apps/api/Dockerfile', '-t', image, '.']);
  cleanup.unshift(['image', 'rm', image]);
  docker(['network', 'create', '--internal', network]);
  cleanup.unshift(['network', 'rm', network]);
  docker(['create', '--name', database, '--network', network, '--network-alias', 'db',
    '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=dental_integration', 'postgres:16-alpine']);
  cleanup.unshift(['rm', '--force', '--volumes', database]);
  docker(['start', database]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (docker(['exec', database, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'dental_integration'], false) === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready');
  for (const name of ['dental_upgrade', 'dental_shadow']) {
    docker(['exec', database, 'createdb', '-U', 'postgres', name]);
  }
  docker(['create', '--name', runner, '--network', network, '-w', '/repo/apps/api',
    '-e', 'DATABASE_URL=postgresql://postgres@db:5432/dental_integration',
    '-e', 'INTEGRATION_TEST=disposable-docker', '-e', 'NODE_ENV=test', '-e', 'LOG_LEVEL=error',
    '-e', 'STAFF_DASHBOARD_TOKEN=synthetic-integration-staff-token',
    image, 'node', '/repo/node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts']);
  cleanup.unshift(['rm', '--force', '--volumes', runner]);
  docker(['start', '--attach', runner]);
} finally {
  const results = cleanup.map((args) => docker(args, false));
  if (results.some((code) => code !== 0)) {
    console.error(`Check cleanup for resources with prefix ${prefix}`);
    process.exitCode = 1;
  }
}
