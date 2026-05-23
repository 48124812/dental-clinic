import type { Service } from '@/lib/api';
import { priceLabel } from '@/lib/format';

interface Props {
  service: Service;
}

/**
 * 單一療程卡片。
 *
 * 對應 US-04 AC：「列出每個療程：名稱、價格區間、健保 / 自費註記」
 */
export function ServiceCard({ service }: Props) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900 leading-tight">
          {service.name}
        </h3>
        <NhiBadge isNhi={service.isNhi} />
      </div>
      <p className="mt-3 text-lg font-semibold text-sky-700">
        {priceLabel(service.priceMin, service.priceMax)}
      </p>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        {service.descriptionMd}
      </p>
    </article>
  );
}

function NhiBadge({ isNhi }: { isNhi: boolean }) {
  if (isNhi) {
    return (
      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        健保
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
      自費
    </span>
  );
}
