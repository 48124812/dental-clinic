import type { FastifyInstance } from 'fastify';

/**
 * 健康檢查 (Liveness) Endpoint.
 *
 * 對應講義：
 * - Observability P.99–103: Health check 是 K8s liveness/readiness probe 基礎
 * - 12-Factor SDLC P.63: "Do we know what 'healthy' means?"
 *
 * 設計原則（重要！）：
 * - 不要查 DB / 第三方 API —— 那是 readiness probe 的工作
 * - liveness 只回答「process 還活著嗎」
 * - 失敗 = K8s 會 kill 你重啟，所以失敗條件要極度保守
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION ?? 'dev',
  }));
}
