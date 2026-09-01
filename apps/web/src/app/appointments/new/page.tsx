import type { Metadata } from 'next';
import { listDoctors } from '@/lib/api';
import { BookingForm } from './BookingForm';

export const metadata: Metadata = { title: '線上預約', description: '選擇醫師與時段，完成光明牙醫診所的線上預約。' };
export const dynamic = 'force-dynamic';

export default async function NewAppointmentPage() {
  const doctors = await listDoctors();
  return <main className="flex-1 bg-slate-50 py-10 sm:py-14"><div className="mx-auto max-w-3xl px-4 sm:px-6"><h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">線上預約</h1><p className="mt-3 text-slate-600">依序選擇醫師與看診時段，再填寫基本資料即可完成預約。</p><BookingForm doctors={doctors.map((doctor) => ({ id: doctor.id, name: doctor.name, title: doctor.title, specialties: doctor.specialties }))} /></div></main>;
}
