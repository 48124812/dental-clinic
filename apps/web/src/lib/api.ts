/**
 * API client — 前端呼叫後端 Fastify API 的封裝層。
 *
 * 為什麼集中在這個檔？
 * - 之後換 base URL、加 auth header、加 retry 都只動這裡
 * - 對應 NTU App Arch P.68 Infra 層：「對外部依賴 (API) 使用的封裝」
 *
 * Type definitions 統一在 @dental-clinic/shared，這裡只 re-export 以維持
 * 既有 component 的 `import type { Doctor } from '@/lib/api'` 寫法相容。
 */

import type {
  BusinessHoursEntry,
  BusinessHoursSummary,
  TodayStatus,
  Doctor,
  Service,
  ServiceCategory,
} from '@dental-clinic/shared';

// Re-export 給 component 用（避免大規模改 import 路徑）
export type {
  BusinessHoursEntry,
  BusinessHoursSummary,
  TodayStatus,
  Doctor,
  Service,
  ServiceCategory,
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

export async function listServices(): Promise<Service[]> {
  const res = await fetch(`${API_URL}/api/services`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch services: ${res.status}`);
  }
  return res.json() as Promise<Service[]>;
}

export async function listDoctors(): Promise<Doctor[]> {
  const res = await fetch(`${API_URL}/api/doctors`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch doctors: ${res.status}`);
  }
  return res.json() as Promise<Doctor[]>;
}

/** 找不到回 null（不 throw），讓 caller 用 notFound() 處理 */
export async function getDoctorById(id: string): Promise<Doctor | null> {
  const res = await fetch(`${API_URL}/api/doctors/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch doctor ${id}: ${res.status}`);
  }
  return res.json() as Promise<Doctor>;
}
