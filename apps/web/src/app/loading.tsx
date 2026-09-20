export default function Loading() {
  return <main className="flex-1 px-4 py-16 text-center" role="status" aria-live="polite">
    <h1 className="text-xl font-semibold">正在載入 Demo…</h1>
    <p className="mt-3 text-slate-600">服務首次啟動可能需要約一分鐘，請稍候。若持續無法載入，請稍後重新整理。</p>
  </main>;
}
