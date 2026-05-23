# Architecture Decision Records (ADR)

> 對應 12-Factor SDLC P.51：「Managed architectural decision record (ADR)」。
>
> 每個 ADR 是一個「決策快照」 — 為什麼當初這樣選、考慮過什麼別的方案、什麼時候要重新考慮。

## 規則

1. **只能新增，不修改舊的**。決策變了 → 開新 ADR，標明 `Supersedes ADR-NNNN`。
2. **記決策、不記實作細節**。實作細節看 code，ADR 看 why。
3. **編號遞增**（0001, 0002, ...），名字 kebab-case。
4. 每篇 ≤ 1 頁，**簡短易讀**。

## 模板

```markdown
# ADR-NNNN: 標題

- **Status**: Accepted | Superseded | Deprecated
- **Date**: YYYY-MM-DD
- **Phase**: 哪個 Phase 決定的

## Context（脈絡）
為什麼這個決定需要做？當下面對什麼問題？

## Decision（決定）
我們選了什麼。

## Consequences（後果）
帶來什麼好處 / 壞處 / 取捨。

## Alternatives considered（其他選項）
評估過什麼別的、為什麼沒選。

## Revisit when（什麼時候要重新考慮）
什麼變化會讓這個決定不再適用。
```

## 現有 ADR

- [ADR-0001](./0001-monorepo-pnpm.md) — Monorepo with pnpm workspaces
- [ADR-0002](./0002-nextjs-fastify-stack.md) — Next.js (App Router) + Fastify split (vs full-stack Next.js)
- [ADR-0003](./0003-prisma-postgres.md) — Prisma + PostgreSQL (vs other ORMs / DBs)
- [ADR-0004](./0004-layered-architecture.md) — Route / Service / Repository layered architecture
- [ADR-0005](./0005-zod-config-validation.md) — Zod for env config validation
- [ADR-0006](./0006-shared-types-package.md) — Type-only `packages/shared` for FE/BE
- [ADR-0007](./0007-liveness-vs-readiness.md) — Split `/health` and `/ready` for K8s probes
