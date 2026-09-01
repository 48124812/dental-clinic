import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StaffAppointmentDashboard } from './StaffAppointmentDashboard';
export const metadata: Metadata = { title: '員工｜今日預約', robots: { index: false, follow: false } };
export default function StaffAppointmentsPage() { return <main className="flex-1 bg-slate-50 py-10"><div className="mx-auto max-w-5xl px-4"><h1 className="text-3xl font-bold">今日預約</h1><p className="mt-2 text-slate-600">員工專用。登入後可查閱日期並標記到診狀態。</p><Suspense fallback={<p className="mt-8 text-slate-500">載入後台⋯</p>}><StaffAppointmentDashboard /></Suspense></div></main>; }
