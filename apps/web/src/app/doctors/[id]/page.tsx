import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDoctorById } from '@/lib/api';
import { DoctorAvatar } from '@/components/DoctorCard';

/**
 * Dynamic Route Segment：[id] 從 URL 抓出來。
 *
 * Next 15+ breaking change：params 是 Promise，必須 await。
 * 為什麼？支援 server-side streaming：next 不用等到知道 params 就能開始 render。
 */
interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * 動態 SEO：每位醫師有自己的 <title> 與 description。
 * 對應 US-11 (SEO)：搜「植牙 王大明」可能匹配到這頁。
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const doctor = await getDoctorById(id);
  if (!doctor) {
    return { title: '醫師不存在' };
  }
  return {
    title: `${doctor.name} ${doctor.title}`,
    description: `${doctor.name}（${doctor.title}）專長：${doctor.specialties.join('、')}。${doctor.bioMd.slice(0, 80)}`,
  };
}

/**
 * /doctors/[id] — 醫師詳情頁
 *
 * 對應 US-03 AC：「點某位醫師 → 進入該醫師詳情頁，看到學歷、經歷、語言、預約按鈕」
 */
export default async function DoctorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const doctor = await getDoctorById(id);

  // notFound() 會自動 render Next.js 的 not-found.tsx（之後可自訂）
  // 並回 HTTP 404 給爬蟲，這對 SEO 很重要
  if (!doctor) {
    notFound();
  }

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* 麵包屑 */}
        <nav className="text-sm text-slate-500 mb-6">
          <Link href="/doctors" className="hover:text-sky-700">← 醫師團隊</Link>
        </nav>

        {/* Header */}
        <header className="flex items-start gap-6">
          <DoctorAvatar name={doctor.name} photoUrl={doctor.photoUrl} size="lg" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{doctor.name}</h1>
            <p className="mt-1 text-lg text-slate-600">{doctor.title}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {doctor.specialties.map((s) => (
                <span
                  key={s}
                  className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Bio（暫時用 plain text，之後 Phase 4 加 react-markdown） */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">關於醫師</h2>
          <p className="text-slate-700 whitespace-pre-line leading-relaxed">{doctor.bioMd}</p>
        </section>

        {/* Credentials */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">學經歷</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            {doctor.credentials.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-10">
          <Link
            href="/appointments/new"
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-sky-700 transition"
          >
            預約 {doctor.name} 醫師
          </Link>
        </section>
      </article>
    </main>
  );
}
