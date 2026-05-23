import type { BusinessHours } from '@prisma/client';
import * as repo from '../repositories/business-hours.repository.js';

/**
 * Service Layer (業務邏輯)
 *
 * 對應講義：NTU App Arch P.66 / P.77
 * - 「現在是否營業」這類業務規則的家
 * - 不知道 HTTP（不能 import fastify）
 * - 不直接呼叫 Prisma（要透過 repository）
 */

/** 對外暴露的「今天狀態」摘要。前端拿這個直接渲染。 */
export interface TodayStatus {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  isCurrentlyOpen: boolean;
}

export interface BusinessHoursSummary {
  today: TodayStatus;
  weekly: BusinessHours[];
}

/**
 * 取得整週時段 + 今日營業狀態。
 *
 * @param now 注入「現在時間」是為了測試 — production 預設用真實時間
 *            這就是 dependency injection 的精神（測試友善）
 */
export async function getBusinessHoursSummary(
  now: Date = new Date(),
): Promise<BusinessHoursSummary> {
  const weekly = await repo.findAllBusinessHours();
  const today = computeTodayStatus(weekly, now);
  return { today, weekly };
}

/**
 * 核心業務邏輯：根據 weekly 設定 + 當下時間，判斷現在是否在營業。
 *
 * 純函數 (pure function)：給同樣的 weekly + now，永遠回同樣結果。
 * 沒有 IO、沒有時間呼叫 → 單元測試極好寫。
 */
export function computeTodayStatus(
  weekly: BusinessHours[],
  now: Date,
): TodayStatus {
  const dayOfWeek = now.getDay(); // 0 (Sun) ~ 6 (Sat)
  const todayHours = weekly.find((h) => h.dayOfWeek === dayOfWeek);

  // DB 沒這天的資料（理論上 seed 完不會發生，但 NFR 上要 defensive）
  if (!todayHours) {
    return {
      dayOfWeek,
      isClosed: true,
      openTime: null,
      closeTime: null,
      isCurrentlyOpen: false,
    };
  }

  if (todayHours.isClosed || !todayHours.openTime || !todayHours.closeTime) {
    return {
      dayOfWeek,
      isClosed: true,
      openTime: null,
      closeTime: null,
      isCurrentlyOpen: false,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTimeToMinutes(todayHours.openTime);
  const closeMinutes = parseTimeToMinutes(todayHours.closeTime);

  return {
    dayOfWeek,
    isClosed: false,
    openTime: todayHours.openTime,
    closeTime: todayHours.closeTime,
    isCurrentlyOpen: nowMinutes >= openMinutes && nowMinutes < closeMinutes,
  };
}

/** "09:30" → 570 (= 9*60 + 30) */
function parseTimeToMinutes(time: string): number {
  const parts = time.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  return hours * 60 + minutes;
}
