import type { Metadata } from 'next';
import { listServices, type Service, type ServiceCategory } from '@/lib/api';
import { ServiceCard } from '@/components/ServiceCard';
import { categoryLabel } from '@/lib/format';

export const metadata: Metadata = {
  title: '服務項目 / 療程價格',
  description:
    '光明牙醫診所完整療程項目與價格區間：定期檢查、植牙、根管、矯正、美學、兒童牙科。健保與自費項目清楚標示。',
};

/** Category 顯示順序（醫療常見的「預防 → 修復 → 美學」邏輯） */
const CATEGORY_ORDER: ServiceCategory[] = [
  'PREVENTIVE',
  'PEDIATRIC',
  'RESTORATIVE',
  'SURGERY',
  'ORTHODONTIC',
  'COSMETIC',
];

/** 將 Service[] 依 category 分桶。Map 保證 insertion order。 */
function groupByCategory(services: Service[]): Map<ServiceCategory, Service[]> {
  const groups = new Map<ServiceCategory, Service[]>();
  for (const cat of CATEGORY_ORDER) groups.set(cat, []); // 預建空桶確定順序
  for (const s of services) {
    const bucket = groups.get(s.category) ?? [];
    bucket.push(s);
    groups.set(s.category, bucket);
  }
  return groups;
}

/**
 * /services — 療程列表（依 category 分組）
 *
 * 對應 US-04: 「看到清楚的療程價格區間與是否健保給付」
 */
export default async function ServicesPage() {
  const services = await listServices();
  const groups = groupByCategory(services);

  return (
    <main className="flex-1">
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">服務項目</h1>
          <p className="mt-3 text-slate-600 max-w-2xl">
            完整療程涵蓋預防、修復、矯正與美學。價格區間僅供參考，實際以醫師評估為準。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {[...groups.entries()].map(([cat, items]) => {
          if (items.length === 0) return null;
          return (
            <section key={cat}>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                {categoryLabel(cat)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}
