# 牙醫診所官方網站 (Dental Clinic Website)

> 雲原生課程實作專案 — 從 Design Thinking 一路走到上雲、可觀察。

## 🎯 專案目標

打造一個**功能健全、可上雲、可觀察、可持續交付**的牙醫診所官方網站，並在過程中學會：
- Design Thinking：以使用者為中心定義需求
- Agile：用 Scrum 概念把工作切成可交付的 increment
- 應用 / 系統架構：分層架構、HA、Load Balancer、Cache
- 12-Factor App：寫出 cloud-native 友善的 service
- Container & Kubernetes：把 app 打包、跑在叢集上
- CI/CD：用 GitHub Actions 自動驗證、build、部署
- Observability：Log / Metric / Trace、SLO/SLA

## 📁 專案結構（會隨著 Phase 推進演變）

```
dental-clinic/
├── docs/                  # 規劃文件（Empathy Map、User Story、ADR 等）
│   └── 01-discovery.md    # Phase 1 產出
├── apps/                  # 之後會放 frontend / backend
└── README.md
```

## 📅 Phase 進度

- [x] **Phase 1**: Design Thinking — 找出使用者與需求
- [x] **Phase 2**: 專案啟動 — Repo / Backlog / Git 流程
- [ ] **Phase 3**: MVP 開發 — 分層架構、後端 API、前端頁面 ← 下一個
- [ ] **Phase 4**: 12-Factor 化 — Config 外部化、Stateless、Logs to stdout
- [ ] **Phase 5**: 容器化 — Dockerfile、Docker Compose
- [ ] **Phase 6**: CI/CD — GitHub Actions、Branch 策略
- [ ] **Phase 7**: 上雲 — PaaS → VM+Docker → Kubernetes
- [ ] **Phase 8**: Observability — Health check、Metrics、SLO

## 🧰 技術棧

| 層 | 技術 |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | Fastify + TypeScript + Zod |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Container | Docker + Docker Compose → Kubernetes |
| CI/CD | GitHub Actions |
| Observability | Prometheus + Grafana + Loki (PLG stack) |
