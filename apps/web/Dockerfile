# =============================================================================
# apps/web Dockerfile — multi-stage build for Next.js 16 frontend
# =============================================================================
# 對應講義：
# - Deployment HW Chiu P.55 容器化封裝
# - 12-Factor Factor 5 (Build/Release/Run separation)
#
# Build from monorepo ROOT:
#   docker build -f apps/web/Dockerfile -t dental-clinic/web:dev .
#
# 配 NEXT_PUBLIC_API_URL build-arg：
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=http://api:3001 \
#     -t dental-clinic/web:dev .
#
# 為什麼是 build-arg 而不是 env？
#   NEXT_PUBLIC_* 變數會被「烤」進 client-side bundle 中 (build-time)，
#   而不是 runtime 讀 env。所以必須在 docker build 時就提供。
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: builder
# 任務：跑 next build，產出 .next/standalone 等
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

# ---- 1. workspace 依賴宣告（layer cache 最佳化） ----
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# shamefully-hoist 同 api Dockerfile 的原因
RUN pnpm install --frozen-lockfile --shamefully-hoist

# ---- 2. (略過全域裝，直接用 shamefully-hoist 裝在 /repo/node_modules 的 next) ----
# 全域裝 (npm install -g) 的 next 無法解析 workspace 內的 peer deps，
# 會出現 /_global-error prerender 的 workStore bug。
# 改用 pnpm install 裝好的 next，透過絕對路徑直接呼叫。

# ---- 3. Copy source — web 需要 shared 但不需要 api ----
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# ---- 4. NEXT_PUBLIC_* 是 build-time 烤進 client bundle 的 ----
# 預設指向 http://api:3001（之後 docker-compose 環境）
# 單機測試時可以 build 時覆寫
ARG NEXT_PUBLIC_API_URL=http://api:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# ---- 5. Build ----
# 直接呼叫 shamefully-hoist 後的 next CLI（路徑可靠、不依賴 PATH 或 .bin symlink）
# 對比之下 `npm install -g next` 全域裝會找不到 workspace 內的 peer deps
RUN cd apps/web && node /repo/node_modules/next/dist/bin/next build


# -----------------------------------------------------------------------------
# Stage 2: runtime
# 任務：跑 standalone server，image 越小越好
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Next.js 13+ standalone 輸出結構（with outputFileTracingRoot 設到 monorepo 根）：
#   .next/standalone/
#     apps/web/
#       server.js          ← 入口
#       package.json
#       .next/             ← compiled pages
#     node_modules/        ← 最小化、只必要的 dep
#     package.json
#
# 我們從 builder 把整個 standalone copy 過來；另外 .next/static 與 public
# 不在 standalone 內，需要單獨補上。
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

USER node

WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js 預設聽 3000，HOSTNAME 設 0.0.0.0 才能在 container 外連到
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
