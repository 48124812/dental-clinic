# Deployment verification

## Live services

These addresses were checked on 2026-09-21 (Asia/Taipei); results below are a
point-in-time audit, not an uptime guarantee. See also [local verification](09-project-verification.md).

- Web: <https://dental-clinic-web-ejw6.onrender.com>
- API health: <https://dental-clinic-api-ylv9.onrender.com/health>
- API doctors: <https://dental-clinic-api-ylv9.onrender.com/api/doctors>
- API services: <https://dental-clinic-api-ylv9.onrender.com/api/services>

## Online readiness audit (2026-09-21)

Scope: public Render HTTP requests and an isolated headless Chrome browser, without Render login, privileged tokens, direct database access, migration, deployment, or load testing. The working tree started clean at `main`, commit `f6d37dd877c0746faf79e1b6010531e1cf6c543d`.

| Check | Observed result |
| --- | --- |
| Original README Web URL | **Fail:** `https://dental-clinic-web.onrender.com` returned 200 but displayed an unrelated English DentalArt website. No form was submitted there. |
| Correct Web `/` | **Pass:** `https://dental-clinic-web-ejw6.onrender.com/` returned 200 and displayed this project's Chinese clinic homepage. |
| Web `/doctors`, `/services`, `/appointments/new`, `/appointments/lookup` | **Pass:** browser navigation returned 200; catalog cards and booking/lookup controls loaded. |
| API `/health` | **Pass:** 200, `status=ok`, `version=render`; first authorized HTTP request took **42.40 s**, reporting approximately 5.95 s process uptime. |
| API `/ready` | **Pass:** 200, `status=ready`, DB check OK; observed HTTP duration **0.66 s**. |
| API `/api/doctors`, `/api/services` | **Pass:** 200 with **4 doctors / 9 services**; observed durations **0.20 / 0.13 s**. |
| Browser booking cycle | **Pass:** choose doctor/date/time → enter synthetic values → confirm → save code → look up → confirm cancellation → rebook the same doctor/time with a different code → cancel again. Old cancelled record remained queryable. |
| Browser-origin API checks | **Pass:** rebooking the cancelled slot returned **201**, with different ID and reference; duplicate active slot **409**; correct old lookup **200/CANCELLED**; wrong phone suffix **404**; cancellation **200/CANCELLED**. |
| Staff/Admin API without a token and with a deliberately invalid token | **Pass:** `/api/staff/appointments` and `/api/admin/doctors` both returned **401**. No privileged token was read or entered. |
| Public HTML / JavaScript inspection | **Pass within inspected scope:** 23 HTML/script resources across public, Staff, and Admin pages; no database URL, private-key, provider-token, or server-secret-assignment patterns matched. This is not a full security audit or proof that no secret could ever leak. |
| Browser-only offline simulation | **Fail in deployed UI:** lookup displayed raw `Failed to fetch`. Local fixes replace it with a safe Chinese message; no live outage was induced. |
| README first screen | **Fail in published revision, fixed locally:** wrong Web URL, duplicate legacy introduction, stale feature backlog, and unsupported Kubernetes runtime claims. |

All three successful synthetic audit bookings were cancelled via the normal API; no records were deleted. Only synthetic values were used, including a non-deliverable `.invalid` email and an invalid phone/identifier. No actual reference codes, IDs, screenshots containing records, tokens, or raw request bodies are published in this report.

### Cold start and visible loading

The first API request's **42.40 s** and short process uptime are consistent with startup, but no idle state or Render event log was observed; exact cold-start duration is **Unknown**. One initial HTTP request to the corrected Web URL took **8.17 s** (200, Next.js HTML). A subsequent rendered browser navigation reported approximately **1.00 s** load time; this is a warm navigation, not cold-start evidence. Do not compare these different measurements as a benchmark.

The entire initial Web wake-up screen was not captured, so absence of a blank/error screen during true cold start is **Unknown**. After startup, the Chinese homepage and forms rendered normally. The deployed source lacked an application loading fallback and showed a raw network error during simulated browser disconnection. Local `loading.tsx` / error fallback / translated form feedback address application-side waiting and failure; they cannot render before Render starts the Web process. [Render documentation](https://render.com/docs/free) describes its own startup screen and approximate one-minute wake-up.

### Deployment revision evidence

Public GitHub API reported main at `f6d37dd877c0746faf79e1b6010531e1cf6c543d` and successful deployment records for both services at that SHA:

- [Web deployment record](https://api.github.com/repos/48124812/dental-clinic/deployments/6553646468) / [success status and corrected environment URL](https://api.github.com/repos/48124812/dental-clinic/deployments/6553646468/statuses), completed 2026-09-20 14:08:34 UTC.
- [API deployment record](https://api.github.com/repos/48124812/dental-clinic/deployments/6553646499) / [success status](https://api.github.com/repos/48124812/dental-clinic/deployments/6553646499/statuses), completed 2026-09-20 14:09:01 UTC.
- [CI run for this commit](https://github.com/48124812/dental-clinic/actions/runs/35515542354): verification, container validation, and image publication all reported success.

**Latest-main deployment: Pass at the public deployment-record level. Runtime SHA attestation: Unknown.** `/health` exposes only `version=render`, and the Web page does not provide a runtime SHA. This audit did not log in to Render or inspect its private logs. Local changes in this audit are not included in these deployment records.

### Delivery conclusion

The **corrected URL supports the basic anonymous Online Demo**, without local setup or a Render account. The **currently published README does not yet meet the README-only entry requirement** because its link points to another site. Local documentation and UI fixes must be reviewed and published by the maintainer before treating the complete handoff as finished; no commit, push, PR, remote change, or deployment was performed in this audit.

Remaining limitations: real cold-start visual verification, runtime SHA attestation, private Staff/Admin workflows, email delivery/retry, browser coverage beyond the audited flow, and production identity management. No Kubernetes deployment or HPA scaling was verified. Use the [three-minute flow and fallback](DEMO.md#online-demo-script-3-minutes).

## Delivery flow

```text
feature branch → pull request → CI checks → merge to main
  → Render builds and deploys Web/API → migration + demo seed → live service
  → Render smoke-test workflow checks health, doctors, and services
```

The `Render smoke test` workflow can be run manually from the Actions tab and
runs weekly. Its deployment target is stored in the repository variable
`RENDER_API_URL`, so the public address is not hard-coded into workflow logic.

## Release checklist

1. CI and container validation pass on the pull request.
2. Merge to `main` and wait for both Render services to be `Live`.
3. Run **Render smoke test** in GitHub Actions.
4. Open the Web URL and confirm the doctors and services pages display data.
5. Create a GitHub Release with the deployed commit and any known limitations.

## Current limitations

- Render Free services can sleep while idle, so the first request may be slow.
- The Blueprint defaults sample seeding to off; empty-database bootstrap is an explicit temporary opt-in. Admin catalog and Staff UI
  exist, but require separately configured environment tokens; full account
  authentication is not implemented.
- Kubernetes manifests are a separate deployment example; this online audit
  did not deploy or validate Kubernetes workloads. HPA remains **configured,
  pending runtime verification**. Follow the [migration-first SHA rollout](06-kubernetes-deployment.md) for separate runtime checks.
