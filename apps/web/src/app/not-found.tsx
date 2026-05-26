import Link from 'next/link';

/**
 * 自訂 404 頁面 — 被 notFound() 呼叫或不存在的 URL 都會渲染這個。
 * 比 Next.js 預設黑底白字「This page could not be found」友善。
 */
export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <p className="text-sm font-medium text-sky-600">404</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">
          找不到這個頁面
        </h1>
        <p className="mt-4 text-slate-600">
          您要找的頁面可能已被移除、名稱更動，或暫時無法存取。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition"
          >
            回首頁
          </Link>
          <Link
            href="/doctors"
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 transition"
          >
            看醫師團隊
          </Link>
        </div>
      </div>
    </main>
  );
}
