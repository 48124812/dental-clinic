/**
 * 共用格式化 helper。Pure functions、可單獨測試。
 */

const DAY_NAMES_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES_ZH[dayOfWeek] ?? '';
}

/** "09:00" + "17:00" → "09:00 – 17:00" */
export function formatHourRange(
  openTime: string | null,
  closeTime: string | null,
): string {
  if (!openTime || !closeTime) return '休診';
  return `${openTime} – ${closeTime}`;
}
