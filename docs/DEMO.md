# Technical Demo Guide

Cloud-Native Dental Appointment Platform 提供預約流程、診所操作、容器交付與監控的技術展示。本指南從 repository 根目錄執行 PowerShell 指令，只使用合成資料及專用 demo 環境。

This is an engineering portfolio project and is not intended to process real patient data in production.

以下操作步驟不代表每個流程已完成 E2E 驗證。實際執行範圍見 [verification records](09-project-verification.md)。公開 Render 網址不作為壓測目標。

## Quick Functional Demo

先依根目錄 [Quick start](../README.md#quick-start) 啟動本機 API/Web，或依下節啟動 Compose 並載入 demo seed。

| 操作 | 步驟與預期結果 |
| --- | --- |
| 瀏覽醫師與療程 | 開啟 `http://localhost:3000/doctors` 與 `/services`，檢查醫師詳情、療程分類與價格。資料來自 demo seed。 |
| 建立預約 | 開啟 `/appointments/new`，選醫師與至少兩天後的時段；填入完全虛構的姓名、電話、Email 與識別資訊。送出後保存本次 reference code；API 成功為 201。不要把識別欄位、電話或 Token 放入截圖。 |
| 查詢預約 | 在 `/appointments/lookup` 輸入 reference code 與手機末四碼；正確值可查詢，錯誤或缺漏末四碼不得取得預約。 |
| 展示取消限制 | 取消至少 24 小時後的預約應成功；另以獨立 demo 預約測試不足 24 小時時拒絕取消。若當下沒有適合時段，可用固定 clock 的自動測試展示界線，勿修改主機時間。 |
| 取消後重新預約 | 先套用最新 Migration 與 API。取消至少 24 小時後的預約，再選相同醫師／時段建立新預約，應回 201 且 ID／reference code 不同；用舊編號與末四碼仍可查到 CANCELLED 歷史。新預約存在時再次搶同一時段應回 409。 |
| Staff workflow | 先設定 `STAFF_DASHBOARD_TOKEN`；開啟 `/staff/appointments`，輸入 Token、選取 demo 預約日期，將另一筆未取消預約標記出席或未到。錯誤 Token 應回 401。不要錄製 Token 輸入過程。 |
| Admin workflow | 使用不同的 `ADMIN_DASHBOARD_TOKEN` 開啟 `/admin/catalog`，新增 demo 醫師／療程、編輯與下架，再檢查公開列表。下架是 `active=false`，不是刪除資料。 |

帳號目前是 environment-managed tokens，並非個別使用者登入或 production identity management。Host 開發模式由 `apps/api/.env` 載入；Compose 需明確注入，見下節。

Staff API 不允許將 CANCELLED 改成 CHECKED_IN／NO_SHOW（409）；BOOKED 不是合法的 Staff 更新目標（400）。未取消的預約仍可更正出席狀態。執行 `pnpm test:integration` 可在隔離 PostgreSQL 重現重訂、並發與 Migration 測試；只替換 email sender，不使用正式資料庫。部署鎖定與索引維護注意事項見 [Booking consistency](12-booking-consistency.md)。

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/ready
pnpm --filter @dental-clinic/api test
```

`/health` 不查 DB；`/ready` 會查 DB，失敗為 503。自動測試覆蓋 DB 不可用時 health=200、ready=503；不需要停止共用資料庫來展示此差異。測試使用 mock，因此不等同真實 DB 故障演練。

`/ready` 只回傳狀態、時間與 DB latency，不回傳底層錯誤。取消期限違規維持固定的 400，找不到預約為 404，其他取消失敗為通用 500。Email 為 commit 後的 best-effort 嘗試：寄送失敗不代表預約失敗，且不保證自動重試。可用 `pnpm test` 展示安全錯誤與 strict unhandled-rejection 回歸測試；不需真的寄信或停止共用 DB。

## Local Docker Demo

需要 Docker Engine。以下使用本機 Compose DB，先確認沒有其他 dev server 佔用 3000/3001，也沒有另一個服務佔用 5432。不要對既有真實資料庫執行 seed。

### 環境與啟動

```powershell
# 首次設定才複製；已有 .env 時請保留。
Copy-Item .env.example .env
# 檢查本機 demo 設定；不要使用正式憑證。
docker compose config --quiet
docker compose build api web
docker compose up -d
docker compose ps -a
docker compose logs migrate
```

Compose 順序為 PostgreSQL healthy → 獨立 migrate service 執行 `prisma migrate deploy` → API → Web。確認 migrate exited 0；失敗時停止後續功能展示並檢查錯誤，不要 reset 共用 DB。

```powershell
# 只在新建或可丟棄的 demo DB 載入合成樣本。
docker compose exec api node --import tsx prisma/seed.ts
Invoke-RestMethod http://localhost:3001/ready
Invoke-RestMethod http://localhost:3001/health
# 瀏覽 http://localhost:3000
```

`apps/api/.env` 不會自動注入 Compose API。瀏覽器使用 build-time `NEXT_PUBLIC_API_URL`，Web server 使用 `INTERNAL_API_URL`。修改公開 origin 後需重新 Build。

### 選用：Compose Staff/Admin Token

以下只在本機建立 gitignored override；不改寫公開 Compose 檔，也不輸出 Token。Token 保留在目前 PowerShell session，僅由操作者填入本機 UI。

```powershell
New-Item -ItemType Directory -Force .private/demo | Out-Null
@'
services:
  api:
    environment:
      STAFF_DASHBOARD_TOKEN: ${STAFF_DASHBOARD_TOKEN:?Set a local staff token}
      ADMIN_DASHBOARD_TOKEN: ${ADMIN_DASHBOARD_TOKEN:?Set a local admin token}
'@ | Set-Content -Encoding utf8 .private/demo/compose.tokens.yaml
$env:STAFF_DASHBOARD_TOKEN = [guid]::NewGuid().ToString('N')
$env:ADMIN_DASHBOARD_TOKEN = [guid]::NewGuid().ToString('N')
docker compose -f docker-compose.yml -f .private/demo/compose.tokens.yaml config --quiet
docker compose -f docker-compose.yml -f .private/demo/compose.tokens.yaml up -d api
```

以私密方式取得上述 session 值填入 UI；不要把值貼入 issue、終端錄影或公開文件。Host 開發模式改在本機 `apps/api/.env` 設定兩種 Token 後重啟 API。未設定 Token 時拒絕登入是預期行為。

### 停止與清理

```powershell
# 停止服務，保留 demo database volume。
docker compose down
Remove-Item Env:STAFF_DASHBOARD_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:ADMIN_DASHBOARD_TOKEN -ErrorAction SilentlyContinue
# 只有確認本機 DB 可丟棄時，才另外執行：
# docker compose down -v
```

`down -v` 會刪除資料，不是一般停止指令。不要將 `.env`、`.private/`、資料庫 dump 或原始 logs 提交 Git。

## Observability Demo

需要已部署的專用 Kubernetes demo 環境；依 [Kubernetes deployment](06-kubernetes-deployment.md) 與 [observability setup](08-observability.md) 建立應用及監控。SMTP 未設定時使用不寄信的 receiver，不宣稱 Email Alert 已送達。

各開一個 terminal：

```powershell
kubectl -n dental-clinic port-forward service/prometheus 9090:9090
kubectl -n dental-clinic port-forward service/grafana 3002:3000
kubectl -n dental-clinic port-forward service/api 8081:3001
```

在 Prometheus `http://localhost:9090/targets` 檢查 `dental-clinic-api`：每個 API Pod 各有一個 UP target。Grafana `http://localhost:3002` 的 **Dental Clinic API Overview** dashboard 應顯示：

| Panel | 解讀 |
| --- | --- |
| Request rate | 所有 API replicas 的每秒應用請求，排除 health/ready/metrics |
| 5xx error ratio | 5xx / 所有應用請求；有流量但無 5xx 時為 0，完全無流量不可推論健康 |
| p95 latency | histogram buckets 聚合後的第 95 百分位，單位為秒 |
| CPU | 各 process CPU 使用量，1 表示一顆 core，不是 Pod CPU limit 百分比 |
| Memory | 各 process 的 RSS bytes，不是 memory limit 百分比 |

可用少量本機 GET 產生樣本，等待至少兩次 scrape；完整 query 見 [observability reference](08-observability.md)。

```powershell
1..10 | ForEach-Object {
  Invoke-RestMethod http://localhost:8081/api/doctors | Out-Null
  Start-Sleep -Seconds 1
}
```

在 Prometheus `/rules` 與 `/alerts` 檢查 API Down（2 分鐘）及 5xx ratio > 5%（持續 5 分鐘）。看見 rule 不代表已觸發或外部收件人已收到通知。不要為展示而中斷共用環境；故障實驗僅在可丟棄環境執行。

## k6 Smoke Test

Smoke 只驗證連線、Response 與 threshold；**不是 Capacity Test，也不驗證 HPA**。腳本只 GET `/api/doctors`，預設 1 VU / 15 秒，丟棄 response body，拒絕公開 origin 與 redirects。不要將 Render 透過本機 proxy 迴避限制。

```powershell
# 使用內部 Docker network、tmpfs PostgreSQL 與合成 seed；無對外 port。
docker compose build api web
./load-tests/smoke-docker.ps1
```

腳本保存 `summary.json`、log、metadata 至 gitignored `load-tests/results/` 的獨立目錄，結束後清除本次容器與 network。檢查 exit code，以及 HTTP failure < 1%、p95 < 500ms、checks > 99%。Threshold 是驗收條件，不是未執行實驗的效能數據。

已有專用本機 API 且安裝 k6 時，也可執行：

```powershell
$env:BASE_URL = 'http://127.0.0.1:3001'
$env:PROFILE = 'smoke'
k6 run load-tests/read-only.js
```

詳見 [load-tests guide](../load-tests/README.md)。

## HPA Demo

**Configured, pending runtime verification.** 以下是操作與觀察流程，不是已成功擴縮的結果。

1. 確認專用 cluster、合成 DB、Metrics Server 及 node/DB 資源容量。Prometheus 不能替代 Metrics Server。
2. 依 [SHA deployment guide](06-kubernetes-deployment.md) 建立 namespace/Secret、選擇 CI 已發布的 commit SHA、完成同版本 Migration。
3. 在該 release overlay 的 `app/kustomization.yaml` 將 `../../../base` 改成 `../../../autoscaling`，保留 API/Web 的 `sha-<commit>` image tags；不要以 `latest` 作為展示版本證據。
4. 確認 API CPU request 保留 100m，HPA 使用 autoscaling/v2、min 2、max 10、target 65%；API `spec.replicas` 由 HPA 管理。

```powershell
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl top pods -n dental-clinic
# $releaseDir 由 SHA deployment guide 產生。
kubectl kustomize "$releaseDir/app"
kubectl apply --dry-run=server -k "$releaseDir/app"
kubectl apply -k "$releaseDir/app"
kubectl -n dental-clinic rollout status deployment/api
kubectl -n dental-clinic describe hpa api
```

同時觀察（watch 各開一個 terminal；top 每隔 15–30 秒重跑）：

```powershell
kubectl get hpa -n dental-clinic -w
kubectl get pods -n dental-clinic -w
kubectl top pods -n dental-clinic
```

Smoke 通過後，在同一個專用 cluster 啟動漸進式 k6 Job，讓流量經 Service 分配。Service port-forward 會選定單一 Pod，不適合作為多副本擴容證據。

```powershell
New-Item -ItemType Directory -Force load-tests/results | Out-Null
kubectl -n dental-clinic create configmap k6-read-only-script `
  --from-file=read-only.js=load-tests/read-only.js `
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create -f load-tests/k6-job.yaml
kubectl -n dental-clinic logs -f job/k6-read-only |
  Tee-Object -FilePath load-tests/results/k6-job.log
```

Job 漸進增加到 20 VUs，之後降到 0；讓它自然完成即停止負載，再觀察至少 5–10 分鐘。需要提早停止時，僅刪除本次建立的 `k6-read-only` Job，不操作 API 或資料庫；先保存需要的 logs。若 Job 名稱已存在，使用新的本機副本名稱，勿覆蓋執行中的測試。

預期但尚未驗證：CPU 上升 → HPA desired replicas 增加 → 新 Pod 建立並 Ready → 負載降低後經 300 秒 stabilization，逐步縮回至少 2 replicas。只讀請求若主要受 DB I/O 限制，CPU 未超過 target 時可能不擴容，必須如實記錄。詳見 [HPA troubleshooting/evidence](10-autoscaling-load-test.md)。

## Demo Fallback Evidence

當外部服務、叢集或 registry 無法使用時，用下列技術證據說明已驗證的範圍；不得用靜態圖片代替未執行的結果。

| 證據 | 來源與限制 |
| --- | --- |
| CI result | 查看 repository Actions 中特定 commit 的實際 run URL 與各 job 結果；本機通過不等於遠端 CI 已執行。未取得成功 run 時標示待驗證。 |
| Docker verification | [Verification records](09-project-verification.md) 記錄已完成的 image build 與隔離 API/DB smoke；可用 `smoke-docker.ps1` 重現。 |
| k6 summary | 本機 gitignored results 的 summary/metadata，包含 profile、樣本數及 exit code；歷史 smoke 為 15 次請求，不能代表容量。 |
| Kubernetes dry-run | `kubectl kustomize` 與 `kubectl apply --dry-run=server`；只證明渲染／admission，不證明 workload 或 HPA 執行成功。 |
| Grafana screenshot | 本 repository 尚未提供經審查的 screenshot。需要時由實際 demo 擷取，註明時間範圍、版本與流量情境，遮蔽帳號、內部位址與憑證；沒有圖片時展示 dashboard manifest 與 query，勿生成假圖。 |
| Architecture diagram | [README Mermaid diagram](../README.md#architecture-diagram)；說明元件與交付關係，不是 runtime evidence。 |

不提交大型影片、實際 Secret、原始測試產物或本機絕對路徑。只有人工審查、去識別且體積合理的技術摘要／圖片，才適合另行納入公開文件。
