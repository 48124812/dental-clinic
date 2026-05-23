# 牙醫診所官方網站 (Dental Clinic Website)

> Cloud-native learning project — 從 Design Thinking 一路走到上雲、可觀察。
>
> 對應**台大雲原生課程**講義：12-Factor App、Design Thinking、Agile、應用 / 系統架構、Deployment、Observability、CI/CD with GitHub Actions。

---

## 🎯 專案目標

打造一個**功能健全、可上雲、可觀察、可持續交付**的牙醫診所官方網站。

## 🧰 技術棧

| 層 | 技術 |
|---|---|
| Frontend | Next.js 16 (App Router, RSC) + TypeScript + Tailwind CSS 4 |
| Backend  | Fastify 5 + TypeScript + Zod |
| ORM      | Prisma 6 |
| Database | PostgreSQL 16 (Alpine) |
| Container| Docker + Docker Compose → Kubernetes (Phase 7) |
| CI/CD    | GitHub Actions (Phase 6) |
| Observability | Prometheus + Grafana + Loki (Phase 8) |

---

## 🚀 第一次跑（從 clone 開始 5 分鐘上手）

### 前置 (一次性安裝)
1. **Node.js 22+ LTS** — `winget install OpenJS.NodeJS.LTS`
2. **pnpm 10+** — `winget install pnpm.pnpm`
3. **Git** — `winget install Git.Git`
4. **Docker Desktop** — `winget install Docker.DockerDesktop`（並啟動）
5. **GitHub CLI**（選用）— `winget install GitHub.cli`

> Windows PowerShell 補設定：`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`（以管理員）

### 跑起來

```powershell
# 1. Clone
git clone https://github.com/48124812/dental-clinic.git
cd dental-clinic

# 2. 安裝 deps
pnpm install

# 3. 複製 env 範本（兩處都要）
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.local.example apps/web/.env.local

# 4. 啟動 Postgres
docker compose up -d
# 等到 status (healthy)：
docker compose ps

# 5. 跑 DB migration + seed sample data
pnpm --filter @dental-clinic/api db:migrate
pnpm --filter @dental-clinic/api db:seed

# 6. 啟動兩個 dev server（兩個 terminal）
pnpm --filter @dental-clinic/api dev   # http://localhost:3001
pnpm --filter @dental-clinic/web dev   # http://localhost:3000
```

打開 **http://localhost:3000** 看首頁。

---

## 📁 專案結構

```
dental-clinic/
├── apps/
│   ├── api/                  Fastify 後端（layered: routes / services / repositories）
│   │   ├── prisma/           schema + migrations + seed
│   │   └── src/
│   │       ├── config.ts     Zod 型別化 env config
│   │       ├── app.ts        Fastify factory
│   │       ├── server.ts     port binding + SIGTERM
│   │       ├── routes/
│   │       ├── services/
│   │       ├── repositories/
│   │       └── lib/          DB client、pure domain logic
│   └── web/                  Next.js 16 前端
│       └── src/
│           ├── app/          App Router pages
│           ├── components/
│           └── lib/          API client + helpers
├── packages/
│   └── shared/               type-only DTO 共用 package
├── docker-compose.yml        Postgres for dev
├── docs/
│   ├── LEARNING-NOTES.md     完整指令與概念筆記
│   ├── PRODUCTION-CHECKLIST.md  上線前必做事項
│   ├── adr/                  Architecture Decision Records
│   ├── 01-discovery.md       Phase 1 Design Thinking 產出
│   ├── 02-sprint-1-plan.md
│   └── 03-sprint-1-retrospective.md
└── scripts/                  PowerShell setup scripts
```

---

## ⚙️ 常用指令

### 開發
```powershell
pnpm --filter @dental-clinic/api dev      # 後端 dev (tsx watch)
pnpm --filter @dental-clinic/web dev      # 前端 dev (Next + Turbopack)
pnpm -r --parallel run dev                # 同時跑前後端
```

### 測試
```powershell
pnpm --filter @dental-clinic/api test     # 跑後端 unit tests (vitest)
pnpm --filter @dental-clinic/web test     # 跑前端 unit tests
```

### 型別 / Lint
```powershell
pnpm -r run typecheck                     # 全部 typecheck
pnpm -r run lint                          # 全部 lint
```

### DB
```powershell
pnpm --filter @dental-clinic/api db:migrate    # 套用 migration（dev）
pnpm --filter @dental-clinic/api db:seed       # 重新灌樣本資料
pnpm --filter @dental-clinic/api db:studio     # 開 Prisma Studio 看資料
pnpm --filter @dental-clinic/api db:reset      # 砍 DB 重來
```

### Production Build（驗證 build 真的能跑）
```powershell
pnpm --filter @dental-clinic/api build         # tsc -> dist/
pnpm --filter @dental-clinic/api start         # node dist/server.js
pnpm --filter @dental-clinic/web build         # next build -> .next/
pnpm --filter @dental-clinic/web start         # next start (port 3000)
```

### Docker (Postgres)
```powershell
docker compose up -d                           # 啟動 Postgres
docker compose ps                              # 看狀態
docker compose logs -f postgres                # 看 log
docker compose down                            # 停
docker compose down -v                         # 停 + 刪資料 volume
```

---

## 🔑 環境變數策略

| 檔案 | 給誰讀 | 內容 |
|------|--------|------|
| 根目錄 `.env` | Docker Compose | POSTGRES_USER, PASSWORD, DB |
| `apps/api/.env` | Node app + Prisma CLI | DATABASE_URL, PORT, LOG_LEVEL, ... |
| `apps/web/.env.local` | Next.js | NEXT_PUBLIC_API_URL |

所有 `.env*` 都 gitignored；`.env.example` / `.env.local.example` 進 Git（只有 placeholder）。

**API 啟動時用 Zod schema 強制驗證**（apps/api/src/config.ts）— 缺欄位或型別錯誤就 `process.exit(1)` 並印詳細錯誤，**不會帶著爛 config 啟動**。

---

## 📅 Phase 進度

- [x] **Phase 1**: Design Thinking — Empathy maps / User stories / AC / MVP
- [x] **Phase 2**: 專案啟動 — Repo / Branch protection / Product Backlog / Sprint 1 plan
- [x] **Phase 3**: Sprint 1 MVP — 首頁、醫師、療程、RWD (4 stories closed)
- [x] **Phase 4**: 12-Factor 強化 — Zod config / Vitest / Readiness probe / Shared types
- [ ] **Phase 5**: Containerize — Dockerfile + Compose full stack
- [ ] **Phase 6**: CI/CD with GitHub Actions
- [ ] **Phase 7**: Deploy (PaaS → VM → K8s)
- [ ] **Phase 8**: Observability (Prometheus / Grafana / Loki / SLO)

---

## 📖 延伸閱讀

- [`docs/LEARNING-NOTES.md`](docs/LEARNING-NOTES.md) — 完整指令與概念筆記（從 Phase 1 開始累積）
- [`docs/adr/`](docs/adr/) — 為什麼當初這樣決策（Architecture Decision Records）
- [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) — 真上線前的法遵 / 安全 / 監控 checklist
- [`docs/01-discovery.md`](docs/01-discovery.md) — Phase 1 設計思考產出（user stories, AC, NFRs）

---

## 📜 License

UNLICENSED — 內部學習專案，未經授權禁止商用。
