# ADR-0006: Type-only `packages/shared` for FE/BE wire-format types

- **Status**: Accepted
- **Date**: 2026-05-24
- **Phase**: 4.4

## Context
Sprint 1 結束時 FE 與 BE 各維護一份 Doctor / Service interface。問題：
- BE 加欄位 / 改型別 → FE 不知道 → runtime 才炸
- 真相之源不明確（兩邊都覺得自己對）

## Decision
新建 `packages/shared` workspace package：
- **Type-only**：沒有 runtime code、沒 framework dep
- 內含 DTO (Data Transfer Object) — 反映「網路傳輸 (JSON) 後的形狀」，不是 DB row 形狀（例：Date 寫成 `string` 因為 JSON serialize 後是 ISO 字串）
- `apps/web` import 並 re-export 給內部 components
- `apps/api` 暫時不 import（仍用 Prisma 型別 + 信任 JSON serialization）— 未來加 response schema validation 時再要求

## Consequences
**好處**：
- 單一真相之源
- Type-only 不引入 runtime 依賴衝突（Next / Fastify / Vitest 都能 import）
- FE component 改 `import` 路徑無痛（lib/api 重新 re-export 維持 backward compat）

**壞處**：
- BE 沒強制使用 → 仍可能單邊改型別。需 PR review 注意
- 多一個 package 要管（但這正是 monorepo 該做的）

## Alternatives considered
- **複製貼上 type**：當前痛點，被本 ADR 取代
- **從 Prisma 自動產 type 給 FE**：Prisma 型別有 Date 物件 / generated client、不適合跨 framework 共用
- **OpenAPI schema 生成**：未來可加（Phase 6+），目前 overkill
- **tRPC**：好工具但綁定 framework，與 Fastify + Next 分離架構衝突

## Revisit when
- BE 多次出現「FE 跟 schema 不一致」bug → 強制 BE 加 response 型別 + Zod runtime validation
- 加 mobile app（用 OpenAPI 自動產 type 比較通用）
