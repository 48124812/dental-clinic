import type { FastifyInstance } from 'fastify';
import * as service from '../services/business-hours.service.js';

/**
 * Route Layer (HTTP 入出)
 *
 * 對應講義：NTU App Arch P.65 展示層
 * - 解析 HTTP request、組合 HTTP response
 * - 不直接呼叫 Prisma、不寫業務規則
 * - 失敗只負責 map 成正確的 HTTP status code
 */

export async function businessHoursRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/business-hours
   * 回傳整週時段 + 今日營業狀態（給首頁用）
   */
  app.get('/api/business-hours', async () => {
    return service.getBusinessHoursSummary();
  });
}
