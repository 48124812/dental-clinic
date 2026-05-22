# Sprint 1 Plan

> 對應講義：Agile P.50–56「Scrum」、P.59–66「Kanban」、Design Thinking P.49–50「MVP」。
>
> **Sprint Goal**: Deliver a deployable, mobile-friendly read-only clinic website
> covering homepage, doctor list/detail, and service pricing — running locally
> with a real Postgres DB, ready for Phase 4 onwards.

---

## 1. Sprint Backlog

| Issue | User Story | Points | Notes |
|-------|------------|--------|-------|
| [#2](https://github.com/48124812/dental-clinic/issues/2)  | US-01 — 首頁含今日營業資訊 | 2 | Static content + business hours rule |
| [#4](https://github.com/48124812/dental-clinic/issues/4)  | US-03 — 醫師列表 + 詳情頁 | 3 | DB schema + API + 2 pages |
| [#5](https://github.com/48124812/dental-clinic/issues/5)  | US-04 — 療程價格列表 | 2 | Similar to US-03, single page |
| [#9](https://github.com/48124812/dental-clinic/issues/9)  | US-10 — 手機 RWD（橫切） | 3 | Apply to all 3 pages |
| | **Total** | **10** | |

**Out of scope this sprint** (still in Product Backlog):
- US-02 (booking) — Sprint 2
- US-05, US-06 (admin) — Sprint 2
- US-07 (email) — Sprint 2
- US-08, US-09, US-11, US-12 — later

---

## 2. Sprint Goal — One Sentence

> **能在本機跑起來的牙醫診所「資訊頁」**：包含首頁營業資訊、醫師列表/詳情、療程價格，手機桌面都不跑版，且後端資料來自 Postgres（不寫死在 code）。

對應 Design Thinking 講義 P.50：MVP 是「能滑的滑板」，這個 Sprint 結束時你能拿給任何人看「這是診所官網的 v1」，不是半成品。

---

## 3. Sprint Length

- **Time-box**: 沒有硬性 deadline（學習專案 vs. 真實 Sprint）
- **Definition of "Sprint Done"**:
  - 4 條 Story 全部 close
  - 應用程式在本機 `npm run dev` 跑得起來
  - 對應 4 個頁面：首頁 / 醫師列表 / 醫師詳情 / 療程
  - Postgres DB 跑得起來（Docker 或本機都行）
  - 手機（Chrome DevTools 切手機模式）所有頁面不跑版

---

## 4. Definition of Done — Per Story

每條 Story 要 close 之前都必須打勾：

- [ ] **Code**：通過 lint + type check
- [ ] **Tests**：至少有一個對應的測試（unit 或 e2e）
- [ ] **AC**：原始 Issue 的 AC 全部驗過
- [ ] **No secrets**：沒有任何密碼 / API key 寫死在 code
- [ ] **PR**：走完 feature branch → PR → merge 流程
- [ ] **Issue 關閉**：merge 後對應 Issue 自動 close（commit 寫 `closes #N`）

對應 12-Factor SDLC P.94 takeaway 第 5 條「LLMs increase throughput; verification becomes essential」 — 沒驗證的「做完」就是技術債。

---

## 5. Tech Decisions for Sprint 1（會在 Phase 3 開頭詳述）

| 決策 | 選擇 | 取代方案 | 理由 |
|------|------|---------|------|
| Monorepo or polyrepo? | Monorepo（`apps/web` + `apps/api`） | 兩個獨立 repo | 學習階段管理一個 repo 簡單 |
| Frontend rendering | Next.js App Router (SSR) | CSR-only | SEO 重要、社群分享要 OG image |
| Backend framework | Fastify + TypeScript | Express / Hono | 講義 lab 對齊、效能佳 |
| ORM | Prisma | Drizzle / 手寫 SQL | TypeScript 生態最成熟 |
| Styling | Tailwind CSS | CSS Modules / styled-components | 學一次到處可用、生態最大 |
| Validation | Zod | Yup / Joi | 與 TS 型別深度整合 |
| Tests | Vitest (unit) + Playwright (e2e) | Jest | Vitest 更快、與 Vite 生態整合 |

---

## 6. Kanban Board

我們會用 GitHub Projects（Projects v2）做一個 Kanban Board，三欄：

```
┌─────────┬─────────┬─────────┐
│  TODO   │  DOING  │  DONE   │
├─────────┼─────────┼─────────┤
│ #4 US-03│ #2 US-01│         │
│ #5 US-04│         │         │
│ #9 US-10│         │         │
└─────────┴─────────┴─────────┘
```

對應 **Agile 講義 P.59–62**：
- **Visualize the work** — 看到每張卡在哪一欄
- **Limit WIP** — DOING 欄最多 1~2 張（一個人專案最多 1）
- **Manage the flow** — 整體吞吐量取決於瓶頸

---

## 7. Sprint Risks（可能會卡的事）

| 風險 | 影響 | 緩解 |
|------|------|------|
| 第一次寫 Next.js / Fastify，學習曲線陡 | Sprint 拖長 | Phase 3 開頭花時間把「Hello World」跑起來再進 Story |
| Postgres 在 Windows 設定卡關 | 後端整套卡死 | 用 Docker 跑 Postgres，避免直接安裝 |
| Prisma schema 設計反覆改 | 浪費時間 | Sprint 開頭專心畫一次 ER diagram，定下 schema 再寫 code |

---

## 8. Next: Phase 3 開工

當你說「進 Phase 3」，我會：
1. 設計 Monorepo 結構（`apps/web`、`apps/api`、`packages/shared`）
2. 帶你跑 `create-next-app` 與 `fastify` 初始化
3. 設計 DB schema（doctors, services 兩張表）
4. 開第一條 Story (US-01) — 從 feature branch 開始
