import type { TodayStatus } from '@/lib/api';
import { dayName, formatHourRange } from '@/lib/format';

interface Props {
  today: TodayStatus;
}

/**
 * 顯眼的「今日營業狀態」卡片 — US-01 的主要 UI。
 *
 * 對應 DT 講義 P.21–22（U1 急性疼痛患者 Empathy Map）：
 * - Says: 「最快什麼時候能看？」「現在還有開嗎？」
 * - 設計重點：不捲動就看到、顏色與圖示一眼分辨「能不能去」
 */
export function TodayStatusCard({ today }: Props) {
  const open = today.isCurrentlyOpen;
  const closedAllDay = today.isClosed;

  // 三種狀態：正在營業 / 今日已休 / 今日營業但目前不在時段內
  const status: 'open' | 'closed-now' | 'closed-day' = closedAllDay
    ? 'closed-day'
    : open
      ? 'open'
      : 'closed-now';

  const palette = {
    open: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      label: 'text-emerald-700',
      title: '營業中',
      sub: '歡迎現場掛號或來電預約',
    },
    'closed-now': {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      label: 'text-amber-700',
      title: '今日已過營業時段',
      sub: '請於明日來訪，或線上預約',
    },
    'closed-day': {
      bg: 'bg-red-50',
      border: 'border-red-200',
      dot: 'bg-red-500',
      label: 'text-red-700',
      title: '今日休診',
      sub: '請查看本週其他時段',
    },
  }[status];

  return (
    <section
      aria-labelledby="today-status-heading"
      className={`rounded-2xl border-2 ${palette.bg} ${palette.border} p-6 sm:p-8 shadow-sm`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`mt-2 inline-block w-3 h-3 rounded-full ${palette.dot} ${status === 'open' ? 'animate-pulse' : ''}`}
          aria-hidden
        />
        <div className="flex-1">
          <h2 id="today-status-heading" className="text-sm font-medium text-slate-500">
            今日 ({dayName(today.dayOfWeek)})
          </h2>
          <p className={`mt-1 text-2xl sm:text-3xl font-bold ${palette.label}`}>
            {palette.title}
          </p>
          <p className="mt-2 text-slate-700">
            {closedAllDay ? '本日不營業' : formatHourRange(today.openTime, today.closeTime)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{palette.sub}</p>
        </div>
      </div>
    </section>
  );
}
