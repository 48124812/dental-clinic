# =============================================================================
# apps/api Dockerfile — multi-stage build for Fastify API
# =============================================================================
# 對應講義：
# - Deployment HW Chiu P.55 容器化封裝
# - 12-Factor Factor 5 (Build/Release/Run separation)
# - CI/CD P.43 image as deployment artifact
#
# Build from monorepo ROOT (not from apps/api/):
#   docker build -f apps/api/Dockerfile -t dental-clinic/api:dev .
#
# 為什麼 build context 是 repo 根目錄？
#   因為 pnpm workspace 需要 lockfile + workspace 設定才能正確 install。
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: builder
# 任務：裝 deps、跑 prisma generate、跑 tsc 編譯
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

# corepack: Node 內建的 package manager 切換器，啟用後 pnpm 自動用 root
# package.json 鎖的版本
RUN corepack enable
WORKDIR /repo

# ---- 1. 安裝 workspace deps ----
# Layer cache 最佳化：先 copy 依賴宣告檔，改 code 不會 bust install 層
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# --frozen-lockfile = 嚴格按 lockfile 裝，CI / Docker 必設
# --shamefully-hoist = 把所有 deps 拉到 root node_modules（等同 npm 行為）
#                       pnpm 10 + Docker 環境下 workspace symlink 不穩
RUN pnpm install --frozen-lockfile --shamefully-hoist

# ---- 2. 全域裝 CLI 工具 ----
# 避免 pnpm exec / npx 嘗試從不存在的 workspace symlink 找 bin。
# 全域 prisma / tsc 直接在 PATH 上、零 lookup 問題。
# 版本對齊 apps/api/package.json (prisma ^6, typescript ^5.7)。
RUN npm install -g prisma@6 typescript@5.7

# ---- 3. Copy source 並 build ----
COPY tsconfig.base.json ./
COPY apps/api ./apps/api

# Prisma generate 寫到 /repo/node_modules/.prisma/client（因為 shamefully-hoist）
RUN cd apps/api && prisma generate

# tsc 編譯 src/*.ts → apps/api/dist/*.js
RUN tsc -p apps/api/tsconfig.json


# -----------------------------------------------------------------------------
# Stage 2: runtime
# 任務：只跑編譯後的 JS，image 越小越好
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime

# Prisma 需要 OpenSSL 在 runtime 時提供加密功能
RUN apk add --no-cache openssl

WORKDIR /app

# 從 builder 複製：
#   - hoisted node_modules（含 prisma generate 產的 .prisma/client）
#   - apps/api 的 dist + prisma schema (Prisma engine runtime 會讀)
#   - package.json (Node 看 "type": "module")
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/package.json ./apps/api/
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/prisma ./apps/api/prisma

# 安全性：不要用 root 跑 app（node:alpine 自帶 node user, uid 1000）
USER node

WORKDIR /app/apps/api
ENV NODE_ENV=production

# Documentation only — 真正 expose 由 docker run -p 或 compose 決定
EXPOSE 3001

# 對應 Observability P.99：K8s readinessProbe 會打這個 endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# 直接跑編譯後的 JS — 不走 pnpm/npm script（container 的 env 由 docker 注入）
CMD ["node", "dist/server.js"]
