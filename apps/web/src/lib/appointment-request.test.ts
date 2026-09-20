import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAppointment } from './appointment-request';

afterEach(() => vi.unstubAllGlobals());

describe('appointment request feedback', () => {
  it('returns successful data without resubmitting', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'BOOKED' }, { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(requestAppointment('/test', 'book', { method: 'POST' })).resolves.toEqual({ status: 'BOOKED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    [409, 'book', '此時段已被預約'],
    [404, 'lookup', '查無預約'],
    [400, 'book', '資料格式不正確'],
    [400, 'cancel', '不足 24 小時'],
    [500, 'cancel', '請稍候再查詢預約狀態'],
  ] as const)('maps %i for %s without exposing response details', async (status, operation, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'SYNTHETIC_INTERNAL_DETAIL' }, { status })));
    await expect(requestAppointment('/test', operation)).rejects.toThrow(message);
  });

  it('does not expose network errors or retry an ambiguous booking', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('SYNTHETIC_INTERNAL_DETAIL'));
    vi.stubGlobal('fetch', fetcher);
    await expect(requestAppointment('/test', 'book', { method: 'POST' })).rejects.toThrow('請勿重複送出');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('handles an HTML startup response without exposing its body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>SYNTHETIC_INTERNAL_DETAIL</html>')));
    await expect(requestAppointment('/test', 'lookup')).rejects.toThrow('服務可能正在啟動');
  });

  it('reports a timeout as unknown cancellation outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('SYNTHETIC_INTERNAL_DETAIL', 'TimeoutError')));
    await expect(requestAppointment('/test', 'cancel')).rejects.toThrow('暫時無法確認取消結果');
  });
});
