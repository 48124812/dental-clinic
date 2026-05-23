import Link from 'next/link';
import type { Doctor } from '@/lib/api';

interface Props {
  doctor: Doctor;
}

/**
 * 醫師列表的單張卡片。
 * - 沒照片時用 emoji + 第一字當 placeholder（之後 Phase 4 接 S3/CDN 上傳）
 * - 整張卡可點，連到 /doctors/[id]
 */
export function DoctorCard({ doctor }: Props) {
  return (
    <Link
      href={`/doctors/${doctor.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-md hover:border-sky-300 transition"
    >
      <div className="flex items-start gap-4">
        <DoctorAvatar name={doctor.name} photoUrl={doctor.photoUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-sky-700 transition">
              {doctor.name}
            </h3>
            <span className="text-sm text-slate-500">{doctor.title}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {doctor.specialties.map((s) => (
              <span
                key={s}
                className="inline-block text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Avatar — 沒照片時用名字首字 fallback */
export function DoctorAvatar({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl: string | null;
  size?: 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-14 h-14 text-xl';
  if (photoUrl) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full shrink-0 bg-gradient-to-br from-sky-400 to-sky-600 text-white font-semibold flex items-center justify-center`}
      aria-label={name}
    >
      {name.charAt(0)}
    </div>
  );
}
