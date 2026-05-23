# Sprint 1 — Review + Retrospective

> 對應講義：Agile P.54 Scrum 5 events 的 Sprint Review (展示成果) + Sprint Retrospective (反思流程)。
>
> 完成日：2026-05-23

---

## 1. Sprint Goal 達成？

**原始 Goal**（from `02-sprint-1-plan.md`）：
> 能在本機跑起來的牙醫診所「資訊頁」：包含首頁營業資訊、醫師列表/詳情、療程價格，手機桌面都不跑版，且後端資料來自 Postgres。

**結論：✅ 達成**

- 4 條 Story 全部 close
- 4 個頁面可在本機跑：`/`、`/doctors`、`/doctors/[id]`、`/services`
- Postgres + Prisma 整合完成，所有資料來自 DB（非 hard-code）
- 手機 / 桌面 RWD 通過（修了一個 mobile nav 缺失）

---

## 2. Story 完成清單

| Issue | Story | Points | PR |
|-------|-------|--------|-----|
| [#2](https://github.com/48124812/dental-clinic/issues/2)  | US-01 — 首頁含今日營業資訊 | 2 | #16 |
| [#4](https://github.com/48124812/dental-clinic/issues/4)  | US-03 — 醫師列表 + 詳情 | 3 | #17 |
| [#5](https://github.com/48124812/dental-clinic/issues/5)  | US-04 — 療程價格列表 | 2 | #19 |
| [#9](https://github.com/48124812/dental-clinic/issues/9)  | US-10 — 手機 RWD | 3 | (this PR) |
| **總計** | | **10 points** | 4 PRs |

**Velocity**：10 points per sprint（首次 sprint，作為下一次的 baseline）

---

## 3. 額外完成（不在原計畫但順手做了）

- **Phase 3.1**：Monorepo bootstrap (pnpm workspaces) — PR #15
- **Production Readiness Checklist**：`docs/PRODUCTION-CHECKLIST.md`
- **Learning Notes**：`docs/LEARNING-NOTES.md` — 整個 sprint 學到的指令/概念
- **CORS** 設定（不在 Story 內但前端 fetch 需要）
- **graceful SIGTERM shutdown**（提前準備 K8s deployment）

---

## 4. Sprint Review — 展示成果

**對外可看的東西**：
- ✅ http://localhost:3000/ — 牙醫首頁
- ✅ http://localhost:3000/doctors — 醫師列表
- ✅ http://localhost:3000/doctors/doc_wang — 醫師詳情頁 + 動態 SEO `<title>`
- ✅ http://localhost:3000/services — 6 分類 9 個療程
- ✅ http://localhost:3001/api/* — 4 個 API endpoints
- ✅ http://localhost:3001/health — health check（K8s readiness/liveness probe 用）

**有但用不到的東西**（technical debt 但故意先放）：
- 「立即預約」按鈕連到 `/appointments/new`，目前 404（Sprint 2 做）
- Doctor 詳情頁的「預約 XX 醫師」按鈕也 404
- 圖片全部用文字 fallback（沒上傳功能）

---

## 5. Retrospective — 4Ls 反思

### 👍 Liked（喜歡 / 做得好）

- **分層架構從 Sprint 1 就拉好**：route → service → repository，重複套用 3 次（doctors、services、business-hours）後肌肉記憶建立
- **小 PR 越來越熟練**：第 1 個 PR 41 files（太大），第 2 個 8 files，第 3 個 9 files，每個 PR review 都很順
- **`Closes #N` 自動 close issue**：流程感很爽，符合 CI/CD 講義 P.77 「PR Lifecycle」
- **Server Component 預設 + Client Component 局部**的策略，header 大部分 SSR，只有 MobileMenu 是 client，平衡良好

### 🤔 Learned（學到 / 新觀念）

- 12-Factor App 不是教條，是「想避免哪種痛」的設計取捨
- Prisma migration 是真相之源（不能手改 SQL，必須再開新 migration）
- React Server Components 的「server-first」哲學 — 預設 server，需要互動才 client
- Next.js 15+ `params` 是 Promise（breaking change）
- PowerShell 的 quoting / encoding / PATH refresh 等三個老雷
- pino + 結構化 log + reqId 是 distributed tracing 的基礎

### 😣 Lacked（缺乏 / 做不好）

- **零測試**：每條 Story 都沒寫 unit test 或 integration test。對應 12-Factor SDLC P.61 test pyramid，我們連 unit (80%) 都沒做。**Sprint 2 補**。
- **大 PR (#16) 違反 small-PR 原則**：41 files、混合 backend + frontend + infra，正規應拆 4–5 個 PR
- **沒做 PR self-review**：merge 前沒在 GitHub 上看 Files changed，依賴本機驗證
- **手機 nav 漏掉**：寫 `hidden sm:flex` 卻沒設 fallback，是 acceptance criteria 上的疏忽（後來補了 MobileMenu）
- **`isCurrentlyOpen` 沒考慮中午休息時段**：BusinessHours model 只有單一 open/close，遇到「09:00-12:00, 14:00-21:00」現實狀況無法表達。**Sprint 2 改 schema**
- **沒部署過任何一次**：全程 localhost，沒驗證雲端 SSR 表現

### 🔮 Longed For（希望 / 想試）

- **第一條 unit test**：用 vitest 測 `computeTodayStatus(weekly, now)` pure function
- **第一條 e2e test**：playwright 跑「進首頁 → 點預約 → 看到頁面」
- **CI workflow**：每個 PR 自動跑 lint + typecheck + build（對應 Phase 6）
- **真實環境部署**：把 Sprint 1 成果推到 Vercel / Render 之類，拿真 URL 看
- **Schema migration 演練**：故意改 schema 試一次 rollback
- **更專業的圖片資產**：醫師照片 placeholder 太陽春

---

## 6. Action Items for Sprint 2

| 動作 | 為什麼 | 誰 / 何時 |
|------|--------|---------|
| 加 vitest，至少 3 條 unit test (computeTodayStatus、priceLabel、categoryLabel) | 抵還測試技術債 | Sprint 2 第一天 |
| 學會 `git rebase -i` 把大 PR 拆成多個 commit | 為了之後能正確分 PR | Sprint 2 開始前 |
| 改 BusinessHours schema 支援多時段 (午休) | 真實診所必需 | Sprint 2 第一個 Story |
| Sprint 2 PR 規模上限 = 15 files | 強制紀律 | 整個 Sprint 2 |
| 開 PR 後**必 self-review 一次 Files changed** | catch 自己寫的爛 code | 每個 PR |
| Phase 6 加 CI workflow | 自動化品質閘門 | 進 Phase 4–6 |

---

## 7. Carry-over to Sprint 2 Backlog

從 Product Backlog 拉這些到 Sprint 2 候選：
- **US-02** (#3) — 線上預約核心功能 (最大張、最具商業價值)
- **US-05** (#6) — 後台今日預約清單
- **US-06** (#7) — 後台管理員 CRUD
- **US-07** (#8) — 預約成功 Email 通知

Sprint 2 規劃會挑 1–2 條（不要塞滿，留給：技術債、測試、Phase 4 12-Factor refactor）。

---

## 8. Status snapshot

```
Product Backlog open issues:  12 → 8  (closed: #2, #4, #5, #9)
Phases completed:             1, 2, 3
Phase 4–8 remaining:          12-Factor / Docker / CI/CD / Deploy / Observability
Tech debt items:              5 (見 Lacked 段)
Test coverage:                0%  ← 待還
```
