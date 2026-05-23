# =============================================================================
# scripts/bootstrap-backlog.ps1
# =============================================================================
# 把 docs/01-discovery.md 裡的 12 條 User Story (US-01 ~ US-12) 變成 12 個
# GitHub Issues，組成 Sprint 1 開始前的 Product Backlog。
#
# 對應講義：Agile P.47「Product Backlog」、P.49「Sample of Product Backlog」、
#         Design Thinking P.30「User Story 固定句型」、P.33「AC 結構」。
#
# 先決條件：先跑 setup-labels.ps1，否則 label 不存在會失敗。
#
# 用法：
#   pwsh ./scripts/bootstrap-backlog.ps1
#
# 跑完後可在 https://github.com/48124812/dental-clinic/issues 看到 12 個 Issue。
# =============================================================================

$repo = "48124812/dental-clinic"

# ------- User Story 資料 ----------------------------------------------------
# 注意：每條 Story 的「source of truth」依然是 docs/01-discovery.md。
# 這裡是把 doc 的內容映射到 GitHub Issue 表單。
# ----------------------------------------------------------------------------

$stories = @(
    # ===== P0 — MVP =====
    @{
        title = "[US-01] 牙痛病患在首頁看到當日營業資訊"
        labels = @("type:story", "priority:P0", "segment:U1", "area:frontend", "phase:3-mvp", "sprint:1")
        body = @'
## User Story

身為**牙痛急著找牙醫的病患**，我想要**在首頁就看到「今天還能不能看 / 電話 / 地址」**，這樣我才能**立刻決定是否前往**。

## 對應族群
- U1 — 急性疼痛患者

## Acceptance Criteria
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 使用者進入首頁 | — | 在不捲動的情況下看到「今日是否營業 / 營業時段 / 電話 / 地址」 |
| 當天為診所休診日 | — | 顯示「今日休診」+ 下一次營業時段 |
| 使用者在手機上開啟 | — | 同樣資訊清晰可見、字夠大 |

## Definition of Done
- [ ] 桌面 + 手機都驗過
- [ ] 「今日營業」資料來源在後台可改（不寫死）
- [ ] 通過 lint / type check / 測試

ref: docs/01-discovery.md US-01
'@
    },
    @{
        title = "[US-02] 病患用 3 步以內完成線上預約"
        labels = @("type:story", "priority:P0", "segment:U1", "area:frontend", "area:backend", "phase:3-mvp", "sprint:1")
        body = @'
## User Story

身為**牙痛急著找牙醫的病患**，我想要**用 3 步以內完成線上預約**，這樣我才能**不用打電話也能掛號**。

## 對應族群
- U1, U2, U3

## Acceptance Criteria
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 使用者進入預約頁面 | 點選「線上預約」 | 顯示醫師清單與可預約時段 |
| 已選擇醫師與時段 | 點「確認預約」並填妥姓名 / 電話 / 健保卡號 | 系統儲存預約並回傳預約編號 |
| 預約成功 | — | 系統發送 Email 通知病患 |
| 使用者選的時段已被別人預約走 | 在同一時段送出 | 顯示「該時段已滿」並不寫入資料庫 |
| 預約成功 30 分鐘內 | 預約還未開始 | 使用者可以用「預約編號 + 電話末四碼」查詢預約 |

## Definition of Done
- [ ] Happy path + 衝突 / 失敗情境都驗過
- [ ] 寫入 DB 是原子操作（不會兩個人搶到同一時段）
- [ ] API 有 timeout、有錯誤訊息
- [ ] 通過 lint / type check / 測試

ref: docs/01-discovery.md US-02
'@
    },
    @{
        title = "[US-03] 看到每位醫師的學經歷與專長"
        labels = @("type:story", "priority:P0", "segment:U2", "area:frontend", "area:backend", "phase:3-mvp", "sprint:1")
        body = @'
## User Story

身為**幫家人挑醫師的照顧者**，我想要**看到每位醫師的學經歷與專長**，這樣我才能**判斷該掛哪位醫師**。

## 對應族群
- U2

## Acceptance Criteria
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 使用者進入「醫師團隊」頁 | — | 列出全部醫師、照片、職稱、專長標籤 |
| 點某位醫師 | — | 進入該醫師詳情頁，看到學歷、經歷、語言、預約按鈕 |

## Definition of Done
- [ ] 至少示範 3 位醫師資料
- [ ] 圖片有 lazy loading + alt text（a11y）
- [ ] SEO meta（title / description / og:image）

ref: docs/01-discovery.md US-03
'@
    },
    @{
        title = "[US-04] 看到清楚的療程價格區間與健保註記"
        labels = @("type:story", "priority:P0", "segment:U2", "area:frontend", "area:backend", "phase:3-mvp")
        body = @'
## User Story

身為**幫家人挑醫師的照顧者**，我想要**看到清楚的療程價格區間與是否健保給付**，這樣我才能**避免事後價錢嚇到**。

## 對應族群
- U2, U3

## Acceptance Criteria
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 使用者進入「服務 / 療程」頁 | — | 列出每個療程：名稱、價格區間（NT$ XXX ~ NT$ YYY）、健保 / 自費註記 |
| 療程為自費 | — | 顯示「自費 NT$ ~」+ 小字提醒「實際依醫師評估」 |

## Definition of Done
- [ ] 至少示範 6 種療程
- [ ] 價格資訊在後台可改

ref: docs/01-discovery.md US-04
'@
    },
    @{
        title = "[US-05] 後台看到今日預約清單並能標記已到 / 未到"
        labels = @("type:story", "priority:P0", "segment:U4", "area:frontend", "area:backend", "phase:3-mvp")
        body = @'
## User Story

身為**診所櫃台**，我想要**在後台看到今日預約清單並能標記已到 / 未到**，這樣我才能**掌握當日來客**。

## 對應族群
- U4

## Acceptance Criteria
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 員工已登入後台 | 進入「今日預約」 | 列出當日所有預約，依時段排序 |
| 員工點某筆預約的「已到」 | — | 狀態變為「已到診」，列表即時更新 |
| 員工點某筆預約的「未到」 | — | 狀態變為「未到」並從待處理清單移除 |
| 員工試圖看其他日期 | 點日期選擇器 | 可切換日期，URL 帶 query 參數讓重整能保留 |

## Definition of Done
- [ ] 需要登入才能看（401 if 未登入）
- [ ] 操作有 audit log（誰、什麼時候、改了什麼）

ref: docs/01-discovery.md US-05
'@
    },
    @{
        title = "[US-06] 管理員新增 / 編輯醫師與服務項目"
        labels = @("type:story", "priority:P0", "segment:U4", "area:frontend", "area:backend", "phase:3-mvp")
        body = @'
## User Story

身為**診所管理員**，我想要**新增 / 編輯醫師與服務項目**，這樣我才能**不靠工程師也能更新網站**。

## 對應族群
- U4

## Acceptance Criteria
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 管理員登入 | 進入「醫師管理」 | 看到醫師列表，可新增 / 編輯 / 上下架 |
| 管理員登入 | 進入「服務管理」 | 看到服務列表，可新增 / 編輯 / 改價格 |
| 編輯醫師資料儲存 | — | 前台頁面即時反映（最多 60 秒內） |

## Definition of Done
- [ ] 需要登入 + 角色為 admin
- [ ] 表單欄位有 validation（必填、長度限制）
- [ ] 上傳圖片有大小 / 格式限制

ref: docs/01-discovery.md US-06
'@
    },
    @{
        title = "[US-07] 病患收到預約成功通知 Email"
        labels = @("type:story", "priority:P0", "area:backend", "phase:3-mvp")
        body = @'
## User Story

身為**任一族群病患**，我想要**收到預約成功通知（Email）**，這樣我才能**確認預約有效並有記錄**。

## 對應族群
- U1, U2, U3

## Acceptance Criteria
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 預約 API 寫入 DB 成功 | — | 觸發寄信流程，內容包含：預約編號、醫師、時段、診所地址、取消連結 |
| 寄信失敗 | — | 預約仍保留、寫入失敗 log、可重試（不要因為寄信失敗讓使用者重新預約） |

## Definition of Done
- [ ] 用 transactional email 服務（如 Resend、SendGrid）；不要自架 SMTP
- [ ] Email 服務的 API key 走 secrets manager，不寫死
- [ ] 失敗有重試機制 + log

ref: docs/01-discovery.md US-07
'@
    },

    # ===== P0 (橫切) =====
    @{
        title = "[US-10] 手機 RWD — 所有頁面在手機上不跑版"
        labels = @("type:nfr", "priority:P0", "area:frontend", "phase:3-mvp")
        body = @'
## NFR

身為**所有族群**，我想要**用手機開網站不會跑版**，這樣我才能**在 Google Maps 點進來時能直接看**。

## 對應族群
- All

## Verification
- [ ] 所有 MVP 頁面在 iPhone SE (375px) ~ iPad Pro (1024px) 範圍內可讀、可操作
- [ ] Lighthouse Mobile Score >= 90（performance / a11y / SEO）
- [ ] 主要按鈕觸控面積 >= 44x44 px（Apple HIG 標準）

ref: docs/01-discovery.md US-10
'@
    },

    # ===== P1 =====
    @{
        title = "[US-08] 美學療程案例的前後對比照"
        labels = @("type:story", "priority:P1", "segment:U3", "area:frontend", "area:backend")
        body = @'
## User Story

身為**美學療程客**，我想要**看到實際案例的前後對比照**，這樣我才能**評估療程效果**。

## 對應族群
- U3

ref: docs/01-discovery.md US-08
'@
    },
    @{
        title = "[US-09] 病患查詢與取消自己的預約"
        labels = @("type:story", "priority:P1", "area:frontend", "area:backend")
        body = @'
## User Story

身為**任一族群病患**，我想要**查詢與取消我的預約**，這樣我才能**改變計畫時不卡死**。

## 對應族群
- All

## Acceptance Criteria 草案
| 前置情境 | 觸發條件 | 期望結果 |
|---|---|---|
| 使用者有預約編號 + 電話末四碼 | 輸入查詢 | 看到自己預約 |
| 預約距開始時間 >= 24 小時 | 點取消 | 預約取消、寄取消通知 Email |

ref: docs/01-discovery.md US-09
'@
    },
    @{
        title = "[US-11] SEO — 網站在搜尋引擎可被找到"
        labels = @("type:nfr", "priority:P1", "area:frontend")
        body = @'
## NFR

身為**任一族群**，我希望**網站在搜尋引擎上被找到**（SEO）。

## Verification
- [ ] 每頁有 title / meta description / canonical
- [ ] 結構化資料：Schema.org `Dentist`、`MedicalBusiness`
- [ ] sitemap.xml + robots.txt
- [ ] Open Graph + Twitter Card

ref: docs/01-discovery.md US-11
'@
    },
    @{
        title = "[US-12] 系統有監控、出事時即時知道"
        labels = @("type:nfr", "priority:P1", "segment:U4", "area:devops", "phase:8-observe")
        body = @'
## NFR

身為**診所管理員**，我希望**系統有監控、出事時能即時知道**。

## Verification
- [ ] /health 與 /metrics endpoint
- [ ] Prometheus 抓 4 Golden Signals（Latency / Traffic / Errors / Saturation）
- [ ] Grafana dashboard
- [ ] Alert：5xx > 1% 持續 5 分鐘 → 寄信給管理員

ref: docs/01-discovery.md US-12、Observability 講義 P.80
'@
    }
)

# ------- 建立 Issues -------------------------------------------------------
Write-Host "Creating $($stories.Count) issues on $repo..." -ForegroundColor Cyan

foreach ($s in $stories) {
    $labelArgs = @()
    foreach ($l in $s.labels) { $labelArgs += @("--label", $l) }

    $url = gh issue create `
        --repo $repo `
        --title $s.title `
        --body $s.body `
        @labelArgs 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  + $($s.title)" -ForegroundColor Green
        Write-Host "      $url" -ForegroundColor DarkGray
    } else {
        Write-Host "  ! $($s.title) — $url" -ForegroundColor Yellow
    }
}

Write-Host "`nDone. Verify at: https://github.com/$repo/issues" -ForegroundColor Cyan
