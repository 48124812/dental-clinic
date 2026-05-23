import type { BusinessHours } from '@prisma/client';
import * as repo from '../repositories/business-hours.repository.js';
import {
  computeTodayStatus,
  type TodayStatus,
} from '../lib/business-hours.js';

/**
 * Service Layer (應用邏輯 / Application Service)
 *
 * 對應講義：NTU App Arch P.66 / P.77
 * - 協調 repository (IO) + domain logic (pure)
 * - 不直接 import prisma
 * - 不知道 HTTP
 *
 * Pure computeTodayStatus 已搬到 lib/business-hours.ts，方便單獨測試。
 */

// 對外 re-export 型別，避免 caller 同時要 import 兩個地方
export type { TodayStatus };

export interface BusinessHoursSummary {
  today: TodayStatus;
  weekly: BusinessHours[];
}

export async function getBusinessHoursSummary(
  now: Date = new Date(),
): Promise<BusinessHoursSummary> {
  const weekly = await repo.findAllBusinessHours();
  const today = computeTodayStatus(weekly, now);
  return { today, weekly };
}

// 對外 re-export，背向相容（路由如果之前 import 過 computeTodayStatus 不會壞）
export { computeTodayStatus };
