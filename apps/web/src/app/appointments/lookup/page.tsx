import type { Metadata } from 'next';
import { AppointmentLookup } from './AppointmentLookup';

export const metadata: Metadata = { title: '查詢或取消預約', description: '使用預約編號與手機末四碼查詢或取消預約。' };
export default function AppointmentLookupPage() { return <main className="flex-1 bg-slate-50 py-10 sm:py-14"><div className="mx-auto max-w-xl px-4 sm:px-6"><h1 className="text-3xl font-bold text-slate-900">查詢或取消預約</h1><p className="mt-3 text-slate-600">輸入預約成立時取得的預約編號，以及手機末四碼。</p><AppointmentLookup /></div></main>; }
