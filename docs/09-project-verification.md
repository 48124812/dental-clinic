# 專案補強與驗證紀錄

## 最新本機機制與監控驗證（2026-10-11）

發布前重新執行：`pnpm lint`、`pnpm typecheck`、`pnpm test`（77：API 58／Web 19）、`pnpm test:load-config`（13）、`pnpm test:integration`（15）、`pnpm build`、`docker compose config --quiet`、`docker compose build api web` 均通過。`kubectl kustomize` 對 base、observability、autoscaling、local-kind/app、local-kind/metrics-server 均通過。Integration runner 完成後清理本輪容器、網路與測試映像。這些是本機結果，GitHub Actions 的 PR 執行結果需另外檢查。

- 專用 kind 叢集暫時將 HPA CPU target 從 65% 降為 10%，保留 request 與 behavior，觀察到 2 → 3 → 4 個 Ready Pod。停止負載並恢復完整原設定後，自動縮回 2。不是原本 65% 門檻的容量驗證。
- k6 唯讀請求 3,423 次、錯誤率 0%、p95 約 2.784 ms、exit code 0；Job／ConfigMap 已清理。計時差異仍待調查，見[實驗紀錄](16-local-load-observation.md)。
- Prometheus 兩個 targets UP、Grafana Dashboard 五類查詢及 datasource proxy 成功；90 次低頻唯讀展示請求全部 HTTP 200。未保存瀏覽器截圖、未驗證外部告警送達，見[監控展示](17-local-monitoring-demo.md)。

下方依日期保留先前的驗證範圍，不能把歷史「尚未驗證」當成最新狀態。

保留 Next.js / Fastify / Prisma 架構，補齊 HTTP 層測試與交付文件。以下區分 P0/P1 初次結果與 P2 後續結果；未修改 Render、GHCR 或既有 Kubernetes 部署。

## 專用 kind 漸進負載與 HPA 觀察（2026-10-10）

實際使用既有 k6 ramp profile、PEAK_VUS=20，對專用 kind API 的合成醫師目錄送出唯讀請求；沒有對 Render 加壓。API 原有 CPU request 100m、HPA target 65%、2–10 replicas 皆未修改。

- k6 exit code 0；7,551 requests、checks 7,551/7,551、HTTP error rate 0%，p95 2.213 ms，三個 Threshold 通過。
- `pnpm test:load-config` 本輪 13 項通過；`git diff --check` 通過。沒有應用程式碼變更，不重跑完整應用測試。
- 約每 20 秒採樣，含至少 5 分鐘負載後觀察，共 44 筆；CPU 最高採樣 23%，desired/current/Ready 皆為 2，Pod UID 未變且 restart count 未增加。
- HPA Scale Up／Scale Down **未觀察到**，不能宣稱已驗證自動擴縮。此次負載未達 CPU 目標，也不是容量上限測試。
- **計時限制：** k6 顯示設定的 10m scenario 完成，但 running elapsed 與容器時間約 9m14s，原因未確認。延遲為 k6 報告值；不以此當精確 600 秒或吞吐量基準，後續效能實驗前先調查計時一致性。
- run ID `ramp-20261010-244e74dd`，原始摘要、Log、HPA／節點時間序列在 Git ignored `load-tests/results/`。本次 Job、Pod、ConfigMap 已刪除，應用與 DB 保留運行。

方法、門檻、停止條件、完整結果與限制見[漸進負載觀察紀錄](16-local-load-observation.md)。未 Commit、Push，未更動其他叢集。

## 專用 kind k6 Smoke Test（2026-10-10，台北日期）

Context 固定 `kind-dental-hpa-lab`，使用 `.private/kind-lab/kubeconfig`，namespace `dental-clinic`。本輪沒有對 Render 或另一個 Docker Desktop 叢集送流量，沒有執行 ramp 或高負載。

前置檢查發現 API 0/2 Ready：原 `lab-db` 的容器為 Terminated/Unknown、exit code 255、Pod Failed、Service 沒有可用端點；其他應用容器亦有近期重啟。無法僅據此判斷確切停止原因。這是原本 `restartPolicy: Never`、記憶體 emptyDir 暫存 DB 的生命週期限制，不是 k6 壓垮服務。確認未發送負載後，保留舊失效 Pod，建立替代 `lab-db-smoke-20261010-55ea0c36`，使用既有 Secret 與相同 DB Service selector，執行新的一次性 Migration／Seed Jobs，恢復 API 2/2 Ready。

替代庫重新建立合成目錄，不是舊資料還原；沒有搬移舊預約。執行前再核對 API 的 DB host 為 `lab-db`、database 為 `dental_lab`（只比對，不列印連線值），`/ready` 200、合成醫師 4 筆，才啟動 k6。

| 本輪檢查 | 結果 |
| --- | --- |
| `pnpm test:load-config` | 13 項通過；離線驗證公開目標拒絕、唯讀操作與負載設定 |
| k6 image／腳本 | `grafana/k6:1.0.0`，原有 `load-tests/read-only.js`，沒有修改 allowlist |
| 目標 | 叢集內 `http://api.dental-clinic.svc.cluster.local:3001/api/doctors`；透過 Service DNS，無 hostAliases 或 port-forward |
| Profile | smoke，1 VU，設定 duration 15 秒，每次迭代 sleep 1 秒 |
| HTTP／checks | 15 次 HTTP 200、15/15 checks、HTTP error rate 0% |
| 延遲 | k6 報告 avg 2.23 ms、p95 3.16 ms、max 4.2 ms |
| Thresholds | error rate < 1%、p95 < 500 ms、checks > 99%，全部通過 |
| 執行狀態 | Job Complete，容器 exit code 0 |
| HPA | 結束後快照 2 replicas、CPU 約 4% / 65%；不宣稱負載擴縮已通過 |

本機原始 Log、執行摘要與 HPA 前後快照保存在 Git ignored `load-tests/results/smoke-20261010-55ea0c36/`。測試僅 GET 目錄、丟棄 response bodies，沒有新增預約。只有 15 筆樣本，這是連線／回應／Threshold 的 Smoke Test，不是 Capacity Test 或 SLO 證據。

本輪 k6 Job、其 Pod、ConfigMap 及已完成的恢復用 Migration／Seed Jobs 已清理；替代 DB 與原有應用／監控保留運行，舊失效 DB Pod 未刪除。未 Commit／Push；沒有修改應用或負載腳本，不重跑完整應用測試。下一步可評估此隔離叢集的漸進負載，但應先處理暫存 DB 的停止／重建流程，避免將失去資料的環境當成可靠持久化部署。

## 專用 kind 叢集應用部署（2026-10-09 後續）

在新建的 `kind-dental-hpa-lab` 部署 `dental-clinic` namespace，與另一個 `docker-desktop` context 的同名 namespace 分開。使用已發布的 SHA `0d8a1757a0232add134dc407f490eafb6e6f1441` 映像、新的合成 PostgreSQL、獨立 Migration／Seed Job；沒有使用 Render 連線或搬移真實資料。

新增 `k8s/local-kind/app/` opt-in overlay：引用既有 autoscaling manifests、固定 API/Web SHA，補上暫存 DB 與僅供本機轉發的同源 gateway。重建順序及入口管理見[本機部署指南](15-local-kubernetes-demo.md)。

| 檢查 | 實際結果 |
| --- | --- |
| Migration／Seed | 均 Complete；Seed 空庫初始化成功，沒有啟用每次 API 啟動 Seed |
| API／Web／gateway | 2/2、2/2、1/1 Ready |
| HPA | 已建立、能讀到 CPU，idle 約 3–4% / 65%，2 replicas；不是負載擴縮測試 |
| 本機同源入口 | `http://127.0.0.1:18080/doctors` 200，`/api/doctors` 回 4 筆目錄 |
| HTTP 預約流程 | 同源入口建立、查詢、取消、重訂成功；新舊 ID／編號不同、原取消紀錄保留，測試新預約也已取消；非瀏覽器 E2E |
| API health／ready | 200／200，另測重複有效預約回 409 |
| Prometheus／Grafana | 兩個 targets UP，health、Dashboard API 與五類指標查詢通過 |
| 首次監控檢查 | 早於 rollout 完成發生 fetch failed；等待 Ready 後重跑完整檢查通過 |

此次沒有執行 k6、ramp、容量或 HPA Scale Up／Scale Down；HPA 負載行為仍待驗證。Alertmanager 只配置無外部通知的 receiver，沒有驗證通知送達。

與前次暫存 lab 不同，**此次專用叢集部署與 loopback port-forward 保留運行**供使用者操作；資料庫為 emptyDir，刪除 DB Pod／叢集會遺失合成資料。原始摘要、臨時操作腳本及 port-forward PID/Log 在 Git ignored `.private/kind-app/`。沒有 Commit、Push 或改動原本 `docker-desktop` 部署。這輪只改 Kubernetes／文件，沒有重跑應用程式單元測試；不能沿用上一輪結果當作本輪新測試。

## 專用 kind 叢集憑證修正（2026-10-09 後續）

先前的 Metrics Server TLS 阻擋已在**另一個新建的專用叢集**解決，原 Docker Desktop 叢集不變。新增 `k8s/local-kind/cluster.yaml` 與 Metrics Server Kustomize overlay，詳細重建、CSR 審查及清理流程見[憑證指南](14-local-kubernetes-certificates.md)。

| 實際驗證 | 結果 |
| --- | --- |
| kind v0.31.0 下載與官方 SHA256 | 相符；binary 僅存放在 Git ignored 工具目錄 |
| 新叢集 `dental-hpa-lab` | Kubernetes v1.34.3、node Ready；獨立 kubeconfig，不修改預設 context |
| kubelet serving CSR | requester、subject、usages、self-signature 與 SAN 經審查後，只批准明確指定的一筆 |
| 憑證驗證 | 叢集 CA 簽署、含節點 DNS/IP SAN，`openssl verify -CAfile ... -verify_ip ...` 通過 |
| Metrics Server v0.8.1 | 使用 `--kubelet-certificate-authority`，沒有 `--kubelet-insecure-tls`；rollout 通過 |
| APIService／資源指標 | Available=True，`kubectl top nodes`、`kubectl top pods -A` 成功 |
| 初始化暫態 | rollout 剛完成前查詢出現 Metrics API not available；等待 APIService Available 後通過，未忽略錯誤 |

此輪僅驗證憑證與 Metrics API，不重跑應用測試或負載，不代表 HPA 擴縮成功。上游 APIService 的 `insecureSkipTLSVerify` 仍為原設定，API aggregation 的 TLS 強化另待處理；不能將 kubelet 這一段驗證成功延伸成全叢集安全保證。

專用叢集與 Metrics Server 保留供後續使用，原本 `docker-desktop` context 與既有牙醫部署保留。工具、kubeconfig 與原始證據在 `.private/kind-lab/`，不可提交 Git；未 Commit／Push。

<a id="local-kubernetes-2026-10-09"></a>
## CI 資料庫測試與本機 Kubernetes 實測（2026-10-09，台北日期）

本輪在 `.github/workflows/ci.yml` 新增獨立的 PostgreSQL integration Job，直接呼叫 `pnpm test:integration`。測試依賴在 Docker builder 安裝，host 不另執行 install；不需要 repository Secret 或外部 DB。GHCR publish 現在同時依賴 verify、integration、container-build。尚未 Commit／Push，**GitHub Actions 上新增 Job 的結果待驗證**；下面是本機實際結果。

### 本輪命令結果

| 命令 | 實際結果 |
| --- | --- |
| `pnpm lint` | 通過 |
| `pnpm typecheck` | 通過 |
| `pnpm test` | 77 通過：API 58、Web 19 |
| `pnpm test:load-config` | 13 通過；不產生 HTTP 流量 |
| `pnpm test:integration` | 15 通過：Migration／預約 11、Seed 4；Docker 測試資源已清理 |
| `pnpm build` | API TypeScript 與 Next.js 16.1.7 Production Build 通過；使用工作區既有 Web 環境檔，未列印其值 |
| `docker compose config --quiet` | 通過 |
| `kubectl kustomize k8s/base` | 通過 |
| `kubectl kustomize k8s/observability` | 通過 |
| `kubectl kustomize k8s/autoscaling` | 通過；只有渲染，不是 HPA 實測 |

Prisma 6 的 `package.json#prisma` 棄用提示及 Node experimental VM Modules 提示沒有造成測試失敗。本輪沒有修改應用程式、Prisma Schema、Migration 或 Seed。

### 隔離方式與部署

- Context 固定 `docker-desktop`，Kubernetes v1.34.3、Docker Engine 29.3.1；單節點可配置 20 CPU、約 15.3 GiB 記憶體。這不是獨占資源，原本應用也在運行。
- 新建 `dental-lab-20261009` namespace，沒有修改既有 `dental-clinic` namespace，也沒有讀取其資料庫 Secret。
- 新 PostgreSQL 16 使用記憶體 `emptyDir` 與獨立隨機密碼，只有合成資料，沒有主機公開 port、沒有 PVC、不連 Render。此暫存 DB 不適合正式持久化。
- API/Web 使用已發布的完整 SHA tag `sha-0d8a1757a0232add134dc407f490eafb6e6f1441`。API 實際執行 digest 為 `sha256:eff67fc9fda37322ed5bf62c14fe9ab6161e82300053b37dbf78c809b0287d12`。本機測試的是工作區原始碼，叢集測試的是此已發布映像，兩者範圍分開記錄。
- 從既有 base manifests 渲染，僅在本機產物替換 namespace 與映像；獨立 Migration Job 完成後執行一次 Seed Job，再部署 API/Web 各 2 replicas。一般 API 啟動的 Migration／Seed 旗標仍為 false。
- Observability 使用既有 manifests，將 Prometheus 的 namespace DNS 改指此 lab；Grafana 使用臨時憑證，Alertmanager 使用不寄送的測試 receiver。

### 功能、監控與故障驗證

| 驗證 | 實際結果與界線 |
| --- | --- |
| Migration／Seed Job | 均 Complete；Seed 顯示空庫初始化成功 |
| API/Web rollout | 各 2/2 Ready |
| `/health`、`/ready` | HTTP 200；DB check 成功 |
| 目錄 | 4 位醫師、9 項療程 |
| 合成 HTTP 預約流程 | 建立 201、重複 409、查詢 200、取消 200、同時段重訂 201、新舊 ID／編號不同、舊取消紀錄仍可查；新預約也已取消 |
| Web | `/doctors` HTTP 200，SSR HTML 含 API 回傳的合成醫師；未操作瀏覽器表單，不是完整 E2E |
| Prometheus | 兩個 API Pod Target 均 UP；Pod 重建後新的 Target 也 UP |
| Grafana | `/api/health` 200，認證後 Dashboard API 可讀到 `Dental Clinic API Overview`；尚未保存瀏覽器截圖 |
| 五類 Dashboard 指標 | 原始 PromQL 的 Request Rate、5xx ratio、p95 latency、process CPU、RSS 均回成功且有有限數值；這是資料查詢驗證，不是長期 SLO |
| Alert Rules | 兩條規則均 health=ok、inactive；沒有觸發告警或驗證外部送達 |
| Pod 故障恢復 | 只刪除 lab 中一個 API Pod，Deployment 建立新 UID 的替代 Pod，恢復 2/2 Ready；重跑功能與監控檢查成功。未持續採樣故障期間請求，因此不宣稱零中斷 |

第一次臨時驗證腳本誤以首頁應含醫師姓名作斷言，失敗後核對程式並改查 `/doctors`，再驗證通過；這是驗證腳本假設錯誤，未修改網站來配合測試。

### k6 Smoke Test

使用既有 `load-tests/read-only.js` 與 `grafana/k6:1.0.0` 在 lab 執行 Job：1 VU、15 秒、只 GET `/api/doctors`。腳本 allowlist 未修改；Job 的 `hostAliases` 將允許的 API 名稱明確映射至 **lab API Service 的 ClusterIP**，不會連到舊 `dental-clinic` namespace。下次必須重新取 lab Service IP，不可沿用歷史 IP。

- 15 次請求，15/15 checks 通過；HTTP error rate 0%，p95 2.64 ms。
- 三個 Threshold 皆通過，Job Complete。
- 樣本僅 15 筆且在本機單節點執行，不是 Capacity Test，也不是正式網站效能數字。

### HPA：Environment Blocked

最初沒有 Metrics Server。確認安裝清單中沒有既有同名資源後，嘗試在本機安裝官方 **v0.8.1**；rollout 等待 90 秒逾時。Log 明確顯示 kubelet TLS 驗證失敗：`x509: cannot validate certificate ... because it doesn't contain any IP SANs`，APIService 為 `False (MissingEndpoints)`。

沒有加上 `--kubelet-insecure-tls`，也沒有修改現有節點憑證；已移除本輪新裝的 Metrics Server 及其新增 RBAC／APIService 資源，恢復安裝前狀態。HPA 維持 **configured, pending runtime verification**；未執行 ramp、高負載、Scale Up／Scale Down 或容量測試。

下一步需先在專用 lab 規劃可驗證的 kubelet serving certificate（CA 信任及連線位址 SAN），或使用已提供相容憑證的隔離叢集；確認 `kubectl top pods` 可用後，才執行 HPA 負載實驗。不要把關閉 TLS 驗證當成正式環境修法。參考 [Metrics Server requirements](https://github.com/kubernetes-sigs/metrics-server#requirements)。

### 原始證據與清理

本機實驗腳本與不含 Secret 的功能摘要、監控查詢、Pod 重建紀錄及 k6 Log 保存在 Git ignored 的 `.private/k8s-lab/`，不提交公開 repository。本頁只保留可公開的彙總。

測試後刪除本輪新建的 namespace，連同暫存 PostgreSQL、測試 Job、Secret、API/Web 與監控服務；未刪除既有 `dental-clinic` 資源、Compose 容器或既有資料。Integration Test 的容器、網路與臨時 image 也已移除。下載的共用 image／build cache 保留。

## Render 空資料庫替換與 Seed 保護（2026-09-29）

本輪只修改 Seed、啟動註解、Render Blueprint、隔離測試與相關文件。既有 Prisma Schema 及全部 Migration（包括 partial unique index SQL）均未修改。沒有連線至 Render DB、操作 Dashboard、換庫、Commit、Push 或部署。

| 實際驗證 | 結果 |
| --- | --- |
| `pnpm lint` | 通過 |
| `pnpm typecheck` | 通過 |
| `pnpm --filter @dental-clinic/api exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck prisma/seed.ts` | 獨立 Seed 腳本型別檢查通過 |
| `pnpm test` | **77 通過：API 58、Web 19** |
| `pnpm test:integration` | **15 通過：既有 11、新增 Seed 4**；PostgreSQL 16 隔離容器 |
| `pnpm build` | API／Web 通過 |
| `node --check scripts/test-postgres.mjs` | 通過 |
| Render YAML 本機解析與設定檢查 | 通過；DB 手動管理、`DATABASE_URL` 不由 Blueprint 覆寫、Seed 預設關閉；未執行 Render 遠端驗證／Apply |
| `docker compose config --quiet` | 通過 |
| 實際 API runtime image + 第二個隔離 PostgreSQL | 新空庫 Migration → Seed → Ready；保留 `true` 重啟跳過 Seed 且保留修改；改 `false` 重新建立 API 容器後沒有 Seed 訊息，Ready 正常 |

新增測試涵蓋兩個 Seed 並行初始化僅一個寫入成功、4/9/7/2 筆合成目錄、新庫上的建立／查詢／取消／重訂／409 衝突、部分資料庫跳過、反覆執行保留編輯／刪除／預約與其他紀錄，以及注入後段寫入失敗後整筆回滾再安全重試。Seed 測試使用獨立 `dental_seed` 測試 DB，不與既有整合測試共用資料。

首次整合測試因 Docker Engine 未啟動而未執行；啟動本機 Docker Desktop 後重跑通過。新增測試初版的 TypeScript 可空索引問題已修正後重跑。兩組測試容器、Internal Network、tmpfs 資料與臨時 Image 均清理完成；共用基礎映像與 Build Cache 保留。沒有具名資料 Volume、對外測試 Port 或公開負載測試。

手動換庫與停機限制見[Render PostgreSQL 替換指南](13-render-database-replacement.md)。本機通過不代表 Render 已完成切換；新資料庫的目錄與預約仍需由維護者在切換後驗收。

## Online Demo 發布前最終驗證（2026-09-21）

由更新後的 `origin/main` 建立 `fix/online-demo-readiness`；建立分支時與 main 的 ahead／behind 均為 0。本次依序重新執行以下檢查，未沿用前輪結果：

| 指令 | 結果 |
| --- | --- |
| `git diff --check` | 通過 |
| `pnpm lint` | 通過，無 ESLint warning |
| `pnpm typecheck` | 通過 |
| `pnpm test` | **77 通過：API 58、Web 19** |
| `pnpm test:load-config` | **13 通過**，離線檢查，不產生負載 |
| `pnpm test:integration` | **11 通過**，包含空白 DB Migration、既有資料升級、Schema Drift 與並發預約檢查 |
| `pnpm build` | API／Web production build 通過 |
| `docker compose config --quiet` | 通過，不輸出解析後的環境變數 |
| `kubectl kustomize k8s/base` | 通過 |
| `kubectl kustomize k8s/observability` | 通過 |
| `kubectl kustomize k8s/autoscaling` | 通過 |

PostgreSQL 測試只使用隔離 Docker Network 與 tmpfs 資料庫，測試容器、Network 與臨時 Image 已清理。Prisma 設定棄用與 Node VM Modules experimental 訊息不是測試失敗。沒有執行正式 DB Migration、k6 負載測試、Render 手動部署或 Kubernetes apply；Kustomize 通過不代表 Kubernetes、Grafana 或 HPA 已在執行環境驗證。

發布範圍僅包含 Online Demo 相關 UI、測試、繁體中文 README 與公開文件。舊 Web 網址僅留在歷史錯誤說明，所有有效公開 Demo 入口均使用 `https://dental-clinic-web-ejw6.onrender.com/`。`.private/`、環境檔、原始測試紀錄與建置產物不納入版本控制。本節記錄發布前檢查；PR CI 狀態以 GitHub Actions 的實際結果為準。

## Online Demo Readiness Audit（2026-09-21）

本輪從乾淨的 `main` 開始，修正 README 錯誤的公開 Web 網址與重複舊內容，補上三分鐘線上操作／Fallback、查詢導覽、假資料提醒、載入／錯誤畫面與預約錯誤提示。未修改 Appointment Schema、Migration、API 業務邏輯或部署設定。未 Commit、Push、建立 PR、修改 Remote 或部署。

| 本輪實際驗證 | 結果 |
| --- | --- |
| `pnpm lint` | 通過，無 ESLint warning |
| `pnpm typecheck` | 通過 |
| `pnpm test` | **77 通過：API 58、Web 19**；新增 9 項安全錯誤提示測試 |
| `pnpm build` | API／Web production build 通過；此輪 Web build 使用暫時的本機假 API origin，避免 UI 驗證觸及真實 DB，沒有改寫 `.env` |
| `git diff --check` | 通過；已檢查修改與新增檔案，不含 Secret、實際預約紀錄或本機絕對路徑 |
| 公開 Render 瀏覽器流程 | 建立、查詢、取消、相同醫師時段重訂、再次取消、舊取消紀錄查詢通過；另驗證 201／409／404／200 回應 |
| 本機 production Web + 記憶體假 API | 載入提示、安全錯誤頁、重試後恢復、Demo 提醒／查詢連結、手機導覽、重選目前醫師仍可選時段、中文斷線提示通過；不連資料庫 |

最初 sandbox 拒絕執行 `pnpm.exe` 與網路連線，屬環境權限限制；使用核准的執行環境重跑後通過。瀏覽器 audit helper 初次有 selector／序列化錯誤，修正 helper 後重跑；沒有把 helper 失敗計為產品測試成功。錯誤頁初版只 reset boundary，無法重取失敗的 Server Component；改為重新載入後，本機實際重試恢復成功。預約頁另避免再次點擊已選取醫師時誤進入無法結束的 loading 狀態。

新增錯誤處理不呈現原始 API／network error，對 booking 或 cancellation 的不明結果提示先確認狀態，且不自動重送寫入。Role Token 沒有輸入公開瀏覽器，也沒有讀取 Render Secret。公開資源掃描是有限檢查，不等於完整滲透測試。

所有公開測試僅使用假資料，三筆成功建立的測試預約均經正常取消，保留歷史；未刪資料、未直接連 DB。詳細網址、HTTP 結果、Cold Start 限制與 GitHub 部署 SHA 證據見 [Online audit](07-deployment-verification.md#online-readiness-audit-2026-09-21)。本輪未重跑 PostgreSQL integration、Docker Compose、k6 或 Kubernetes；下方舊結果仍是歷史證據。HPA 仍為 **configured, pending runtime verification**。本輪 UI 修改尚未發布至 Render。

## Final Audit 錯誤邊界與文件修正（2026-09-20）

本輪開始時 Working Tree 乾淨；只修正背景 Email rejection、底層錯誤回應、Migration 維護提示與 Production Checklist 定位。未修改 Schema／Migration、CI、UI 或 HPA，未 Commit／Push／部署正式服務。

| 本輪實際指令 | 最終結果 |
| --- | --- |
| `git diff --check` | 通過 |
| `pnpm lint` | 通過，無 ESLint warning |
| `pnpm typecheck` | 通過 |
| `pnpm test` | **68 通過：API 58、Web 10** |
| `pnpm test:load-config` | **13 通過**，沒有送出負載 |
| `pnpm test:integration` | **11 通過**，僅隔離 Docker PostgreSQL |
| `pnpm build` | API／Web production build 通過 |
| `docker compose config --quiet` | 通過 |
| `kubectl kustomize k8s/base` | 通過 |
| `kubectl kustomize k8s/observability` | 通過 |
| `kubectl kustomize k8s/autoscaling` | 通過，未部署 |

本輪新增 17 項 application 回歸測試：建立／取消遇到 sender reject 仍保留成功結果、取消 lookup／transaction／帶錯誤 statusCode 的非業務失敗統一 500、10 項 Email Service 案例，以及 2 項 strict subprocess 案例。既有 readiness 測試另加上 response／log 不洩露底層錯誤的斷言。測試僅使用合成資料；沒有真的寄信或連正式資料庫。

Email Service 的完整流程受 try/catch 保護，FAILED 狀態寫入也有獨立邊界；呼叫端在 commit 後啟動工作，最終 Promise catch 防止未來 sender 意外 reject。一般失敗由 service 記錄，意外逃出 service 才由 caller 記錄。沿用 Fastify logger，只輸出固定事件、delivery ID、固定 error category 與 retryable flag，不附原始 Error、stack、DB URL、Provider body、HTML 或病患資料；lastError 改存固定分類。這是 best-effort 通知，沒有 retry worker／自動重試或 exactly-once 保證。

Unhandled rejection 驗證包含完整 event-loop drain，以及沒有安裝全域 rejection handler 的獨立 Node 子程序，使用 `--unhandled-rejections=strict`。初始 DB 查詢失敗、Provider 失敗加上失敗狀態寫入再次失敗時，建立為 201、取消為 200，程序 exit 0、stderr 為空，關閉 app 後再 drain 仍沒有背景錯誤。開發中曾因合成識別值超出既有長度限制導致 subprocess fixture 失敗，修正 fixture 後重跑通過，未放寬正式驗證規則。

`/ready` 保留必要狀態、timestamp、DB latency 與失敗時 503，不回傳 error message。取消期限用明確的業務 Error Class，回固定 400；找不到仍為 404；其他錯誤正規化後交由既有 global handler 回通用 500，避免重複回覆或外洩。

Kubernetes 與 Render 指南都要求先確認目標、備份、非取消資料唯一性及維護窗口，停止舊 API 寫入後 Migration，再換相容 API 並驗證才恢復寫入。Checklist 保留技術內容，但標示為未來假設性 hardening，不適用於目前公開 Portfolio 的可見性或正式使用宣稱。

Docker PostgreSQL suite 實跑成功並清除其容器、network、tmpfs 與臨時 image；未對正式或共享 DB 操作。Prisma deprecation、Node VM Modules experimental 提示不是驗證失敗。本輪沒有 SMTP 送達、瀏覽器 E2E、完整 Compose UI 或 HPA runtime 實驗；HPA 仍為 **configured, pending runtime verification**。

## 取消後重訂修正（2026-09-20，歷史紀錄）

本輪開始時 Working Tree 乾淨。新增 custom SQL partial unique index，保留取消歷史；Staff 用條件式更新拒絕恢復 CANCELLED。未操作正式資料庫、Render 或部署中的 API，未 Commit／Push。設計與操作方式見 [Booking consistency](12-booking-consistency.md)。

| 實際執行指令 | 結果與範圍 |
| --- | --- |
| `pnpm --filter @dental-clinic/api db:generate` | Prisma Client 6.19.3 生成成功；不執行資料庫 Migration |
| `pnpm lint` | 通過，無 ESLint warning |
| `pnpm typecheck` | 通過 |
| `pnpm test` | 原有 51 項通過：API 41、Web 10 |
| `pnpm test:load-config` | 13 項通過，沒有送出負載 |
| `pnpm test:integration` | 11 項真實 PostgreSQL 測試通過；獨立於上述 51 項 |
| `pnpm build` | API TypeScript 與 Next.js production build 通過 |
| `docker compose config --quiet` | 通過 |
| `kubectl kustomize k8s/base` | 通過 |
| `kubectl kustomize k8s/observability` | 通過 |
| `kubectl kustomize k8s/autoscaling` | 通過；未部署 workload |

PostgreSQL 16 Docker 實跑：空白 DB 套用三份 Migration；從前兩份 Migration 建庫並放入 BOOKED／CANCELLED 合成資料後升級；原記錄保留，舊索引移除，新 partial index 有效且 ready；Migration checksum 正確，schema/history diff 均無 Prisma 可見差異。Partial index 另以 PostgreSQL catalog 明確檢查，不能只依賴 Prisma diff。

並發驗證：兩輪各 8 個同時送出的預約 HTTP requests，每輪 **1 筆 201、7 筆 409**；中間取消成功，第二輪可重訂。另驗證三次取消／重訂、不同 ID／reference code、歷史保留、不同醫師同時段、所有非取消狀態占位、Staff 禁止恢復、真實 row lock 控制的取消／Staff 交錯，以及失敗時沒有額外 outbox／audit 寫入。只 mock email sender，不 mock Prisma。測試容器、internal network、tmpfs 資料與臨時 image 均清除。

初次 Docker Engine 未啟動是環境限制，啟動 Docker Desktop 後繼續驗證。開發中曾發現測試的 Prisma spy 型別／還原問題與 strict array typing 錯誤，已改用 PostgreSQL 真實鎖並修正型別；上述為修正後結果。Prisma package config deprecation 與 Node VM Modules experimental 提示不影響通過。未重新驗證完整 Compose UI、外部 Email、Render 或 HPA；HPA 仍為 **configured, pending runtime verification**。

## Public documentation pass（歷史紀錄）

本輪只整理公開文件與忽略規則，未修改 Appointment Schema、Migration 或取消流程。以下指令於本輪重新執行，並非沿用先前結果：

| 指令 | 本輪結果 |
| --- | --- |
| `git status` | 已檢查工作目錄；未 stage 或 commit |
| `git diff --check` | 通過；Git 的 CRLF → LF 提示不是 whitespace error |
| `pnpm lint` | 通過，無 ESLint warning |
| `pnpm typecheck` | 通過 |
| `pnpm test` | 51 通過：API 41、Web 10 |
| `pnpm test:load-config` | 13 通過；Node VM Modules experimental warning 是測試工具提示 |
| `pnpm build` | API 與 Next.js production build 通過 |
| `docker compose config --quiet` | 通過 |
| `kubectl kustomize k8s/base` | 通過 |
| `kubectl kustomize k8s/observability` | 通過 |
| `kubectl kustomize k8s/autoscaling` | 通過 |

本輪沒有重新執行 Docker runtime smoke、Render 探測、叢集部署或 HPA 負載實驗；以下保留的 runtime 結果均為歷史紀錄。公開文件連結與敏感資料掃描通過，未把原始測試產物納入版本控制。

## P2 功能與基礎設施驗證（歷史紀錄）

| 實際執行指令 | 結果與範圍 |
| --- | --- |
| `pnpm lint` | 通過，無 ESLint warning |
| `pnpm typecheck` | 通過 |
| `pnpm test` | **51 通過**：API 41、Web 10；新增日誌與未知路徑 metrics 的隱私回歸測試 |
| `pnpm test:load-config` | **13 通過**；只用 synthetic k6 modules，不產生 HTTP 流量 |
| `pnpm build` | API TypeScript 與 Next.js production build 通過 |
| `node --check load-tests/read-only.js` | JavaScript 語法檢查通過 |
| `docker compose config --quiet` | 通過 |
| `docker compose build api web` | 使用者啟動 Engine 後通過；API Dockerfile 修正後再次 Build 通過 |
| `./load-tests/smoke-docker.ps1` | 隔離 Docker network、暫存 PostgreSQL、migration + demo seed + API ready 成功；1 VU / 15s 的 k6 smoke 通過，15/15 回應 200、thresholds 全通過；已清除本次測試容器與 network |
| `kubectl kustomize k8s/base`、`k8s/observability`、`k8s/autoscaling` | 三組渲染通過；另解析 YAML 並檢查 HPA 2/10、65%、CPU request 100m |
| `kubectl --request-timeout=5s get --raw=/readyz` | 使用者啟動 Docker 後成功；之前是 connection refused |
| `kubectl --request-timeout=5s get apiservice v1beta1.metrics.k8s.io` | NotFound：目前沒有 Metrics Server，屬於外部設定缺項 |
| `kubectl apply --dry-run=server -k k8s/autoscaling` | 通過；沒有真的建立 HPA 或更新 Deployment |
| `kubectl apply --dry-run=server -f load-tests/k6-job.yaml` | 通過；沒有在現有 namespace 執行負載 |
| `docker run --rm --mount "type=bind,source=$((Get-Location).Path)/load-tests,target=/scripts,readonly" grafana/k6:1.0.0 inspect /scripts/read-only.js` | 真正的 k6 1.0.0 能載入腳本及 options；此指令不送流量 |

HPA 狀態：**configured, pending runtime verification**。已配置 autoscaling/v2、CPU 65%、2–10 replicas、漸進式擴縮與安全 k6；尚需 Metrics Server，以及隔離的叢集負載實驗，證明 CPU、desired/current replicas、Ready 與降載後縮回。server dry-run 不能當成擴容成功。

Docker 實跑發現並修正：舊 Dockerfile 用全域 Prisma generate，runtime workspace CLI 的 migration engine 未一起準備，導致離線啟動嘗試連到 binaries.prisma.sh 失敗。現改用 lockfile 內的 Prisma/TypeScript CLI，Build 時準備 runtime engine；修正後相同隔離 network 實驗通過。這是 image 打包問題，與初次 Docker Engine 未啟動的環境限制不同。PowerShell smoke wrapper 的參數轉送與容器 readiness 錯誤處理亦於實跑修正。

成功 smoke 原始證據：`load-tests/results/dental-k6-12c3731bf594/` 的 `summary.json`、`k6.log`、`metadata.json`（gitignored）。執行時間為 2026-09-19 19:35:34–19:35:50 UTC（台灣 2026-09-20）；API image ID `sha256:958a78fe13ef528089252ae26fad7bf66edbffa3d7ae0592d2bc1909d1c2dc40`。只有 15 筆本機樣本，不外推正式環境容量，也不當作 HPA 驗證。後續重跑會建立新的 run ID，不覆蓋此份結果。

一般日誌只保留 method、route template、status/request ID；不再記錄原始 request URL、header/body、未處理錯誤文字或 Prisma SQL/error。未處理的 5xx 對外回通用錯誤，原本明確回傳的 400/401/404/409 行為保留。這是資料最小化措施，未代表已完成完整資安稽核。

可重現的操作見 [HPA 指南](10-autoscaling-load-test.md)與 [Technical Demo Guide](DEMO.md)。此紀錄只包含技術驗證結果與限制。

## P0/P1 初次執行結果（歷史基準）

| 檢查 | 結果 |
| --- | --- |
| 修改前 `pnpm test` | API 10 + Web 10 = 20 通過 |
| 修改後 `pnpm lint` | 通過，無 warning，未新增停用 ESLint rule |
| `pnpm typecheck` | 通過 |
| `pnpm test` | API 39 + Web 10 = **49 通過**，共 4 個 test files |
| `pnpm build` | API tsc 與 Next.js 16.1.7 production build 通過 |
| `docker compose config --quiet` | 通過 |
| `docker compose build api web` | 環境限制：Docker Desktop Linux Engine pipe 不存在，未開始 image build |
| `kubectl kustomize k8s/base` | 通過 |
| `kubectl kustomize k8s/observability` | 通過 |
| YAML / embedded config syntax | 25 份 Kubernetes YAML、內嵌 YAML/JSON、兩個 workflows、Compose 與 Render 皆通過解析 |
| Migration image rendering | `kubectl set image --local` 通過；沒有提交 Job 到叢集 |

執行環境：Windows、Node.js 24.16.0、pnpm 10.0.0；CI 使用 Node.js 22。首次 sandbox 拒絕存取已安裝的 pnpm/kubectl，改用核准的執行權限後完成上述檢查。Docker Engine 未啟動是環境限制，不能據此判定 Dockerfile build 成功或失敗。

Next build 使用工作區既有 `.env.local`；未將其中值複製至文件。Build 成功不是外部 API runtime／UI E2E 驗證。

## 測試策略與邊界

`apps/api/src/routes/appointments.test.ts` 目前有 35 個測試案例（原有 30 個，加上本輪 5 個 Email／取消錯誤回應案例）；本輪另有 10 個 Email Service 與 2 個 strict subprocess 測試：

- 真實 Fastify `buildApp()` + `inject()`，保留 Zod、service、角色 Token 驗證與 HTTP status mapping。
- 使用 Vitest module mock 替換 Prisma IO singleton 與 email sender，不用 Render、真實 DB、網路 port 或郵件帳號。
- 每個案例重建 app、清除 mock 與記憶體資料，固定 Date 為 2030-01-01；測試完成關閉 app、恢復 clock。
- 覆蓋建立 201、無效輸入 400、重複醫師／時段 409、正確與錯誤／缺漏／非四碼 suffix、提前 48h/24h 取消、不足 24h 拒絕、未授權 Staff/Admin、正確 Token 與未配置 Token、DB 正常與故障時 health/ready 差異。
- 核對寫入結果與 outbox，拒絕取消時不能更新資料或新增通知。

Fake 模擬 Prisma partial unique index 的 P2002，本身不證明 PostgreSQL 真實並行互斥或 transaction rollback；本輪另外新增真實 PostgreSQL integration tests，見本頁最新紀錄。booking/Staff/Admin 瀏覽器 E2E 仍未完成。原有 20 項純函數／metrics 測試保留，另外新增 1 項未知路徑 metrics 隱私測試。

## 本次修正

- 手機末四碼驗證：原先 `endsWith('')` 可通過，現在先要求精確四位數字；查詢與取消共用保護。
- `.env.local.example` 解除根目錄與 Web 的 ignore 規則；API optional secret 範本改為註解，避免空字串使 Zod 啟動失敗。
- `/ready` probe、獨立且依 SHA 命名的 migration 操作、Ingress `/api` 路由與 GHCR 空 API origin 配合，避免 `/api/api`。
- Prometheus 改為每個 Pod 獨立 scrape；5xx threshold 統一 5%，移除低流量失真的分母 clamp；dashboard 排除探針流量並正確說明 CPU/RSS 單位。
- CI 僅 main push 發布；packages write 權限限於 publish job，保留 SHA / latest tags。
- 醫師與案例圖片使用 Next Image，保留現有 data URI／外部素材來源，使用 unoptimized，不新增任意遠端最佳化代理。依據 [Next.js Image 文件](https://nextjs.org/docs/app/api-reference/components/image)；工作區套件未提供 AGENTS.md 提到的 dist/docs，改查官方文件。
- Alertmanager example 中的憑證與個人收件地址已替換為 placeholder。若先前憑證有效，擁有者應撤銷／輪替；移除檔案內容不會使舊憑證失效，也不會清除既有 Git 歷史。

## 已知限制與後續工作

- Environment Token 不是個別使用者身分驗證；未有密碼登入、SSO、細緻 RBAC 或 lookup rate limiting。
- Admin 支援新增／讀取／修改／下架，沒有硬刪除。尚未以 E2E 覆蓋照片上傳與所有表單流程。
- availability 目前產生固定 09:00–18:00 時段，建立 API 尚未完整驗證醫師 active、營業日與未來時間。
- 取消後重訂已透過 partial unique index 與 PostgreSQL 並發測試修正；既有部署需套用新 Migration 及 API，公開 Render revision 未在本輪驗證。
- Outbox 有持久化記錄與 best-effort 立即寄送嘗試，已有 service／caller rejection boundary 與安全事件紀錄；尚無背景重試、冪等寄信保證或寄送失敗復原操作介面。
- Loki、監控持久化儲存、外部通知端到端、長期 SLO 量測未完成。
- Render 是獨立的 commit-triggered build/deploy，Kubernetes 沒有自動 CD；branch protection、registry 權限與真實 SMTP 需外部設定。

靜態 manifest 驗證、HTTP mock 測試與低負載 smoke 各有不同範圍，不能替代真實資料庫並行測試、叢集擴縮容或容量驗證。
