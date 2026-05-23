# ADR-0001: Monorepo with pnpm workspaces

- **Status**: Accepted
- **Date**: 2026-05-23
- **Phase**: 3.1

## Context
這個專案有前端 (Next.js) + 後端 (Fastify) + 將來會有共用 type / utility。需要決定：一個 repo 還是多個 repo？用什麼工具管理跨 package 依賴？

## Decision
單一 monorepo + **pnpm workspaces**。結構：
```
dental-clinic/
├── apps/{api,web}/
└── packages/{shared,...}/
```

## Consequences
**好處**：
- 一個 PR 同時改 FE + BE，diff 在同一處 review
- 共用 type / utility 透過 `workspace:*` 直接連結，改一邊兩邊立刻看到
- pnpm 同 package 全機共享一份（symlink），比 npm/yarn 省 70% 空間
- 一個 lockfile (`pnpm-lock.yaml`) → 整個 stack 版本一致

**壞處**：
- 學習曲線（filter syntax `--filter @dental-clinic/api`）
- CI 要學會「只跑改動到的 package 的 test」（Phase 6 處理）
- Repo 變大；clone 時間 / size 增加

## Alternatives considered
- **Polyrepo (兩個 GitHub repo)**：FE/BE 完全獨立。問題：共用 type 用 npm publish 太重；跨 repo PR 需要協調；不是教學重點。
- **npm / yarn workspaces**：可行但 pnpm symlink 機制更省空間、安裝更快、避免 phantom dependency。

## Revisit when
- Repo 變 > 100k LOC，CI 變慢到無法忍受 → 考慮 nx / turbo 加快增量 build
- 加入新團隊成員想用獨立 release cadence per app → 考慮拆 repo
