# Render 免費 PostgreSQL 換庫：合成 Demo 資料初始化

本流程保留既有 Web/API 服務與公開網址，只更換 API 使用的資料庫。這是建立全新的合成 Demo 資料，不是搬遷舊資料；舊預約編號、取消歷史與管理介面修改不會自動出現在新 DB。需要保留舊資料時，先停止本流程，另行規劃匯出與還原，不能以 Seed 取代備份。

下次換庫可直接依照「你需要手動完成的 Dashboard 步驟」操作，最後逐項完成「下次操作 Checklist」。全程可在 Render Dashboard 與瀏覽器完成，不需要啟動本機 Docker、執行終端機指令或重新建立 Web/API。每次仍須先確認平台限制與部署設定沒有改變。

## 官方限制（2026-09-29 核對）

- 每個 Workspace 同時只能有一個啟用中的 Free PostgreSQL，容量固定 1 GB。
- 免費資料庫建立後 30 天到期，到期即無法存取；14 天寬限期是付費升級救回資料的時間，不是免費繼續使用的時間，之後資料庫及資料會刪除。
- 沒有 Render 管理的備份或連線池；平台維護或重啟也可能造成暫時中斷。
- Free Web Service 沒有 Dashboard Shell／SSH 或一次性 Job，閒置後亦可能冷啟動。因此本專案沿用容器啟動時的 `prisma migrate deploy`，不依賴付費的 pre-deploy 功能。

來源：[Render Free 官方限制](https://render.com/docs/free)。舊資料庫信件列出的到期日是 **2026-10-01**，不是更換後新資料庫的到期日。新庫到期時間以它自己的 Dashboard／通知為準，請自行在到期前 3～5 天設提醒；本文件不會自動建立提醒。不要假設目前可以先開第二個免費 DB，也不要假設建立新 DB 能無限延長免費額度；建立資格以平台當時的實際限制為準。

## 目前程式的初始化方式

1. `RUN_MIGRATIONS=true`：依序執行 repository 既有的全部 Prisma Migrations。
2. `RUN_SAMPLE_SEED=true`（僅首次初始化期間）：執行受保護的 `prisma/seed.ts`。
3. Migration 或 Seed 失敗會讓啟動腳本停止；成功後才啟動 Fastify。

保留三份原始 Migration，不改歷史、不執行 `prisma db push`、不做 reset。自訂 Migration 建立的 `Appointment_active_doctorId_startsAt_key` 只對非 `CANCELLED` 記錄限制醫師／時段唯一性，因此取消歷史可保留且時段可重訂。

Seed 的單筆交易鎖住八張業務表，檢查它們是否全部為空。空 DB 只建立 **4 位合成醫師、9 項療程、7 筆營業時間、2 個案例佔位資料**，不建立病患、預約、使用者帳號或真實憑證。已有任何業務資料時整批跳過，包含只有部分目錄資料的情況；不補回被刪資料、不覆寫編輯、不清除紀錄。中途失敗全部回滾。鎖定等待最多 5 秒、交易最多 30 秒；逾時時先確認目標與併發寫入，不盲目重試。

`RUN_SAMPLE_SEED` 預設為 `false`。完成初始化後必須關閉：一般重啟不會呼叫 Seed。即使忘記關閉，只要 DB 已有業務資料，再次執行也會跳過寫入。這是空庫初始化保護，不是永遠只執行一次的獨立標記；若日後人工清空所有業務表，又開啟此旗標，就會重新初始化。

## 你需要手動完成的 Dashboard 步驟

### 1. 切換前準備

- 先讓包含本次 Seed 保護的程式版本在既有 API 服務部署成功，再換 DB。舊版 Seed 會覆寫資料，不能只在舊版設定 `RUN_SAMPLE_SEED=true`。
- 安排停止展示與寫入的維護時段。必要時在 Dashboard 暫停既有 API 服務（不要刪除），並暫停會繞過維護時段的自動部署／Blueprint Auto Sync；若暫停服務，完成設定後再恢復。
- 在舊 DB 仍可連線時決定是否需要保留資料。需要保留就先自行安全匯出並驗證備份；不要把 dump、URL 或個資放到 Git／聊天中。本輪工具不會替你刪舊 DB。
- 確認新的 Blueprint 已移除舊 `databases` 資源定義，且 `DATABASE_URL` 是 `sync: false`。同步後再檢查 API 的實際環境設定。這不會刪除舊 DB，也不會替現有服務自動填入新連線值。

Dashboard 導覽：

1. 從首頁 **Projects → Ungrouped Services** 找到既有 `dental-clinic-api`、`dental-clinic-web` 與目前使用的 PostgreSQL；若資源已分組，進入對應 Project 查找。
2. **Blueprints → dental-clinic → Resources**：確認只管理 API／Web，不再管理待刪除的 DB。
3. **Syncs → 最新紀錄 → View details**：確認成功勾號及預期的 Commit。2026-09-29 使用的是含 Seed 保護的 `0d8a175`；下次使用包含該修正的後續版本即可，不需退回這個 Commit。
4. **dental-clinic-api → Environment**：平時應為 `RUN_MIGRATIONS=true`、`RUN_SAMPLE_SEED=false`。API 部署成功不等於 Blueprint 同步成功，兩者分別確認。

若已確認維護期間不會有任何預約或其他寫入，可不暫停 API（本次採用此方式）；否則先使用 API 的 **Settings → Delete or suspend → Suspend**，不要選 Delete。刪 DB 後 API 可能顯示錯誤或無法啟動，是維護期間的預期中斷。

Blueprint 的手動改動可能被下次同步覆蓋；`sync: false` 用於保留 Dashboard 管理的值。移除資源定義不會自動刪除資源，但若保留舊定義又手動刪 DB，下次同步可能重新建立它。來源：[Blueprint 行為](https://render.com/docs/infrastructure-as-code)、[環境變數規格](https://render.com/docs/blueprint-spec)。

### 2. 建立新的免費 DB

若目前仍有啟用中的免費 DB，建立第二個時會出現 `cannot have more than one active free tier database`。這表示建立失敗，並未自動切換 API 連線。依序處理：

1. 確認只需全新的合成 Demo 資料、可永久捨棄舊資料，且已完成上節 Blueprint 檢查及停止寫入。若需要保留資料，停止此流程，先規劃備份與還原。
2. 從首頁進入**目前 API 使用的舊 PostgreSQL**，核對資源名稱與類型。不要照抄歷史名稱：本次刪除的是 `dental-clinic-db`，下次應以當時實際使用的 DB 為準。
3. 在該 DB 的 **Settings → Delete Database**，閱讀確認視窗，核對目標後依畫面要求刪除。這會永久移除整個舊 DB，沒有本流程提供的復原方式。**絕對不要刪除 API 或 Web 服務。**
4. 選 **New → Postgres**，使用新的可辨識名稱，例如本次的 `dental-clinic-db-demo-2`；下次可改為 `dental-clinic-db-demo-3`。
5. 選 **Free、Singapore、PostgreSQL 16**（與本機驗證版本相同），維持 1 GB，Storage Autoscaling／High Availability 不啟用；確認總額 **$0/month** 後按 **Create database**。
6. 等待 **Available**。若仍出現名額限制，停止並核對 Workspace 資源與平台提示，不改選付費方案、不再刪其他資源。本文件不保證刪除或到期後會立刻釋出名額。

此方式會先刪舊庫再建新庫，期間預約功能無法使用，也無法回退到已刪除的舊庫；不是零停機切換。不要在重要展示開始前臨時操作。

來源：[建立與連線官方指南](https://render.com/docs/postgresql-creating-connecting)。Web/API 服務不要刪除或重建；只換 DB 不需要換它們的公開網址。

### 3. 更新既有 API 的 Environment

在既有 `dental-clinic-api` 服務中，由你私下填入下列值，不要截圖或貼出連線字串：

先在新 DB 的 **Connect／Connections** 複製 **Internal Database URL**，再進入 **dental-clinic-api → Environment → Edit**，同一次編輯更新以下三項。不要把 URL 寫進 repository、README、聊天或公開截圖。

| 變數 | 設定 |
| --- | --- |
| `DATABASE_URL` | 新 DB 的 Internal Database URL；API 與 DB 必須在同一區域且可透過私有網路連線 |
| `RUN_MIGRATIONS` | `true` |
| `RUN_SAMPLE_SEED` | 暫時設為 `true` |

不要更改 Web 的 `NEXT_PUBLIC_API_URL`、`INTERNAL_API_URL` 或 API 的 `CORS_ORIGIN`；它們仍指向原 Web/API 服務。新的 DB URL 只能放在 API，不能放在 `NEXT_PUBLIC_*`。

一次儲存這些設定並依 Dashboard 選項部署／重啟**已包含本次修正**的版本。`Save and deploy` 使用既有建置搭配新環境變數，不會自動把尚未部署的本機程式納入。來源：[環境變數操作](https://render.com/docs/configure-environment-variables)。

### 4. 確認初始化並關閉 Seed

- API Log 應先顯示 Migration 成功，再出現 `Demo seed complete: empty database initialized.`，最後 API 啟動。不要貼完整連線或 SQL 錯誤到公開處。
- 若是新空庫卻出現 `Demo seed skipped: existing application data preserved.`，先確認是否連錯 DB 或已有資料，不要清庫強迫 Seed。
- 初始化成功後，立刻將 `RUN_SAMPLE_SEED=false` 儲存並重新部署／啟動。保留 `RUN_MIGRATIONS=true`；沒有新 Migration 時會顯示沒有待執行項目，不會重新套用歷史。
- 確認後續啟動沒有 Seed 訊息，最後才恢復展示／寫入與原本需要的自動部署。Blueprint 也預設 `false`，不要為一次初始化將它永久改為 `true`。

兩次部署都應等待 **Deploy succeeded／Live**：第一次是換連線並初始化，第二次是關閉 Seed。查看 **dental-clinic-api → Logs** 時，選擇這次部署的時間範圍，避免把先前啟動的 Seed 訊息誤認為新結果。

### 5. 公開功能驗收

1. [Health](https://dental-clinic-api-ylv9.onrender.com/health) 回 `200`，再確認 [Ready](https://dental-clinic-api-ylv9.onrender.com/ready) 回 `200` 且 DB 檢查成功。Health 單獨成功不足以證明資料庫可用。
2. [Web](https://dental-clinic-web-ejw6.onrender.com/) 顯示營業時間；醫師、療程頁載入合成目錄。
3. 依 [Online Demo](DEMO.md#online-demo-script-3-minutes) 使用假資料，選至少兩天後的時段，建立 → 查詢 → 取消 → 相同醫師時段重訂 → 查詢舊取消紀錄；最後取消新預約。
4. 再次重啟 API 後，確認已有的合成紀錄與目錄編輯保留、沒有再次 Seed。全程不要使用真實病患資料或執行公開負載測試。

操作用假資料：姓名 `Demo Patient`、電話 `0000005678`、Email `demo@example.invalid`、識別碼（若必填）`DEMO_ONLY`。自行暫存預約編號、醫師與時段，查詢輸入手機末四碼 `5678`；不要將產生的預約編號或測試截圖提交到 Git。重訂成功後應取得不同編號，原編號仍能查到 `CANCELLED`。送出後若逾時，不要連續重複提交，先確認結果。

`/ready` 預期顯示 `status: ready` 且 `checks.db.ok: true`。若 Web 顯示「Demo 暫時無法載入」，先等待冷啟動、確認 `/ready`，再重新整理 Web；持續失敗則依下節排查，不需要重新建立 Web/API。

## 2026-09-29 實際更換紀錄

以下依維護者在 Dashboard 的操作回報、提供的同步截圖及瀏覽器結果記錄，不是本輪工具重新執行的自動化驗證。未保存密碼、連線字串、預約編號或病患資料。

| 項目 | 本次結果 |
| --- | --- |
| 部署／Blueprint | `0d8a175`（PR #52，Seed 保護）；Sync details 成功勾號，Resources 只列 API／Web |
| 舊 DB | `dental-clinic-db`；維護者選擇不保留舊 Demo 資料，確認刪除 |
| 名額限制 | 首次建立新庫遇到 `cannot have more than one active free tier database`；刪除舊庫後新庫建立成功 |
| 維護方式 | 維護者確認期間不會有預約，未暫停 API；保留 Web/API 服務與網址 |
| 新 DB | 依 `dental-clinic-db-demo-2`、Free、Singapore、PostgreSQL 16 的步驟建立；維護者回報 Available |
| 首次初始化 | 更新新 Internal URL、Migration=true、Seed=true，回報 Deploy succeeded；確認看到 `Demo seed complete: empty database initialized.` |
| Migration 證據範圍 | 啟動腳本會在 Seed 前執行既有 Migration；本次未另收集逐筆 Migration SQL 或索引檢查結果 |
| 關閉 Seed | 改回 `RUN_SAMPLE_SEED=false`，第二次 Deploy succeeded；尚未另回報該次啟動無 Seed 訊息 |
| 資料庫就緒 | 維護者貼回 `/ready`：`status=ready`、`db.ok=true`；2026-09-29 08:33:22 UTC，該次 DB 檢查耗時 2 ms（不是效能測試） |
| 公開功能 | 維護者確認醫師／療程顯示、建立預約、查詢、取消均成功 |
| 尚待本次線上驗證 | 取消後相同醫師時段重訂、用原編號確認取消紀錄保留、資料建立後重啟的保留驗證、獨立 `/health` 檢查 |
| 新 DB 到期日 | 尚未記錄 Dashboard 顯示的確切時間；不能沿用舊庫的 2026-10-01 |

結論：本次換庫與基本預約、查詢、取消功能已確認；完整重訂驗收仍待完成，不能將本機 Integration Test 成功當成這次 Render 重訂已成功。

## 下次操作 Checklist

- [ ] 先查新 DB 的實際到期日，提前安排維護；重新確認官方 Free 限制與建立資格。
- [ ] 確定可捨棄舊資料；若不可捨棄，停止並先做備份／還原規劃。
- [ ] 確認 API 已有 Seed 保護、Blueprint 同步成功且不管理待刪 DB。
- [ ] 停止所有寫入；有必要時 Suspend API，保留 API／Web 資源。
- [ ] 核對真正的舊 PostgreSQL 名稱，明確接受永久資料遺失後才刪除。
- [ ] 建立新 Free DB（同區域、相容版本），等待 Available，記下新到期日。
- [ ] 私下更新 API 的 DATABASE_URL；Migration=true、Seed=true，一次 Save and deploy。
- [ ] 確認部署成功與這次的 `Demo seed complete: empty database initialized.`。
- [ ] Seed=false，再次 Save and deploy；確認本次啟動未再執行 Seed。
- [ ] 若先前 Suspend API，恢復服務；檢查 `/health` 與 `/ready`。
- [ ] Web 醫師／療程正常；用假資料建立至少兩天後的預約並查詢。
- [ ] 取消 → 同醫師同時段重訂 → 新舊編號不同 → 舊編號仍為 CANCELLED。
- [ ] 取消新的測試預約；確認重啟後資料保留，恢復先前暫停的自動部署／同步設定。
- [ ] 記錄實際完成項目與待驗證項目；不保存 Secret、原始 Log 或預約編號到 Git。

## 中斷與失敗處理

舊 DB 到期、連線切換、啟動 Migration／Seed、Web/API 冷啟動均可能造成錯誤畫面或不可用。切換期間送出的寫入可能落在舊庫且不會出現在新庫，所以必須先停止寫入；新庫上線後，舊編號查無資料是新資料集的預期限制，不應宣稱資料已搬遷。

若 Migration／Seed 失敗，保持維護狀態，確認目標 DB、Migration 狀態與 Log；不執行 reset、不刪 `_prisma_migrations`、不修改歷史 SQL。部分索引升級的復原流程見 [預約一致性](12-booking-consistency.md#deployment-and-recovery)。只有舊 DB 仍可用且資料切換影響已確認時，才能由維護者考慮將 API 指回舊 DB；到期 DB 不能假設可回退。

本機驗證使用 `pnpm test:integration` 的隔離 Docker PostgreSQL，包括受保護 Seed 的並行初始化、重跑保留資料、部分資料庫跳過、失敗回滾，以及新庫上的預約／查詢／取消／重訂。歷史執行結果見 [驗證紀錄](09-project-verification.md)；這些本機測試與上方維護者回報的 Render 更換結果分開記錄，不能互相取代。
