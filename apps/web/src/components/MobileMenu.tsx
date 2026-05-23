'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * 手機漢堡選單。
 *
 * 為什麼是 Client Component (`'use client'`)：
 *   - 用 useState 記住「開 / 關」狀態
 *   - 用 onClick 切換
 *   - Server Component 不能用 React hooks 或 event handler
 *
 * 為什麼不把整個 Header 設 client：
 *   - Header 大部分是靜態 (logo + nav links)，沒必要送 JS 過去
 *   - 「Server-first, Client 只用在需要互動的局部」是 App Router 建議
 *
 * 對應 US-10 (手機 RWD)：mobile 使用者也要能導覽。
 */

const LINKS = [
  { href: '/', label: '首頁' },
  { href: '/doctors', label: '醫師團隊' },
  { href: '/services', label: '服務項目' },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? '關閉選單' : '開啟選單'}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="p-2 rounded-md text-slate-700 hover:bg-slate-100 transition"
      >
        {open ? <IconClose /> : <IconHamburger />}
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 top-16 bg-white border-b border-slate-200 shadow-lg sm:hidden"
          // 點背景時關掉選單（簡易版 — 嚴格的話要 useRef + outside click detector）
          onClick={() => setOpen(false)}
        >
          <nav className="flex flex-col py-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-6 py-3 text-base font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

// ----- Inline SVG icons (避免裝額外的 icon library) -----

function IconHamburger() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
