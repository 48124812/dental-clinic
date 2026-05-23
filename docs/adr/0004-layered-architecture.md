# ADR-0004: Route / Service / Repository layered architecture

- **Status**: Accepted
- **Date**: 2026-05-23
- **Phase**: 3.6

## Context
Fastify 預設讓你把所有東西寫在 route handler 裡：parse 參數、查 DB、組 response 全部一塊。短期最快，但隨著功能變多會變不可測、難以替換 ORM、容易違反 single responsibility。

對應 NTU App Arch 講義 P.64–68 強調的「分層架構」與責任分離。

## Decision
每個業務領域 (doctors, services, business-hours, ...) 拆三層：

```
routes/<X>.ts        ── HTTP I/O 層 (Controller)
services/<X>.ts      ── 業務邏輯 (Application Service)
repositories/<X>.ts  ── DB 操作 (DAO / Repository)
```

**依賴方向只能上往下**：
- routes 只 import services（不能直接 import prisma）
- services 只 import repositories（不能直接 import prisma 或 fastify）
- repositories 是唯一直接呼叫 prisma 的地方

**Pure domain logic** 抽到 `lib/<X>.ts`（例：`computeTodayStatus`），方便單測。

## Consequences
**好處**：
- Service 可以 mock repo 來測，不開 DB 也能驗業務邏輯
- 換 ORM 只動 repository
- Route 只關心 HTTP（status codes、headers），code 短且清楚
- Pure lib functions 跑得最快、最穩、單元測試友善

**壞處**：
- 簡單 CRUD 看起來 over-engineered（一條 SELECT 要寫三層）
- 命名衝突（`services/services.service.ts` 疊字）
- 新人看到「為什麼不能直接從 route 呼 prisma」需要解釋

## Alternatives considered
- **Route handler 內全包**（Fastify 預設）：開發快但難測，違反 SRP，遲早重構
- **Hexagonal / Clean Architecture (Uncle Bob)**：嚴格的 ports & adapters，學習曲線陡，對中小專案 overkill
- **Function-style services（沒有 class）**：我們已經用這個。比 OOP class 簡單，無 DI container 也能 mock。

## Revisit when
- 引入跨領域 transaction → 可能需要 Unit-of-Work pattern
- 加 multiple data sources（Redis、Elasticsearch）→ repository 抽 interface
- 微服務拆分 → 每個服務變成獨立的「上下文」(DDD bounded context)
