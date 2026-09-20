# 專案補強與驗證紀錄

保留 Next.js / Fastify / Prisma 架構，補齊 HTTP 層測試與交付文件。以下區分 P0/P1 初次結果與 P2 後續結果；未修改 Render、GHCR 或既有 Kubernetes 部署。

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
