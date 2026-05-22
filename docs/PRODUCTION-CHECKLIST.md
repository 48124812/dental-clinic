# Production Readiness Checklist

> 從「學習專案」轉成「真實牙醫診所官網」之前，**整張清單必須打勾**。
>
> 對應講義：12-Factor App、12-Factor SDLC P.74「Review checklist」、System Architecture「安全性」段落。

---

## 1. Secrets & 帳號安全

- [ ] 所有過去用過的開發測試 token / API key **rotate 一輪換新**（包含 GitHub PAT、OAuth secret、第三方 API key）
- [ ] 全文檢查 Git 歷史是否曾經誤 commit 過敏感資料（用 `gh secret-scanning` 或 `gitleaks`）
- [ ] `.env` 從未進 Git 歷史；`.env.example` 只放 placeholder
- [ ] Production 環境的 secrets 放在雲端 Secret Manager（GCP Secret Manager / AWS Secrets Manager / K8s Secret），**不在 GitHub Actions 變數裡硬寫**
- [ ] DB password 至少 32 字元、隨機產生

## 2. Repository 可見性

- [ ] Repo 切 **Private**（Settings → General → Danger Zone → Change visibility）
- [ ] 確認所有合作者用 personal access token，不用密碼
- [ ] Branch Protection：`main` 禁止直接 push、必須通過 CI、必須 1 人 review

## 3. 法遵 (台灣個資法 + 醫療法)

- [ ] 寫隱私權政策頁面（明確說明：蒐集哪些資料、用途、保存期限、如何刪除）
- [ ] 預約頁面加「同意條款」勾選 — 健康相關資訊屬「特種個資」，依《個資法》§6 須當事人書面同意
- [ ] 提供「使用者要求刪除個人資料」的途徑
- [ ] 不蒐集不必要的個資（最小蒐集原則）：例如不需要身分證字號就不要蒐集
- [ ] DB 加密：靜態加密（at-rest encryption）開啟、欄位層加密敏感欄位（如電話）
- [ ] 與診所簽訂「資料處理者協議」(DPA) 釐清權責

## 4. 網域與 HTTPS

- [ ] 買網域（推薦：Cloudflare Registrar，價格接近成本價、自動 WHOIS 隱私）
- [ ] DNS 指向部署環境
- [ ] HTTPS 強制啟用（Cloudflare proxy 或 Let's Encrypt + cert-manager）
- [ ] HSTS header 設定
- [ ] WWW 與 root domain 統一（301 重導）

## 5. 監控與告警 (Phase 8)

- [ ] 部署 Uptime monitoring（UptimeRobot / Better Stack 免費版）
- [ ] /health endpoint 對外不洩漏內部資訊
- [ ] Error tracking（Sentry 免費版）接好
- [ ] Email 告警：服務 5 分鐘無回應 → 寄信
- [ ] 定義 SLI / SLO：例如「99% 預約 API P95 < 500ms」

## 6. 備份與災難復原

- [ ] DB 每日自動備份、保留 30 天
- [ ] 備份在「不同地理區域」（off-site）
- [ ] **演練過一次 restore** — 沒演練的備份等於沒有
- [ ] 重要 commit / release 打 tag，方便 rollback

## 7. 文件

- [ ] README 標明這是 production 系統、聯絡窗口、緊急聯絡方式
- [ ] Runbook：常見問題的處理步驟（例如「預約寄不出 Email」）
- [ ] ADR (Architecture Decision Record) 記錄重大技術選擇

---

## 為什麼要這份 Checklist？

這份清單對應講義裡反覆強調的核心：**「learning 環境的假設」和「production 環境的假設」差很多**。

- 12-Factor SDLC P.37 提到 dev/prod parity，但**這指的是技術配置一致**，不是「dev 怎麼隨便 prod 就怎麼隨便」
- 12-Factor SDLC P.74 review checklist：「Config/secrets externalized」、「Idempotency / retry-safety」、「Backward-compatible API and DB migrations」
- System Architecture 安全性段落：功能安全（防小偷）+ 架構安全（防強盜）

「學習時 public + 真信箱」沒關係，但**「上線前一週才急著補這些」必爆炸**。所以這份 checklist 我們現在就寫好，之後每個 Phase 結束時回來看看可以打勾哪一條。
