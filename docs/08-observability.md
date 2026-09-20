# Phase 8 — Observability

核心 metrics、Prometheus scrape、Grafana dashboard 與 Alertmanager manifests 已實作。外部 SMTP receiver、實際送達驗證與 Loki 尚未完成。本次結果見 [驗證紀錄](09-project-verification.md)，以下為可在本機叢集重現的步驟。

## Metrics、queries 與目標

API `registerMetrics()` 輸出 `dental_clinic_` 前綴。HTTP labels 為 `method`、`route`、`status_code`；CPU 與記憶體來自 prom-client default process metrics。已匹配的路由使用 template，未知路徑統一 `unmatched`，不把原始路徑／query 放入 label。一般日誌僅記錄 method、route template、status 與 request ID，不記錄 body、原始 URL、認證 headers 或錯誤內容；Prisma 原始 query/error logging 已停用。

以下 HTTP 查詢排除 `/health`、`/ready`、`/metrics`，避免探針與 scrape 稀釋使用者請求的錯誤比例。

| Signal | Query | 解讀 |
| --- | --- | --- |
| Traffic | `sum(rate(dental_clinic_http_requests_total{job="dental-clinic-api",route!~"/health|/ready|/metrics"}[5m]))` | 全 API replicas 每秒請求 |
| 5xx ratio | `(sum(rate(dental_clinic_http_requests_total{job="dental-clinic-api",route!~"/health|/ready|/metrics",status_code=~"5.."}[5m])) or vector(0)) / sum(rate(dental_clinic_http_requests_total{job="dental-clinic-api",route!~"/health|/ready|/metrics"}[5m]))` | 全 API 5xx / 所有應用請求 |
| p95 latency | `histogram_quantile(0.95, sum by (le) (rate(dental_clinic_http_request_duration_seconds_bucket{job="dental-clinic-api",route!~"/health|/ready|/metrics"}[5m])))` | 秒；先合併 buckets 再取 percentile |
| CPU | `rate(dental_clinic_process_cpu_seconds_total{job="dental-clinic-api"}[5m])` | 每個 process 使用的 CPU cores；1 = 一顆 core，不是 Pod limit 使用率 |
| Memory | `dental_clinic_process_resident_memory_bytes{job="dental-clinic-api"}` | 每個 process 的 RSS bytes，不是 memory limit 使用率 |
| Scrape health | `up{job="dental-clinic-api"}` | 每個 API Pod 的 metrics 是否可抓取，不代表病患端可用性 |

5xx ratio **大於 5% 並持續 5 分鐘**才告警。不要使用 `clamp_min(request_rate, 1)`：流量不足 1 req/s 時會低估錯誤比例。有流量但從未出現 5xx 時以 0 補 numerator；完全無流量時 ratio 為 NaN／無資料，不以 0 宣稱健康。`DentalClinicApiDown` 包含 `absent(up{...})`，所有 targets 消失時也能偵測。

學習目標：30 天成功 scrape 比例 99.5%、本機正常負載 p95 < 500ms、5xx ratio ≤ 5%。這些是待量測目標，不是已達成的 SLA；目前沒有長期 SLO 報告與 latency alert。

## Email failure events

預約 commit 後的 Email 嘗試屬於 best-effort。Email Service 沿用呼叫端的 Fastify logger，處理初始 DB 查詢、attempt 更新、Provider 呼叫與完成狀態寫入；正常失敗只記錄一次 `email_delivery_failed`。若連 FAILED 狀態也寫不進 DB，另記錄 `email_delivery_failure_record_failed`。呼叫端的最終 Promise boundary 只在 service 意外 reject 時記錄 `email_delivery_unexpected_failure`，不重複記錄已處理的失敗。

事件只含固定名稱、delivery ID、固定 error category 與 retryable flag（及 logger 的標準時間／request ID 等 metadata）。不記錄姓名、電話、Email、健保識別資訊、HTML、DB URL、Provider body、原始 error message 或 stack；`EmailDelivery.lastError` 也只保存固定分類。`retryable` 只是診斷提示，沒有 worker 或自動重試。Provider 已接受但 DB 狀態寫入失敗時，寄送狀態可能不確定，不可盲目重寄；目前沒有 exactly-once 保證。

## 1. 準備 Secrets 與部署

先依 [Kubernetes 部署](06-kubernetes-deployment.md) 啟動應用，確認 namespace 存在。

```powershell
$grafanaPassword = [guid]::NewGuid().ToString('N')
kubectl -n dental-clinic create secret generic grafana-secret `
  --from-literal=GF_SECURITY_ADMIN_USER=admin `
  --from-literal=GF_SECURITY_ADMIN_PASSWORD=$grafanaPassword `
  --dry-run=client -o yaml | kubectl apply -f -

Copy-Item k8s/observability/alertmanager-config.example.yaml k8s/observability/alertmanager-config.yaml
# 在 gitignored 的 alertmanager-config.yaml 設定 SMTP、sender、password、receiver。
# 尚無外部帳號時，將 alertmanager.yml 內容改成以下不寄信的設定：
# route:
#   receiver: local-only
# receivers:
#   - name: local-only
kubectl apply -f k8s/observability/alertmanager-config.yaml
kubectl apply -k k8s/observability
kubectl -n dental-clinic rollout status deployment/alertmanager
kubectl -n dental-clinic rollout status deployment/prometheus
kubectl -n dental-clinic rollout status deployment/grafana
```

SMTP placeholder 不可直接拿來驗證寄送成功。Secret 更新後需 `kubectl -n dental-clinic rollout restart deployment/alertmanager`；Prometheus ConfigMap 更新後可 rollout restart Prometheus。此 stack 未配置持久化儲存，Pod 重建可能丟失歷史資料。

## 2. 確認每個 API Pod 可被 scrape

`api-metrics` 是 headless Service。Prometheus DNS discovery 對每個 Pod IP 的 `:3001/metrics` 建立獨立 target，避免負載平衡 Service 將不同 process counter 混成同一條時序。`publishNotReadyAddresses=true` 讓 DB readiness 失敗時仍能觀察存活的 API。

```powershell
kubectl -n dental-clinic get pods -l app.kubernetes.io/name=api -o wide
kubectl -n dental-clinic get endpointslice -l kubernetes.io/service-name=api-metrics
# 以下各開一個 terminal
kubectl -n dental-clinic port-forward service/api 8081:3001
kubectl -n dental-clinic port-forward service/prometheus 9090:9090
kubectl -n dental-clinic port-forward service/grafana 3002:3000
kubectl -n dental-clinic port-forward service/alertmanager 9093:9093
```

在另一個 terminal：

```powershell
(Invoke-WebRequest http://127.0.0.1:8081/metrics).Content
1..60 | ForEach-Object {
  Invoke-RestMethod http://127.0.0.1:8081/api/doctors | Out-Null
  Start-Sleep -Seconds 1
}
Invoke-RestMethod http://127.0.0.1:9090/api/v1/targets
```

確認 `/metrics` 有 HTTP counter/histogram 與 process metrics；Prometheus `/targets` 應有與 Pod IP 對應的 UP targets（預設 2 replicas）。至少等待兩次 scrape，5 分鐘視窗需累積樣本；沒有請求時不能將空白圖視為 query 錯誤。

## 3. Dashboard 與 alert 驗證

1. 開啟 `http://127.0.0.1:3002`，使用自行設定的 Grafana 密碼；開啟 **Dental Clinic API Overview**。
2. 對照上述五個 queries：request rate 為正、有流量且無錯誤時 ratio 為 0、p95 為秒、CPU/RSS 按 instance 呈現。CPU 100% 代表一顆 core，不能當作已用滿 Pod 配額。
3. 開啟 `http://127.0.0.1:9090/alerts` 與 `/rules`，確認 5xx expression 為 `> 0.05`、`for: 5m`，API Down 為 `for: 2m`。
4. 僅在可丟棄的本機環境將 API scale 到 0，等待 DNS 更新與 2 分鐘告警窗口；確認 API Down firing，再恢復原 replicas。恢復後確認 resolved。不要對正式服務做故障注入。
5. 5xx 行為可在專用測試 DB 中模擬 DB 中斷：經 API Pod port-forward 發出 catalog 請求，`/ready` 應為 503、`/health` 為 200；持續應用請求超過 5 分鐘，確認 ratio 與 alert。readiness 失敗後 Service 不會路由到 Pod，需直接 port-forward 該 Pod，不能以一般 Service 流量做此實驗。
6. 在 `http://127.0.0.1:9093` 確認 alert 已抵達 Alertmanager。有配置 SMTP 才檢查外部信箱的 firing/resolved 通知，並查看 `kubectl -n dental-clinic logs deployment/alertmanager`。將測試時間、receiver、firing/resolved 結果另存驗證紀錄；目前未完成此步驟。

## 規則語法檢查

Kustomize 只驗證 Kubernetes YAML 組合，不解析 ConfigMap 裡的 PromQL。部署後可用 image 內工具再查：

```powershell
kubectl -n dental-clinic exec deployment/prometheus -- promtool check config /etc/prometheus/prometheus.yml
kubectl -n dental-clinic exec deployment/prometheus -- promtool check rules /etc/prometheus/rules/api-alerts.yml
kubectl -n dental-clinic exec deployment/alertmanager -- amtool check-config /etc/alertmanager/alertmanager.yml
```

本次未執行叢集內 promtool/amtool，也未宣稱 SMTP 已送達；以上步驟是外部驗收方式。
