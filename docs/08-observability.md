# Phase 8 - Observability

Phase 8 adds a local Kubernetes observability stack for the API. The approach
uses Prometheus-compatible application metrics, Prometheus for scraping and
alert evaluation, and Grafana for dashboards.

## Signals and SLOs

| Signal | Metric / query | Learning-project objective |
| --- | --- | --- |
| Availability | `up{job="dental-clinic-api"}` | 99.5% successful Prometheus scrapes over 30 days |
| Error rate | `rate(dental_clinic_http_requests_total{status_code=~"5.."}[5m])` | Below 5% for five minutes |
| Latency | `histogram_quantile(0.95, sum(rate(dental_clinic_http_request_duration_seconds_bucket[5m])) by (le))` | p95 below 500 ms under normal local load |
| Traffic | `sum(rate(dental_clinic_http_requests_total[5m]))` | Observe request rate and sudden drops |
| Saturation | `rate(dental_clinic_process_cpu_seconds_total[5m])` and `dental_clinic_process_resident_memory_bytes` | Investigate sustained CPU or memory growth |

## Deploy locally

```powershell
# Create an untracked Grafana admin credential.
$grafanaPassword = [guid]::NewGuid().ToString('N')
kubectl -n dental-clinic create secret generic grafana-secret `
  --from-literal=GF_SECURITY_ADMIN_USER=admin `
  --from-literal=GF_SECURITY_ADMIN_PASSWORD=$grafanaPassword `
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -k k8s/observability
kubectl -n dental-clinic rollout status deployment/prometheus
kubectl -n dental-clinic rollout status deployment/grafana
```

## Email alert routing

Prometheus forwards firing alerts to Alertmanager. Before applying the stack,
create a real, untracked Secret from
`k8s/observability/alertmanager-config.example.yaml`; replace the SMTP host,
sender, password, and admin recipient first. Do not apply the example file as
is or commit the resulting Secret.

```powershell
Copy-Item k8s/observability/alertmanager-config.example.yaml $env:TEMP\alertmanager-secret.yaml
# Edit the copied file with your SMTP credentials and recipient, then:
kubectl apply -f $env:TEMP\alertmanager-secret.yaml
kubectl -n dental-clinic rollout status deployment/alertmanager
```

`DentalClinicHighServerErrorRate` fires when 5xx responses exceed **1% for
five minutes**. Alertmanager emails both firing and resolved notifications.

After the API image containing `/metrics` is deployed, open the tools locally:

```powershell
kubectl -n dental-clinic port-forward service/prometheus 9090:9090
kubectl -n dental-clinic port-forward service/grafana 3002:3000
```

- Prometheus: <http://127.0.0.1:9090/targets> and
  <http://127.0.0.1:9090/alerts>
- Grafana: <http://127.0.0.1:3002> using the generated `admin` password.
  The **Dental Clinic API Overview** dashboard is provisioned automatically.

## Alerting scope

`DentalClinicApiDown` fires after two minutes of unsuccessful scrapes and
`DentalClinicHighServerErrorRate` fires if the 5xx rate exceeds 5% for five
minutes. They are visible in Prometheus. Routing alerts to Slack, email, or a
pager requires an Alertmanager receiver and credentials, which should be added
as an environment-specific Kubernetes Secret rather than committed.
