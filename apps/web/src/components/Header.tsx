import Link from 'next/link';

/**
 * 站點頂部 navigation bar。
 * 目前是 Server Component（沒有互動），之後加 mobile menu toggle 才需要轉 'use client'。
 */
export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🦷</span>
          <span className="text-lg font-semibold text-slate-900">光明牙醫診所</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-700">
          <Link href="/" className="hover:text-sky-600 transition">首頁</Link>
          <Link href="/doctors" className="hover:text-sky-600 transition">醫師團隊</Link>
          <Link href="/services" className="hover:text-sky-600 transition">服務項目</Link>
        </nav>
      </div>
    </header>
  );
}
