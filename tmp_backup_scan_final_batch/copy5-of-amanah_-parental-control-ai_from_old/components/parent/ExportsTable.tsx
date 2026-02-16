'use client';

import React, { useState } from 'react';

export type ExportRow = {
  export_id: string;
  incident_id: string;
  created_at: string;
  created_by_user_id: string | null;
  manifest_sha256_hex: string;
};

function shortId(id: string) {
  if (!id) return '';
  if (id.length <= 14) return id;
  return id.slice(0, 12) + '...';
}

export default function ExportsTable({
  loading,
  items,
  familyId,
  onRefresh,
}: {
  loading: boolean;
  items: ExportRow[];
  familyId: string;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string>('');
  const [err, setErr] = useState<string>('');

  async function deleteExport(exportId: string) {
    if (!window.confirm('هل أنت متأكد من حذف هذا التصدير؟ سيتم تسجيل هذه العملية في سجل الحيازة الجنائية.')) return;
    
    setBusyId(exportId);
    setErr('');
    try {
      const res = await fetch(`/api/exports/${encodeURIComponent(exportId)}/delete`, {
        method: 'POST',
        cache: 'no-store',
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || 'فشل الحذف (للأب فقط)');

      onRefresh();
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      {err && (
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 font-bold">
            ⚠️ {err}
          </div>
        </div>
      )}

      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50">
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">التصدير (Export ID)</th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">الحادثة المرتبطة</th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">تاريخ التوليد</th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">بصمة النزاهة (Hash)</th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">الإجراءات</th>
          </tr>
        </thead>

        <tbody className="bg-white">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-6 py-20 text-center text-sm font-bold text-slate-400 animate-pulse">جاري جلب حزم التصدير...</td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-20 text-center text-sm font-bold text-slate-300">لا توجد تصديرات رسمية مسجلة.</td>
            </tr>
          ) : (
            items.map((x) => (
              <tr key={x.export_id} className="hover:bg-slate-50 transition-colors group">
                <td className="border-b border-slate-100 px-6 py-4">
                  <div className="text-sm font-black text-slate-900">{shortId(x.export_id)}</div>
                  <div className="text-[9px] font-mono font-bold text-slate-400">{x.export_id}</div>
                </td>
                <td className="border-b border-slate-100 px-6 py-4">
                  <div className="text-[10px] font-mono font-bold text-indigo-600">{shortId(x.incident_id)}</div>
                </td>
                <td className="border-b border-slate-100 px-6 py-4 text-[11px] font-bold text-slate-600">
                  {new Date(x.created_at).toLocaleString('ar-EG')}
                </td>
                <td className="border-b border-slate-100 px-6 py-4">
                  <div className="max-w-[200px] truncate rounded-lg bg-slate-50 p-2 font-mono text-[9px] font-bold text-slate-500 border border-slate-100">
                    {x.manifest_sha256_hex}
                  </div>
                </td>
                <td className="border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <a
                      href={`/api/exports/${encodeURIComponent(x.export_id)}/manifest`}
                      className="bg-slate-950 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                    >
                      تنزيل Manifest
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(x.manifest_sha256_hex)}
                      className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-slate-50"
                    >
                      نسخ الهاش
                    </button>
                    <button
                      onClick={() => deleteExport(x.export_id)}
                      disabled={busyId === x.export_id}
                      className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all disabled:opacity-30"
                      title="للأب فقط"
                    >
                      {busyId === x.export_id ? 'جاري الحذف...' : 'حذف'}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
