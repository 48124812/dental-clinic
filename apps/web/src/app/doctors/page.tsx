import type { Metadata } from 'next';
import { listDoctors } from '@/lib/api';
import { DoctorCard } from '@/components/DoctorCard';

export const metadata: Metadata = {
  title: '醫師團隊',
  description: '光明牙醫診所專業醫師團隊 — 一般牙科、植牙、矯正、美學牙科、兒童牙科。',
};

export const dynamic = 'force-dynamic';

/**
 * /doctors — 醫師列表頁
 *
 * 對應 US-03：「我想要看到每位醫師的學經歷與專長」
 * AC：列出全部醫師、照片、職稱、專長標籤
 */
export default async function DoctorsPage() {
  const doctors = await listDoctors();

  return (
    <main className="flex-1">
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">醫師團隊</h1>
          <p className="mt-3 text-slate-600 max-w-2xl">
            我們的醫師團隊涵蓋一般牙科、矯正、美容、外科等專業，依您的需求挑選合適的醫師。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {doctors.length === 0 ? (
          <p className="text-slate-500">目前沒有可預約的醫師。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {doctors.map((d) => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
