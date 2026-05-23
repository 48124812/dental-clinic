import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton.
 *
 * 為什麼是 singleton？
 * - PrismaClient 內部有 connection pool；每次 new 一個會多開連線、最終把 DB 弄死
 * - 整個 process 共享一個 instance，比照「Database session per process」
 *
 * 對應講義：
 * - NTU App Arch P.67 Repository / 持久化層的「資源管理」
 * - 12-Factor Factor 4 (P.28): backing services 用連線池統一管理
 */
export const prisma = new PrismaClient({
  log:
    process.env.LOG_LEVEL === 'debug'
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
});
