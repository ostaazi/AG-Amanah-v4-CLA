'use client';

import React from 'react';

export type DeviceCommandRow = {
  command_id: string;
  device_id: string;
  command_type: string;
  issued_at: string;
  expires_at: string;
  status: string;
  acked_at: string | null;
  ack_json: any;
};

function statusChip(s: string) {
  const v = (s || '').toUpperCase();
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black border uppercase tracking-tighter';
  if (v === 'ACKED') return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  if (v === 'FAILED') return `${base} bg-red-50 text-red-700 border-red-200`;
  if (v === 'EXPIRED') return `${base} bg-slate-50 text-slate-500 border-slate-200`;
  if (v === 'PENDING' || v === 'SENT') return `${base} bg-amber-50 text-amber-700 border-amber-200 animate-pulse`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
}

export default function CommandsStatusTable({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: string;
  items: DeviceCommandRow[];
}) {
  if (loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400">جاري سحب سجل الأوامر...</div>;
  if (error) return <div className="p-10 bg-red-50 text-red-700 rounded-3xl border border-red-200 text-center font-black">{error}</div>;
  if (!items || items.length === 0) return <div className="p-20 text-center font-black text-slate-300">لم يتم إرسال أي أوامر سيادية لهذه الحادثة</div>;

  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-slate-50">
        <h3 className="text-lg font-black text-slate-900 tracking-tighter">الأوامر السيادية (Active Commands)</h3>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">تتبع حالة استلام وتنفيذ التعليمات في هاتف الطفل</p>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="border-b border-slate-100 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Command ID</th>
              <th className="border-b border-slate-100 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">النوع</th>
              <th className="border-b border-slate-100 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">الحالة</th>
              <th className="border-b border-slate-100 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">وقت الصدور</th>
              <th className="border-b border-slate-100 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">الاستلام (Ack)</th>
              <th className="border-b border-slate-100 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">رد الجهاز</th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {items.map((c) => (
              <tr key={c.command_id} className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-slate-100 px-6 py-4">
                  <div className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {c.command_id.slice(0, 12)}
                  </div>
                  <div className="text-[8px] font-mono font-bold text-slate-300 mt-0.5">DEV: {c.device_id.slice(0, 8)}</div>
                </td>

                <td className="border-b border-slate-100 px-6 py-4 text-[11px] font-black text-slate-800">
                  {c.command_type}
                </td>

                <td className="border-b border-slate-100 px-6 py-4">
                  <span className={statusChip(c.status)}>{c.status}</span>
                </td>

                <td className="border-b border-slate-100 px-6 py-4 text-[10px] font-bold text-slate-500">
                  {new Date(c.issued_at).toLocaleString('ar-EG')}
                </td>

                <td className="border-b border-slate-100 px-6 py-4 text-[10px] font-bold text-slate-500">
                  {c.acked_at ? new Date(c.acked_at).toLocaleString('ar-EG') : 'بانتظار الاستلام...'}
                </td>

                <td className="border-b border-slate-100 px-6 py-4">
                  <details className="cursor-pointer">
                    <summary className="text-[9px] font-black text-indigo-500 uppercase hover:underline">View Ack Payload</summary>
                    <pre className="mt-2 max-h-32 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-[9px] text-slate-600 border border-slate-100">
                      {JSON.stringify(c.ack_json || { status: 'none' }, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}