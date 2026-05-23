# ADR-0002: Next.js (App Router) + Fastify split

- **Status**: Accepted
- **Date**: 2026-05-23
- **Phase**: 3.2 / 3.3

## Context
診所官網要 SEO 友善（病患 google「附近牙醫」找上門）+ 有線上預約 / 後台 CRUD（state-ful API）。要決定：用什麼 framework 來做前端與後端？

## Decision
**FE/BE 分離**：
- 前端：**Next.js 16 App Router** + React 19 + Tailwind 4
- 後端：**Fastify 5** + TypeScript + Prisma

Server Components 預設，需要互動的局部 (`useState`、`onClick`) 才轉 Client Component。

## Consequences
**好處**：
- Next.js Server Components / SSR → SEO 完整（爬蟲拿到 HTML 帶資料）
- Fastify 高效能、TypeScript first、`.inject()` 機制適合測試
- 全 TypeScript → 共用 type（Phase 4.4 packages/shared）
- 對應 Deployment 講義 Model 2「前後端拆分」

**壞處**：
- 比「Next.js full-stack route handlers」多一個服務要部署
- CORS 設定（前端 3000 打後端 3001）
- 兩個 framework 要學

## Alternatives considered
- **Next.js full-stack（API routes / server actions）**：簡單，少一個服務。但業務邏輯混在 framework code 裡，難以單獨測試 / 之後 mobile app 共用 API
- **Spring Boot + React**：業界主流（NTU App Arch 講義範例），但 Java 學習成本高、AI 整合生態 (LLM SDK) 弱於 Node
- **Python FastAPI + React**：可行，AI 整合好，但跨語言 type 共用麻煩 (要 OpenAPI 生成)

## Revisit when
- 加 mobile app（共用 API 更值得）
- 後端負載暴增需用 Go / Rust 重寫某些 service
- LLM 整合大幅增加 → 評估改 Python 部分服務
