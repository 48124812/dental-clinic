# 專用 kind 叢集：牙醫網站部署與操作

> 2026-10-11 最新結果：本機暫時降低 HPA target 至 10%，已驗證 2 → 3 → 4，停止負載並恢復 65% 後縮回 2；不是原設定的容量驗證。Grafana 五類指標查詢與資料來源已驗證。見 [HPA 紀錄](16-local-load-observation.md)與[監控展示](17-local-monitoring-demo.md)。下方日期段落保留歷史狀態。

2026-10-09 已部署至 `kind-dental-hpa-lab`，目前保留運行。此環境完全使用合成資料，與 Render 及原本 `docker-desktop` context 的部署分開。前置憑證／Metrics Server 設定見[專用叢集指南](14-local-kubernetes-certificates.md)。

**歷史進度：** 2026-10-10 後續已完成 20 VU 漸進負載與至少五分鐘負載後觀察。請求／Threshold 通過，CPU 未達目標而維持兩個副本，尚未驗證負載擴縮；計時差異與實驗限制見[完整紀錄](16-local-load-observation.md)。以下 Smoke／初次部署段落是當時的歷史結果。

**2026-10-10 更新：** 原暫存 `lab-db` 已失效，保留該 Pod 並建立替代 `lab-db-smoke-20261010-55ea0c36`、重新 Migration／Seed 後恢復服務。`lab-db` Service 當時連到替代庫，舊預約沒有還原。不要在替代庫仍運行時另行重建原 `lab-db`，避免同一 Service 選到兩個不同資料庫。下方重建步驟只適用全新空叢集，不能直接用來修復此既有環境。

此專用叢集的 k6 Smoke Test 已實際通過：1 VU、15 秒、15/15 HTTP 200、p95 3.16 ms；測試 Job 已清理。詳見[驗證紀錄](09-project-verification.md)。尚未執行漸進負載與 HPA Scale Up／Scale Down。

## 開啟本機網站

本輪已啟動僅綁定 loopback 的 port-forward，可開啟 **http://127.0.0.1:18080**。它不是公開網路網址，其他人無法透過自己的 localhost 存取你的電腦。

若電腦或 Docker 重啟後無法開啟，先確認 Docker／kind 節點恢復 Ready，再在 repository 根目錄的 PowerShell 執行：

```powershell
$labArgs = @('--kubeconfig', '.private/kind-lab/kubeconfig', '--context', 'kind-dental-hpa-lab')
kubectl @labArgs -n dental-clinic get pods,hpa
kubectl @labArgs -n dental-clinic port-forward service/lab-gateway 18080:8080 --address 127.0.0.1
```

port-forward 需保持執行；按 Ctrl+C 只停止本機入口，不刪除叢集。若埠已占用，不要終止不明程序，先確認是否為原本的 port-forward。這次背景轉發 PID 與 Log 在 Git ignored 的 `.private/kind-app/`，PID 可能被系統重用，不可直接照舊 PID 終止程序。

本機 Nginx gateway 將 `/api/` 轉到 API Service，其餘轉到 Web Service，避免只轉發 Web 時瀏覽器預約請求沒有路由。未加 TLS，僅供 loopback Demo；不是正式環境 Ingress 替代方案。HPA 負載實驗應使用叢集內 k6 Job，不能把 port-forward 本身當成容量量測工具。

## 已部署內容

| 元件 | 設定 |
| --- | --- |
| Namespace | 專用 kind 叢集內的 `dental-clinic`；與另一個 context 的同名 namespace 不同 |
| PostgreSQL | `lab-db` Pod、PostgreSQL 16、隨機密碼 Secret、記憶體 emptyDir；沒有外部 DB URL |
| Migration／Seed | 獨立 `lab-migrate`／`lab-seed` Job，成功後才部署應用；一般 API 啟動兩個旗標皆 false |
| API | 已發布的 SHA image、CPU request 100m；由 HPA 管理 replicas |
| Web | 同一 SHA image、2 replicas，INTERNAL_API_URL 指向叢集內 API |
| HPA | autoscaling/v2、2–10 replicas、CPU utilization target 65%，保留既有擴縮 behavior |
| 本機入口 | `lab-gateway`，只透過 127.0.0.1 port-forward 使用 |
| 監控 | Prometheus、Grafana、Alertmanager；告警 receiver 不對外送出通知 |

API/Web tag 固定為 `sha-0d8a1757a0232add134dc407f490eafb6e6f1441`，不是自動跟隨工作區或 main。變更版本時要同步修改 overlay 與 Migration Job image，並依正式 Migration 順序操作。

**暫存資料庫限制：刪除 DB Pod 或叢集會遺失全部合成資料。** 此設計方便隔離驗證，不是持久化、高可用或備份方案。遇到 DB Pod 重建，不要期待舊預約仍存在；需先停止測試並確認是否必須重新初始化。

## 新空叢集重建順序

目前已部署成功，不需要重跑。重建時必須明確使用本頁 `$labArgs`，不可省略 kubeconfig/context。

1. 確認專用叢集與 Metrics Server Ready，確認 namespace 不存在；若已有資源，先檢查，不覆寫 Secret。
2. 建 namespace 與隨機 Secret（只透過 stdin 傳入，不列印或存進公開檔）：

```powershell
$labArgs = @('--kubeconfig', '.private/kind-lab/kubeconfig', '--context', 'kind-dental-hpa-lab')
kubectl @labArgs get namespaces
# 只有確認是新的專用環境，且 dental-clinic 尚不存在，才繼續。
kubectl @labArgs create namespace dental-clinic
if ($LASTEXITCODE -ne 0) { throw 'Namespace creation failed; inspect existing resources' }
$labPassword = [guid]::NewGuid().ToString()
$labSecret = @{
  apiVersion = 'v1'; kind = 'Secret'
  metadata = @{name = 'database-secret'; namespace = 'dental-clinic'}
  stringData = @{
    POSTGRES_PASSWORD = $labPassword
    DATABASE_URL = "postgresql://postgres:${labPassword}@lab-db:5432/dental_lab"
  }
}
$labSecret | ConvertTo-Json -Depth 5 | kubectl @labArgs create -f -
if ($LASTEXITCODE -ne 0) { throw 'Secret creation failed' }
Remove-Variable labPassword,labSecret
kubectl @labArgs -n dental-clinic apply -f k8s/local-kind/app/postgres.yaml
kubectl @labArgs -n dental-clinic wait --for=condition=Ready pod/lab-db --timeout=120s
if ($LASTEXITCODE -ne 0) { throw 'Database not Ready' }
```

3. 從既有 Migration manifest 產生指定 SHA 的一次性 Job，Migration 成功後才初始化 Seed：

```powershell
New-Item -ItemType Directory -Force .private/kind-app | Out-Null
$apiImage = 'ghcr.io/48124812/dental-clinic-api:sha-0d8a1757a0232add134dc407f490eafb6e6f1441'
$migrationJson = kubectl set image --local -f k8s/base/migrate-job.yaml "migrate=$apiImage" -o json
if ($LASTEXITCODE -ne 0) { throw 'Migration rendering failed' }
$migration = ($migrationJson -join "`n") | ConvertFrom-Json
$migration.metadata.name = 'lab-migrate'
$migration.spec.backoffLimit = 0
$migration.spec.template.spec.restartPolicy = 'Never'
$migration | ConvertTo-Json -Depth 30 | kubectl @labArgs create -f -
if ($LASTEXITCODE -ne 0) { throw 'Migration submission failed' }
kubectl @labArgs -n dental-clinic wait --for=condition=complete job/lab-migrate --timeout=180s
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; do not deploy application' }
$migration.metadata.name = 'lab-seed'
$migration.spec.template.spec.containers[0].command = @('node','--import','tsx','prisma/seed.ts')
$migration | ConvertTo-Json -Depth 30 | kubectl @labArgs create -f -
if ($LASTEXITCODE -ne 0) { throw 'Seed submission failed' }
kubectl @labArgs -n dental-clinic wait --for=condition=complete job/lab-seed --timeout=120s
if ($LASTEXITCODE -ne 0) { throw 'Seed failed; inspect before proceeding' }
```

4. 只有兩個 Job 成功後才套用應用 overlay：

```powershell
kubectl @labArgs apply --dry-run=server -k k8s/local-kind/app
if ($LASTEXITCODE -ne 0) { throw 'Application validation failed' }
kubectl @labArgs apply -k k8s/local-kind/app
if ($LASTEXITCODE -ne 0) { throw 'Application deployment failed' }
kubectl @labArgs -n dental-clinic rollout status deployment/api --timeout=180s
kubectl @labArgs -n dental-clinic rollout status deployment/web --timeout=180s
kubectl @labArgs -n dental-clinic rollout status deployment/lab-gateway --timeout=180s
kubectl @labArgs -n dental-clinic get pods,hpa
kubectl @labArgs -n dental-clinic top pods
```

不要直接 apply 整個 overlay 來取代 Migration／Seed 前置步驟，也不要重建已完成 Job 來強迫重跑。本機 DB／gateway 是專用 overlay 額外提供，既有 base 未改動。

監控另依[Observability 指南](08-observability.md)操作，但每個命令都必須加 `$labArgs`。本次使用新的 Grafana 隨機憑證與無外部通知的 Alertmanager receiver，不能複製既有叢集 Secret 或 SMTP 設定。需要 Grafana UI 時另建 loopback port-forward，再以私人方式取得此 lab 的憑證，不將值放進對話或截圖。

## 本輪實測與下一步

- Migration／Seed Complete，API 2/2、Web 2/2、gateway 1/1 Ready。
- HPA 已部署且能取得 CPU utilization（單次快照約 3–4% / target 65%），目前 2 replicas。這是 idle 指標，不是負載擴縮驗證。
- localhost 入口 `/doctors` 200、`/api/doctors` 回 4 位合成醫師；透過同源 HTTP 完成建立 201、查詢 200、取消 200、同時段重訂 201，舊取消紀錄保留，新預約已取消。未執行完整瀏覽器 E2E。
- `/health`、`/ready` 200；Prometheus 兩個 API targets UP，Grafana health／Dashboard API 及五類 PromQL 查詢成功。外部告警送達未測。
- 初次檢查早於監控 rollout 完成，發生 fetch failed；監控 Ready 後重新執行完整檢查成功。
- 未執行 k6 或高負載；下一步應先在此叢集跑 Smoke Test，再進行有資源監控與停止條件的漸進負載。HPA 的 **負載 Scale Up／Scale Down 仍待 runtime verification**。

此輪保留部署與本機入口，方便繼續操作。原始合成測試摘要在 Git ignored 的 `.private/kind-app/`；不提交 Secret、原始預約資料或 Log。未 Commit／Push，未操作 Render 或另一個 Docker Desktop Kubernetes 叢集。
