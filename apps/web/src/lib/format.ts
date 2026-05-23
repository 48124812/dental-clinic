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

// ---------- Service helpers ----------

import type { ServiceCategory } from './api';

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  PREVENTIVE: '預防保健',
  RESTORATIVE: '修復重建',
  COSMETIC: '美學牙科',
  ORTHODONTIC: '齒列矯正',
  SURGERY: '口腔外科',
  PEDIATRIC: '兒童牙科',
};

export function categoryLabel(cat: ServiceCategory): string {
  return CATEGORY_LABEL[cat] ?? cat;
}

/** 顯示用的金額格式：3 位逗點分隔 (1,500) */
function formatNTD(n: number): string {
  return n.toLocaleString('zh-TW');
}

/**
 * 把 (priceMin, priceMax) 變成人看的字串。
 * - max null  → "NT$ 1,500 起"
 * - min===max → "NT$ 1,500"
 * - 其他      → "NT$ 1,500 – 8,000"
 */
export function priceLabel(min: number, max: number | null): string {
  if (max === null) return `NT$ ${formatNTD(min)} 起`;
  if (min === max) return `NT$ ${formatNTD(min)}`;
  return `NT$ ${formatNTD(min)} – ${formatNTD(max)}`;
}
