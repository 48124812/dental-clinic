type Operation = 'book' | 'lookup' | 'cancel';

class AppointmentRequestError extends Error {}

const unavailable: Record<Operation, string> = {
  book: '暫時無法確認預約結果，服務可能正在啟動或連線中斷。請勿重複送出；若已取得預約編號，請先查詢。若沒有編號，請稍後確認原時段是否仍可預約。',
  lookup: '暫時無法查詢，服務可能正在啟動或連線中斷。請稍候約一分鐘再試。',
  cancel: '暫時無法確認取消結果，請稍候再查詢預約狀態，確認後再操作。',
};

// Never display raw provider responses, network exceptions, or database errors.
// Do not automatically retry writes: the server might already have committed.
export async function requestAppointment<T>(url: string, operation: Operation, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) {
      let message = unavailable[operation];
      if (response.status === 409) message = '此時段已被預約，請返回第一步選擇其他時段。';
      if (response.status === 404) message = '查無預約，請確認預約編號與手機末四碼。';
      if (response.status === 400) message = operation === 'cancel'
        ? '距離預約不足 24 小時，無法線上取消。'
        : '資料格式不正確，請檢查姓名、手機、測試識別碼與 Email。';
      throw new AppointmentRequestError(message);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof AppointmentRequestError) throw error;
    throw new AppointmentRequestError(unavailable[operation]);
  }
}
