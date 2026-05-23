import Link from 'next/link';
import { MobileMenu } from './MobileMenu';

/**
 * 站點頂部 navigation bar。
 * - Header 本身保持 Server Component（沒互動、SEO 友善）
 * - MobileMenu 是 Client Component（需要 useState 開關漢堡選單）
 * - 對應 US-10：mobile 也要能導覽
 */
export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🦷</span>
          <span className="text-lg font-semibold text-slate-900">光明牙醫診所</span>
        </Link>

        {/* Desktop nav (≥ sm) */}
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-700">
          <Link href="/" className="hover:text-sky-600 transition">首頁</Link>
          <Link href="/doctors" className="hover:text-sky-600 transition">醫師團隊</Link>
          <Link href="/services" className="hover:text-sky-600 transition">服務項目</Link>
        </nav>

        {/* Mobile hamburger (< sm) */}
        <MobileMenu />
      </div>
    </header>
  );
}
