# ADR-0003: Prisma + PostgreSQL

- **Status**: Accepted
- **Date**: 2026-05-23
- **Phase**: 3.4 / 3.5

## Context
要選資料庫 + ORM。系統需求：
- 關聯式資料（醫師、療程、預約彼此有關聯）
- 中等規模（< 100 萬筆 / 年預期）
- 強型別 TS 友善 + migration 工具
- 對應 System Architecture 講義 P.46：「先以關聯式資料庫開始，除非有 NoSQL 強項問題」

## Decision
- **PostgreSQL 16** (alpine image)：跑在 Docker container
- **Prisma 6** as ORM / migration tool / type generator

## Consequences
**好處**：
- Prisma schema = 真相之源（DB schema + TS type 自動產出）
- Migration 自動產 SQL，commit 進 Git，prod deploy 用 `migrate deploy`
- TypeScript-first：`prisma.doctor.findMany({ where: {...} })` 有完整型別
- Prisma Studio = 免費 DB GUI（dev 必備）
- Postgres 原生支援 array (`String[]`)、JSONB、enum、full-text search

**壞處**：
- Prisma Client 不適合超大 schema 或極限效能場景（會有 abstraction overhead）
- 複雜 query 有時要降回 `prisma.$queryRaw\`SELECT ...\``
- Prisma migration 有時跑 dev 自動產，不完全是手寫 SQL 的 control

## Alternatives considered
- **Drizzle ORM**：更輕、更接近 SQL，但生態與工具（Studio 等）比 Prisma 弱
- **手寫 SQL + node-postgres**：最快、最 control，但 type safety 全靠手動維護
- **MySQL / MariaDB**：講義範例用 MariaDB（Deployment HW Chiu），但 PostgreSQL 在 array / JSONB / partial index 等現代功能更強
- **MongoDB / NoSQL**：違反 SysArch 講義 P.46 建議；牙醫資料模型本來就關聯式

## Revisit when
- 需要極端讀效能 → 加 read replica / cache（Redis）
- 寫 throughput > 10k/s → 評估分庫 / 改 NoSQL
- 全文搜索成主要功能 → 評估 Elasticsearch
