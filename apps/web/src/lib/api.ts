/**
 * API client — 前端呼叫後端 Fastify API 的封裝層。
 *
 * 為什麼集中在這個檔？
 * - 之後換 base URL、加 auth header、加 retry 都只動這裡
 * - 對應 NTU App Arch P.68 Infra 層：「對外部依賴 (API) 使用的封裝」
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---------- Types ----------
// 之後可抽到 packages/shared 給 BE/FE 共用，先 inline。

export interface BusinessHoursEntry {
  id: string;
  dayOfWeek: number; // 0 (Sun) ~ 6 (Sat)
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  updatedAt: string;
}

export interface TodayStatus {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  isCurrentlyOpen: boolean;
}

export interface BusinessHoursSummary {
  today: TodayStatus;
  weekly: BusinessHoursEntry[];
}

// ---------- Fetchers ----------

export async function getBusinessHoursSummary(): Promise<BusinessHoursSummary> {
  // cache: 'no-store' 在 dev 階段避免 Next.js cache 卡住 — 每次都打 API
  // production 可改成 next: { revalidate: 60 } 之類做 ISR
  const res = await fetch(`${API_URL}/api/business-hours`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch business hours: ${res.status}`);
  }
  return res.json() as Promise<BusinessHoursSummary>;
}
