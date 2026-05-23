import type { BusinessHoursEntry } from '@/lib/api';
import { dayName, formatHourRange } from '@/lib/format';

interface Props {
  weekly: BusinessHoursEntry[];
  todayDayOfWeek: number;
}

/**
 * 本週營業時間表。今日那一列會 highlight。
 */
export function WeeklyHoursTable({ weekly, todayDayOfWeek }: Props) {
  return (
    <section aria-labelledby="weekly-hours-heading">
      <h2 id="weekly-hours-heading" className="text-lg font-semibold text-slate-900 mb-3">
        本週營業時間
      </h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {weekly.map((h) => {
            const isToday = h.dayOfWeek === todayDayOfWeek;
            return (
              <li
                key={h.id}
                className={`flex items-center justify-between px-4 py-3 text-sm ${
                  isToday ? 'bg-sky-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700 w-12">
                    {dayName(h.dayOfWeek)}
                  </span>
                  {isToday && (
                    <span className="text-[10px] bg-sky-600 text-white px-2 py-0.5 rounded-full">
                      今日
                    </span>
                  )}
                </div>
                <span className={`${h.isClosed ? 'text-red-600' : 'text-slate-700'}`}>
                  {formatHourRange(h.openTime, h.closeTime)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
