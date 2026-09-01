# Deployment verification

## Live services

- Web: <https://dental-clinic-web.onrender.com>
- API health: <https://dental-clinic-api-ylv9.onrender.com/health>
- API doctors: <https://dental-clinic-api-ylv9.onrender.com/api/doctors>
- API services: <https://dental-clinic-api-ylv9.onrender.com/api/services>

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
- The Render database contains idempotent demo seed data; it is not a clinic
  administration workflow.
- Kubernetes resources are prepared but not deployed until a cluster is chosen.
