'use client';

export default function ErrorPage() {
  return <main className="flex-1 px-4 py-16 text-center" role="alert">
    <h1 className="text-xl font-semibold">Demo 暫時無法載入</h1>
    <p className="mt-3 text-slate-600">服務可能正在啟動或暫時無法連線，請稍候約一分鐘再試。請勿輸入真實病患資料。</p>
    <button onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-sky-600 px-5 py-3 text-white">重新嘗試</button>
    <p className="mt-4"><a className="text-sky-700 underline" href="https://github.com/48124812/dental-clinic/blob/main/docs/DEMO.md#online-demo-fallback">查看 Demo 備用流程</a></p>
  </main>;
}
