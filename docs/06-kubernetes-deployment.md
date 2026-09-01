# Phase 7 - Kubernetes deployment

This folder turns the existing Dockerized web and API services into Kubernetes
workloads. It intentionally uses an external managed PostgreSQL database; do
not run a production database in this learning cluster.

## Prerequisites

- A Kubernetes cluster and `kubectl` context pointing at it.
- An Ingress controller if the site must be publicly reachable.
- A PostgreSQL connection URL.
- The GitHub Container Registry packages published by the `Publish container images` CI job must be readable by the cluster. For private packages, create an `imagePullSecret` and add it to both Deployments and the migration Job.

## Deploy

```powershell
# 1. Create the namespace and the non-secret resources.
kubectl apply -k k8s/base

# 2. Create the real database secret. Do not commit this file.
Copy-Item k8s/base/database-secret.example.yaml k8s/base/database-secret.yaml
# Edit DATABASE_URL, then apply it.
kubectl apply -f k8s/base/database-secret.yaml

# 3. Run migrations before API replicas begin serving traffic.
kubectl delete job migrate --ignore-not-found
kubectl apply -f k8s/base/migrate-job.yaml
kubectl wait --for=condition=complete job/migrate --timeout=120s

# 4. Roll out the application and verify it.
kubectl rollout status deployment/api
kubectl rollout status deployment/web
kubectl get pods,services -n dental-clinic
```

For the demo seed, run `node --import tsx prisma/seed.ts` once in a separate
Job using the API image. Do not enable `RUN_SAMPLE_SEED` in a real deployment.

## Image versioning

CI publishes `latest` and immutable `sha-<commit>` tags to GHCR. Before a
production rollout, replace each `latest` image in `k8s/base` with a tested
`sha-...` tag and record that commit in the release notes.

The API and Web Deployments include readiness and liveness probes. The API is
exposed only inside the cluster; the Web Service is the public Ingress target.
