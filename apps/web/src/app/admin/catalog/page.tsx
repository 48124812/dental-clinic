import type { Metadata } from 'next';
import { AdminCatalog } from './AdminCatalog';
export const metadata: Metadata = { title: '管理員｜醫師與服務', robots: { index: false, follow: false } };
export default function AdminCatalogPage() { return <main className="flex-1 bg-slate-50 py-10"><div className="mx-auto max-w-6xl px-4"><h1 className="text-3xl font-bold">醫師與服務管理</h1><p className="mt-2 text-slate-600">管理員專用。資料儲存後，前台會在下一次讀取時反映。</p><AdminCatalog /></div></main>; }
