import { describe, it, expect } from 'vitest';
import type { BusinessHours } from '@prisma/client';
import { computeTodayStatus, parseTimeToMinutes } from './business-hours.js';

/**
 * 對應 12-Factor SDLC P.61 test pyramid 的最底層：
 * pure function 的 unit test，跑得最快、最穩、寫得最容易。
 */

/** Helper：產一筆模擬的 BusinessHours row */
function mkRow(
  dayOfWeek: number,
  isClosed: boolean,
  openTime: string | null,
  closeTime: string | null,
): BusinessHours {
  return {
    id: `mock-${dayOfWeek}`,
    dayOfWeek,
    isClosed,
    openTime,
    closeTime,
    updatedAt: new Date('2026-01-01'),
  };
}

/** Seed 模板：週日休、週一~五 9-21、週六 9-17（與真實 seed 一致） */
const SAMPLE_WEEKLY: BusinessHours[] = [
  mkRow(0, true, null, null),
  mkRow(1, false, '09:00', '21:00'),
  mkRow(2, false, '09:00', '21:00'),
  mkRow(3, false, '09:00', '21:00'),
  mkRow(4, false, '09:00', '21:00'),
  mkRow(5, false, '09:00', '21:00'),
  mkRow(6, false, '09:00', '17:00'),
];

describe('parseTimeToMinutes', () => {
  it('parses "HH:MM" into minutes since midnight', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('09:30')).toBe(9 * 60 + 30);
    expect(parseTimeToMinutes('17:00')).toBe(17 * 60);
    expect(parseTimeToMinutes('23:59')).toBe(23 * 60 + 59);
  });
});

describe('computeTodayStatus', () => {
  // ----- Open hours cases (Monday 9-21) -----

  it('marks isCurrentlyOpen=true when now is within today hours', () => {
    // 2026-05-25 是週一 (Mon)，10:00 local
    const now = new Date(2026, 4, 25, 10, 0); // month is 0-indexed
    const result = computeTodayStatus(SAMPLE_WEEKLY, now);
    expect(result.isClosed).toBe(false);
    expect(result.isCurrentlyOpen).toBe(true);
    expect(result.openTime).toBe('09:00');
    expect(result.closeTime).toBe('21:00');
  });

  it('marks isCurrentlyOpen=false before opening (still listed as open day)', () => {
    const now = new Date(2026, 4, 25, 8, 0); // Mon 8:00 — 9 點才開
    const result = computeTodayStatus(SAMPLE_WEEKLY, now);
    expect(result.isClosed).toBe(false);
    expect(result.isCurrentlyOpen).toBe(false);
  });

  it('marks isCurrentlyOpen=false at exact closing time (closed-time-exclusive)', () => {
    const now = new Date(2026, 4, 25, 21, 0); // Mon 21:00 整點 = 已關
    const result = computeTodayStatus(SAMPLE_WEEKLY, now);
    expect(result.isCurrentlyOpen).toBe(false);
  });

  it('marks isCurrentlyOpen=true at exact opening time (open-time-inclusive)', () => {
    const now = new Date(2026, 4, 25, 9, 0); // Mon 09:00 整點 = 開
    const result = computeTodayStatus(SAMPLE_WEEKLY, now);
    expect(result.isCurrentlyOpen).toBe(true);
  });

  // ----- Closed day cases (Sunday) -----

  it('returns isClosed=true on closed day (Sunday)', () => {
    const now = new Date(2026, 4, 24, 10, 0); // Sun 10:00
    const result = computeTodayStatus(SAMPLE_WEEKLY, now);
    expect(result.isClosed).toBe(true);
    expect(result.isCurrentlyOpen).toBe(false);
    expect(result.openTime).toBeNull();
    expect(result.closeTime).toBeNull();
  });

  // ----- Defensive cases (missing data) -----

  it('returns isClosed=true when weekly has no entry for today', () => {
    const now = new Date(2026, 4, 25, 10, 0);
    const result = computeTodayStatus([], now);
    expect(result.isClosed).toBe(true);
  });

  it('returns isClosed=true when day row has null open/close times', () => {
    const broken: BusinessHours[] = [mkRow(1, false, null, null)];
    const now = new Date(2026, 4, 25, 10, 0); // Mon
    const result = computeTodayStatus(broken, now);
    expect(result.isClosed).toBe(true);
    expect(result.isCurrentlyOpen).toBe(false);
  });

  // ----- dayOfWeek 計算 -----

  it('returns correct dayOfWeek for Saturday (9-17 schedule)', () => {
    const now = new Date(2026, 4, 23, 12, 0); // Sat 12:00
    const result = computeTodayStatus(SAMPLE_WEEKLY, now);
    expect(result.dayOfWeek).toBe(6);
    expect(result.openTime).toBe('09:00');
    expect(result.closeTime).toBe('17:00');
    expect(result.isCurrentlyOpen).toBe(true);
  });
});
