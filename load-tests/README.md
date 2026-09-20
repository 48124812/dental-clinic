# Read-only k6 / HPA demo

HPA status: **configured, pending runtime verification**. This directory does
not claim a verified scaling result or production capacity.

Only `GET /api/doctors` is exercised. No patient or appointment endpoint is
used. Response bodies are discarded, request tags are fixed, and redirects
are disabled. Allowed origins are HTTP localhost, 127.0.0.1,
host.docker.internal, and api.dental-clinic.svc.cluster.local (optional port).
Public origins, including Render, are rejected. Never tunnel a production
service behind an allowed local address; use an isolated database with demo data.

## Local smoke test

For a fully disposable database/API with automatic cleanup, first run
`docker compose build api web`, then `./load-tests/smoke-docker.ps1` from PowerShell.
It uses an internal Docker network, a tmpfs PostgreSQL database with demo seed,
no published ports, and no `.env` files. It saves summary/log/metadata under a
unique gitignored `load-tests/results/` directory. PostgreSQL trust auth is used
only within that disposable network; it is not a deployment credential pattern.
The script removes only the containers/network it creates, even on failure.

From the repository root, with k6 installed and a local demo API running:

```powershell
New-Item -ItemType Directory -Force load-tests/results | Out-Null
$env:BASE_URL = 'http://127.0.0.1:3001'
$env:PROFILE = 'smoke'
k6 run --summary-export=load-tests/results/smoke.json load-tests/read-only.js
```

Default: 1 VU for 15 seconds with a one-second sleep per iteration. With Docker
Desktop, use the same script without installing k6 on the host:

```powershell
docker run --rm `
  --mount "type=bind,source=$((Get-Location).Path)/load-tests,target=/scripts,readonly" `
  -e BASE_URL=http://host.docker.internal:3001 -e PROFILE=smoke `
  grafana/k6:1.0.0 run /scripts/read-only.js
```

## Gradual load

Only after a successful smoke test on an isolated demo environment:

```powershell
$env:PROFILE = 'ramp'
$env:PEAK_VUS = '20'
k6 run --summary-export=load-tests/results/ramp.json load-tests/read-only.js
```

The default ramp is 0 → 5 VUs (1m) → 10 (2m) → 20 (2m), hold 20 (3m), then
reduce to 0 (2m). `PEAK_VUS` accepts 1–100; start at 20 and increase only after
observing API/DB/node headroom. VUs are concurrent virtual users, not fixed RPS.
Connections are reopened per request to distribute traffic through the Service;
this intentionally includes connection setup cost and is not a keep-alive benchmark.

Thresholds: HTTP failure rate < 1%, p95 HTTP request duration < 500ms, checks > 99%.
HTTP success means exactly 200. Sustained failure threshold evaluation can abort
the run after 30 seconds; p95/check thresholds determine final exit status. These
are demo acceptance targets, not measured results or the Prometheus 5% paging rule.

## Kubernetes run

Follow [HPA setup and observations](../docs/10-autoscaling-load-test.md) first.
Use a load generator inside the cluster so Service traffic reaches all ready
replicas. A Service port-forward selects one Pod and does not test balancing.

```powershell
kubectl -n dental-clinic create configmap k6-read-only-script `
  --from-file=read-only.js=load-tests/read-only.js `
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create -f load-tests/k6-job.yaml
kubectl -n dental-clinic logs -f job/k6-read-only |
  Tee-Object -FilePath load-tests/results/k6-job.log
kubectl -n dental-clinic get job k6-read-only
```

Create `load-tests/results/` first. The Job runs the ramp profile, does not retry,
and has a 12-minute deadline. It retains its Pod so logs can be saved. The final
JSON summary is printed between `K6_SUMMARY_JSON_BEGIN/END`, including on threshold
failure; check the Job/Pod exit code as well as the output. The `/results` emptyDir
is ephemeral, so logs must be saved before removing the Job. For another run,
choose a new Job name in a local copy; do not overwrite or delete an active test.
The pinned image must be reachable from the cluster.

## Offline verification (no HTTP requests)

```powershell
node --check load-tests/read-only.js
node --experimental-vm-modules --test load-tests/read-only.test.mjs
# Equivalent package script (also run in CI): pnpm test:load-config
docker run --rm `
  --mount "type=bind,source=$((Get-Location).Path)/load-tests,target=/scripts,readonly" `
  grafana/k6:1.0.0 inspect /scripts/read-only.js
```

The 13 Node tests execute the script with synthetic k6 modules: they verify safe
targets, read-only requests, stage configuration and thresholds. They do not
measure throughput, latency, or HPA behavior. Node may emit an expected experimental
VM Modules warning. `k6 inspect` uses the real k6 runtime but does not generate load.

Results are gitignored. Save reviewed, aggregate evidence (no secrets or patient
data) separately if it will be included in a portfolio. See
[verification](../docs/09-project-verification.md) for what was actually run.
