# Render 免費 PostgreSQL 換庫：合成 Demo 資料初始化

本流程保留既有 Web/API 服務與公開網址，只更換 API 使用的資料庫。這是建立全新的合成 Demo 資料，不是搬遷舊資料；舊預約編號、取消歷史與管理介面修改不會自動出現在新 DB。需要保留舊資料時，先停止本流程，另行規劃匯出與還原，不能以 Seed 取代備份。

## 官方限制（2026-09-29 核對）

- 每個 Workspace 同時只能有一個啟用中的 Free PostgreSQL，容量固定 1 GB。
- 免費資料庫建立後 30 天到期，到期即無法存取；14 天寬限期是付費升級救回資料的時間，不是免費繼續使用的時間，之後資料庫及資料會刪除。
- 沒有 Render 管理的備份或連線池；平台維護或重啟也可能造成暫時中斷。
- Free Web Service 沒有 Dashboard Shell／SSH 或一次性 Job，閒置後亦可能冷啟動。因此本專案沿用容器啟動時的 `prisma migrate deploy`，不依賴付費的 pre-deploy 功能。

來源：[Render Free 官方限制](https://render.com/docs/free)。信件列出的本次到期日是 **2026-10-01**，確切狀態與時間仍以 Dashboard 為準。不要假設目前可以先開第二個免費 DB，也不要假設建立新 DB 能無限延長免費額度；建立資格以平台當時的實際限制為準。

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

Blueprint 的手動改動可能被下次同步覆蓋；`sync: false` 用於保留 Dashboard 管理的值。移除資源定義不會自動刪除資源，但若保留舊定義又手動刪 DB，下次同步可能重新建立它。來源：[Blueprint 行為](https://render.com/docs/infrastructure-as-code)、[環境變數規格](https://render.com/docs/blueprint-spec)。

### 2. 建立新的免費 DB

- 選 **New → Postgres**，使用可辨識的新名稱，選 **Free、Singapore、PostgreSQL 16**（與本機驗證版本相同），等待 **Available**。
- 若 Dashboard 因一個啟用中 Free DB 的限制拒絕建立，停止並先確認舊庫的處置與可接受停機時間。不要建立付費方案或刪除資料來自動繞過限制；本文件不保證到期後會立刻釋出名額。
- 由你決定是否及何時移除舊 DB。新 DB 建立、Migration、Seed 與 API 重啟之間可能完全無法使用預約功能；這不是零停機切換。

來源：[建立與連線官方指南](https://render.com/docs/postgresql-creating-connecting)。Web/API 服務不要刪除或重建；只換 DB 不需要換它們的公開網址。

### 3. 更新既有 API 的 Environment

在既有 `dental-clinic-api` 服務中，由你私下填入下列值，不要截圖或貼出連線字串：

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

### 5. 公開功能驗收

1. [Health](https://dental-clinic-api-ylv9.onrender.com/health) 回 `200`，再確認 [Ready](https://dental-clinic-api-ylv9.onrender.com/ready) 回 `200` 且 DB 檢查成功。Health 單獨成功不足以證明資料庫可用。
2. [Web](https://dental-clinic-web-ejw6.onrender.com/) 顯示營業時間；醫師、療程頁載入合成目錄。
3. 依 [Online Demo](DEMO.md#online-demo-script-3-minutes) 使用假資料，選至少兩天後的時段，建立 → 查詢 → 取消 → 相同醫師時段重訂 → 查詢舊取消紀錄；最後取消新預約。
4. 再次重啟 API 後，確認已有的合成紀錄與目錄編輯保留、沒有再次 Seed。全程不要使用真實病患資料或執行公開負載測試。

## 中斷與失敗處理

舊 DB 到期、連線切換、啟動 Migration／Seed、Web/API 冷啟動均可能造成錯誤畫面或不可用。切換期間送出的寫入可能落在舊庫且不會出現在新庫，所以必須先停止寫入；新庫上線後，舊編號查無資料是新資料集的預期限制，不應宣稱資料已搬遷。

若 Migration／Seed 失敗，保持維護狀態，確認目標 DB、Migration 狀態與 Log；不執行 reset、不刪 `_prisma_migrations`、不修改歷史 SQL。部分索引升級的復原流程見 [預約一致性](12-booking-consistency.md#deployment-and-recovery)。只有舊 DB 仍可用且資料切換影響已確認時，才能由維護者考慮將 API 指回舊 DB；到期 DB 不能假設可回退。

本機驗證使用 `pnpm test:integration` 的隔離 Docker PostgreSQL，包括受保護 Seed 的並行初始化、重跑保留資料、部分資料庫跳過、失敗回滾，以及新庫上的預約／查詢／取消／重訂。實際執行結果見 [驗證紀錄](09-project-verification.md)，不代表已在 Render 換庫。
