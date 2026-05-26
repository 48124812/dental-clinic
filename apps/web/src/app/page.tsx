import Link from 'next/link';
import { getBusinessHoursSummary } from '@/lib/api';
import { TodayStatusCard } from '@/components/TodayStatusCard';
import { WeeklyHoursTable } from '@/components/WeeklyHoursTable';

// 強制 dynamic：每次 request 才 fetch + render（不在 build time prerender）
// 必要原因：(1) 今日營業狀態跟當下時間相關，prerender 沒意義；
//          (2) workaround Next 16.2.x /_global-error prerender bug
export const dynamic = 'force-dynamic';

/**
 * 首頁 — US-01「牙痛病患在首頁看到當日營業資訊」
 *
 * 對應講義：
 * - DT P.21–22 急性疼痛患者 Empathy Map（焦慮、要快看到關鍵資訊）
 * - 12-Factor SDLC P.30 Build/Release/Run — fetch 在 server side 跑 (SSR)
 *
 * 這是一個 React Server Component (RSC)：
 * - 在 server 端 render、把 HTML 直接送給瀏覽器
 * - SEO 友善（爬蟲拿到完整內容，不用跑 JS）
 * - 可以直接 await 非同步資料（fetch / DB）
 * - 不能用 useState / useEffect / event handler (那是 client component)
 */
export default async function HomePage() {
  const data = await getBusinessHoursSummary();

  return (
    <main className="flex-1">
      {/* ---------- Hero ---------- */}
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            讓笑容更燦爛
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            專業團隊、溫暖環境、完整療程 — 我們是您家門口最值得信賴的牙醫診所。
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/appointments/new"
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-sky-700 transition"
            >
              立即預約
            </Link>
            <a
              href="tel:+886223456789"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 transition"
            >
              📞 (02) 2345-6789
            </a>
          </div>
        </div>
      </section>

      {/* ---------- 主要資訊區（今日 + 一週） ---------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TodayStatusCard today={data.today} />
            <ContactInfoStrip />
          </div>
          <div>
            <WeeklyHoursTable
              weekly={data.weekly}
              todayDayOfWeek={data.today.dayOfWeek}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

/** 電話 + 地址橫條。 */
function ContactInfoStrip() {
  return (
    <section
      aria-label="聯絡資訊"
      className="mt-6 grid sm:grid-cols-2 gap-3 text-sm"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-slate-500 text-xs mb-1">電話</div>
        <div className="font-medium text-slate-900">(02) 2345-6789</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-slate-500 text-xs mb-1">地址</div>
        <div className="font-medium text-slate-900">台北市信義區光復南路 100 號</div>
      </div>
    </section>
  );
}
