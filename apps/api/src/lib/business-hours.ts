import type { BusinessHours } from '@prisma/client';

/**
 * Pure domain logic for business hours.
 *
 * 為什麼這檔案要與 service.ts 分開：
 *   - 純函數（no IO、no DB、no 時鐘）
 *   - 可被單元測試直接 import，不會連帶把 prisma / config 拉進來
 *   - 對應 NTU App Arch P.77：domain layer 內容應該「穩定、不依賴外部」
 *
 * Service 層 (business-hours.service.ts) 只負責「fetch from repo + 呼叫這裡的 pure function」。
 */

export interface TodayStatus {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  isCurrentlyOpen: boolean;
}

/**
 * 根據 weekly 設定 + 當下時間，判斷現在是否在營業。
 *
 * Pure function：給同樣 (weekly, now) 永遠回同樣結果，方便測試。
 * `now` 用 Date 物件而非內部 `new Date()` 呼叫 → 測試時可注入任意時間。
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
export function parseTimeToMinutes(time: string): number {
  const parts = time.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  return hours * 60 + minutes;
}
