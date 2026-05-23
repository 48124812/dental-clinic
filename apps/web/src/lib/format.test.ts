import { describe, it, expect } from 'vitest';
import {
  categoryLabel,
  priceLabel,
  dayName,
  formatHourRange,
} from './format';

describe('dayName', () => {
  it('maps 0-6 to 週日-週六', () => {
    expect(dayName(0)).toBe('週日');
    expect(dayName(1)).toBe('週一');
    expect(dayName(2)).toBe('週二');
    expect(dayName(3)).toBe('週三');
    expect(dayName(4)).toBe('週四');
    expect(dayName(5)).toBe('週五');
    expect(dayName(6)).toBe('週六');
  });

  it('returns empty string for out-of-range', () => {
    expect(dayName(7)).toBe('');
    expect(dayName(-1)).toBe('');
  });
});

describe('formatHourRange', () => {
  it('formats valid open/close time', () => {
    expect(formatHourRange('09:00', '17:00')).toBe('09:00 – 17:00');
  });

  it('returns "休診" when either is null', () => {
    expect(formatHourRange(null, '17:00')).toBe('休診');
    expect(formatHourRange('09:00', null)).toBe('休診');
    expect(formatHourRange(null, null)).toBe('休診');
  });
});

describe('categoryLabel', () => {
  it('maps every ServiceCategory to a Chinese label', () => {
    expect(categoryLabel('PREVENTIVE')).toBe('預防保健');
    expect(categoryLabel('RESTORATIVE')).toBe('修復重建');
    expect(categoryLabel('COSMETIC')).toBe('美學牙科');
    expect(categoryLabel('ORTHODONTIC')).toBe('齒列矯正');
    expect(categoryLabel('SURGERY')).toBe('口腔外科');
    expect(categoryLabel('PEDIATRIC')).toBe('兒童牙科');
  });
});

describe('priceLabel', () => {
  it('formats min-only (max=null) as "NT$ X 起"', () => {
    expect(priceLabel(50000, null)).toBe('NT$ 50,000 起');
  });

  it('formats equal min/max as single price', () => {
    expect(priceLabel(1500, 1500)).toBe('NT$ 1,500');
  });

  it('formats range with em-dash', () => {
    expect(priceLabel(1500, 8000)).toBe('NT$ 1,500 – 8,000');
  });

  it('handles zero min', () => {
    expect(priceLabel(0, 300)).toBe('NT$ 0 – 300');
  });

  it('handles large numbers with thousands separator', () => {
    expect(priceLabel(150000, 280000)).toBe('NT$ 150,000 – 280,000');
  });
});
