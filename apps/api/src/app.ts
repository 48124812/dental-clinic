import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { businessHoursRoutes } from './routes/business-hours.js';

/**
 * App factory.
 *
 * 為什麼用 factory 而不是 module 層級的 singleton？
 * - 測試時可以 buildApp() 拿到全新 instance，互不影響
 * - 對應 12-Factor Factor 6 (P.32): processes stateless, share-nothing
 * - server.ts 才是綁 port 的地方；app.ts 是「邏輯本體」，可以單獨被 .inject() 測試
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    // 對應 12-Factor Factor 11 (P.38): logs as event streams
    // Fastify 預設用 pino，已是 JSON 結構化 log + 寫到 stdout，符合 cloud-native 標準
  });

  // CORS — 允許前端 (localhost:3000) 跨網域呼叫 API (localhost:3001)
  // 對應講義：System Architecture 安全性段落
  // production 會收緊白名單，dev 先寬鬆
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // 註冊路由
  await app.register(healthRoutes);
  await app.register(businessHoursRoutes);

  return app;
}
