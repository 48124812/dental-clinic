import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

/**
 * 健康檢查 endpoints — 給 K8s probe / load balancer / uptime monitor 用。
 *
 * 對應講義：
 * - Observability P.99–103 lifecycle / service discovery
 * - CI/CD P.41 health check
 *
 * 設計準則（重要！）：
 * - /health (liveness) ≠ /ready (readiness)
 * - 失敗時要回 **503**（Service Unavailable），不是 500（伺服器錯誤）
 *   - 503 = 「我暫時不行，請晚點 retry」→ LB 會自動避開
 *   - 500 = 「我壞了」→ 通常不 retry
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Liveness probe — 我這個 process 還活著嗎？
   *
   * K8s 用法：每 N 秒打一次，失敗 → 整個 pod 重啟。
   * 因此這裡 **絕對不要查 DB / 第三方 API**，否則一個外部依賴掛了就整批 pod 被殺。
   * 唯一會失敗的情境：process 卡死（event loop blocked）連 HTTP 都回不了。
   */
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.APP_VERSION,
  }));

  /**
   * Readiness probe — 我準備好接 traffic 了嗎？
   *
   * K8s 用法：失敗 → 從 service endpoint 暫時移除（不重啟）。
   * 適合放：DB 連線測試、cache 熱機檢查、重要的 downstream API ping。
   * 限制：必須**快**（< 1s），不能在這裡跑昂貴查詢。
   */
  app.get('/ready', async (_req, reply) => {
    const checks = {
      db: await checkDatabase(),
    };

    const ok = Object.values(checks).every((c) => c.ok);
    if (!ok) reply.code(503);

    return {
      status: ok ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  });
}

/**
 * DB 連線檢查 — `SELECT 1` 是業界慣用的「最便宜的 round-trip」。
 * 用 tagged template (`$queryRaw\`...\``) 避免 SQL injection 風險（雖然這條 SQL 無輸入也沒事）。
 */
async function checkDatabase(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
