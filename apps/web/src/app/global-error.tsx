'use client';

/**
 * Global Error Boundary（最外層的 error 接住點）
 *
 * 對應 Next.js 16: layout.tsx 內若有 unhandled error，這個檔案會 render 取代整個 root。
 * 必須是 Client Component（'use client'）— Next.js 強制規定。
 * 必須有完整 <html> + <body>（取代 root layout）。
 *
 * 此檔同時 workaround Next.js 16.2.x 一個已知 build 階段 bug：
 *   "Invariant: Expected workStore to be initialized"
 * 顯式定義這個 file 後 Next.js 不會 prerender 預設 /_global-error 路由。
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="zh-Hant-TW">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '32rem', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f172a' }}>
          系統發生錯誤
        </h1>
        <p style={{ marginTop: '0.5rem', color: '#475569' }}>
          Demo 服務可能正在啟動或暫時無法連線，請稍候約一分鐘再試。本站不提供真實醫療預約服務。
        </p>
        {error.digest && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            錯誤代碼：{error.digest}
          </p>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1.5rem',
            padding: '0.625rem 1.25rem',
            borderRadius: '9999px',
            background: '#0284c7',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          重新嘗試
        </button>
        <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#475569' }}>
          <a href="https://github.com/48124812/dental-clinic/blob/main/docs/DEMO.md#online-demo-fallback">查看 Demo 備用流程</a>
        </p>
      </body>
    </html>
  );
}
