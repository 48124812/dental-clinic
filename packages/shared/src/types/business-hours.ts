/**
 * BusinessHours DTOs — 營業時間相關。
 */

export interface BusinessHoursEntry {
  id: string;
  dayOfWeek: number; // 0 (Sun) ~ 6 (Sat)
  isClosed: boolean;
  openTime: string | null; // "HH:MM"
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
