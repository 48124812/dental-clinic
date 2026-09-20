# Phase 7 — Kubernetes deployment

保留外部 PostgreSQL、API/Web Deployment 與 Kustomize 架構。Base 的 `latest` 僅為展示預設；發佈必須使用已經 CI 驗證的完整 commit SHA tag，API、Web、migration 使用同一 commit。SHA tag 不應覆寫；需要 registry 層級不可變保證時另記錄並使用 image digest。

## 前置條件

- 正確的 `kubectl` context、可連線的 PostgreSQL、已發布的 GHCR images。
- 私有 GHCR package 需配置 imagePullSecret，套用到兩個 Deployment 與 migration Job。
- 公開流量需 Ingress controller、DNS 與 TLS。`ingress.example.yaml` 是需修改的範本。
- 本頁命令由 repository 根目錄執行，PowerShell 原生命令失敗時立即停止。

## 1. Namespace 與 Secret（還不啟動 Deployment）

```powershell
kubectl config current-context
kubectl apply -f k8s/base/namespace.yaml
Copy-Item k8s/base/database-secret.example.yaml k8s/base/database-secret.yaml
# 編輯 DATABASE_URL；若要使用後台，在 stringData 加上
# STAFF_DASHBOARD_TOKEN 與 ADMIN_DASHBOARD_TOKEN，各為不同的隨機 24+ 字元值。
kubectl apply -f k8s/base/database-secret.yaml
```

實際 Secret 檔已 gitignore。既有設定不要重新覆蓋。跨網域 API 使用者也需在 `api-config` 配置對應的 `CORS_ORIGIN`。

## 2. 產生指定版本的部署產物

```powershell
$releaseSha = git rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $releaseSha -notmatch '^[0-9a-f]{40}$') { throw 'Invalid commit SHA' }
# 確認這個 commit 的 main CI 已成功發布 image，否則改成已發布的 SHA。
$apiImage = "ghcr.io/48124812/dental-clinic-api:sha-$releaseSha"
$releaseDir = "k8s/releases/$releaseSha"
New-Item -ItemType Directory -Force "$releaseDir/app" | Out-Null
@"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../base
images:
  - name: ghcr.io/48124812/dental-clinic-api
    newTag: sha-$releaseSha
  - name: ghcr.io/48124812/dental-clinic-web
    newTag: sha-$releaseSha
"@ | Set-Content -Encoding utf8 "$releaseDir/app/kustomization.yaml"

$migrationJson = kubectl set image --local -f k8s/base/migrate-job.yaml "migrate=$apiImage" -o json
if ($LASTEXITCODE -ne 0) { throw 'Cannot render migration' }
$migration = ($migrationJson -join "`n") | ConvertFrom-Json
$migration.metadata.name = "migrate-$releaseSha"
$migration | ConvertTo-Json -Depth 50 | Set-Content -Encoding utf8 "$releaseDir/migrate.json"
kubectl kustomize "$releaseDir/app"
if ($LASTEXITCODE -ne 0) { throw 'Invalid application manifests' }
```

`k8s/releases/` 是 gitignored 的本機產物；review 渲染結果並在發佈紀錄保存 SHA（不可加入 Secret）。未改變 base，因此平常 `kubectl apply -k k8s/base` 不會執行 migration，但也不應拿它覆蓋已使用 SHA 的正式環境。

## 3. Migration 成功後才 Rollout

```powershell
kubectl apply -f "$releaseDir/migrate.json"
if ($LASTEXITCODE -ne 0) { throw 'Migration Job submission failed' }
kubectl -n dental-clinic wait --for=condition=complete "job/migrate-$releaseSha" --timeout=600s
if ($LASTEXITCODE -ne 0) {
  kubectl -n dental-clinic logs "job/migrate-$releaseSha"
  throw 'Migration did not complete; do not roll out the application'
}
kubectl apply -k "$releaseDir/app"
if ($LASTEXITCODE -ne 0) { throw 'Application apply failed' }
kubectl -n dental-clinic rollout status deployment/api --timeout=180s
if ($LASTEXITCODE -ne 0) { throw 'API rollout failed' }
kubectl -n dental-clinic rollout status deployment/web --timeout=180s
kubectl -n dental-clinic get pods,services,jobs
```

`migrate-job.yaml` **刻意不放入 base kustomization**：Job pod template 不可任意更新，一般 apply 不應意外重跑 migration。每個 SHA 有唯一 Job 名稱；同版本重複 apply 會保留已完成 Job，不再執行。新版本建立新 Job，Prisma `migrate deploy` 只套用未執行的 migration。

Job 失敗時先查看 logs 與 Prisma migration 狀態，處理失敗原因後才用明確的新 retry Job 名稱重試；不要自動 delete/recreate Job 或強制清除 migration 紀錄。更新期間舊 Pod 可能仍服務，schema 修改應保持向後相容（expand/contract）；必要的停機維護需另外規劃。Rollback image 不等於 rollback schema。

API liveness 為 `/health`，不查 DB；readiness 為 `/ready`，DB 失敗回 503 並停止接受 Service 流量。兩者用途不能互換。

## 4. 流量與功能驗證

GHCR Web image 的 `NEXT_PUBLIC_API_URL` 為空字串，瀏覽器呼叫同源 `/api/...`；Ingress 將 `/api` 路由到 API，其餘路由到 Web。不要設成 `/api`，否則 client 會組成 `/api/api/...`。Web 的 Server Components 使用 `INTERNAL_API_URL=http://api:3001`。

修改 `k8s/base/ingress.example.yaml` 的 host/TLS 後再套用。僅 port-forward Web 可以檢查伺服器端 catalog，但沒有 Ingress 的 `/api` 路由，不能視為 booking/Staff/Admin 完整驗證。獨立公開 API origin 的部署需重建 Web image 並設定 CORS。

```powershell
# 分別在不同 terminal 執行；均明確指定 namespace
kubectl -n dental-clinic port-forward service/api 8081:3001
kubectl -n dental-clinic port-forward service/web 8080:80
# 另一個 terminal
Invoke-RestMethod http://127.0.0.1:8081/health
Invoke-RestMethod http://127.0.0.1:8081/ready
Invoke-RestMethod http://127.0.0.1:8081/api/doctors
```

只在 demo DB 執行 sample seed；不要在每次 rollout 啟用 `RUN_SAMPLE_SEED`。監控另依 [Phase 8](08-observability.md) 部署。

選用 CPU HPA 時，release overlay 改引用 `../../../autoscaling`，仍使用相同 SHA 與 migration 步驟；之後持續使用此 overlay，避免固定 replicas 與 HPA 互相覆寫。前置條件與操作見 [HPA / k6](10-autoscaling-load-test.md)。

## 驗證範圍

歷史紀錄（2026-09-01）曾在 Docker Desktop 執行 migration、API/Web 各 2 replicas 與 catalog port-forward。本次完成 base 與 observability 的 `kubectl kustomize` 驗證，沒有重啟或部署叢集；歷史結果不代表本次修改已完成 runtime 驗證。
