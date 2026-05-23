# ADR-0005: Zod for env config validation (fail-fast)

- **Status**: Accepted
- **Date**: 2026-05-24
- **Phase**: 4.1

## Context
之前的做法：散落各檔的 `process.env.PORT ?? '3001'`、`process.env.DATABASE_URL`。三個問題：
1. **沒型別**：永遠是 `string | undefined`
2. **沒驗證**：prod 忘設 `DATABASE_URL` → app 還是啟動，跑到第一個 query 才炸
3. **沒文件**：要 grep 整個 codebase 才知道有哪些 env

對應 12-Factor Factor 3 (Config) + 12-Factor SDLC P.74 review checklist「Config/secrets externalized」。

## Decision
單一 `apps/api/src/config.ts` 用 Zod schema parse `process.env` 一次，產出 typed `config` object。任何欄位缺失或無效 → `process.exit(1)` + 印詳細錯誤。其他所有檔案禁止讀 `process.env`，改 import `config`。

## Consequences
**好處**：
- TypeScript 知道型別（`config.PORT: number`，不用每次 `Number()`）
- 缺欄位 → app 啟動就掛 + K8s 自動 restart + 紅燈
- 完整 env 文件就在 schema 裡（self-documenting）
- 「跑了 30 秒才在第一個 request 炸」的詭異情境消失

**壞處**：
- 多一個 dep (zod) — 但同時可以用在 future 的 API request validation
- 啟動時多 ~10ms parse 時間（可忽略）

## Alternatives considered
- **dotenv only**：只載入 env，不驗證。被本 ADR 取代
- **`envalid` / `env-var` library**：類似 Zod 但功能比較窄
- **lazy parse (per-call validate)**：違反 fail-fast 精神
- **直接讀 `process.env`**：被本 ADR 取代

## Revisit when
- 多 service 共用 config schema → 抽到 `packages/shared`
- 加複雜的 secret rotation → 改用 Vault / AWS Secrets Manager runtime fetch
