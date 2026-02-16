'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ExportsTable, { ExportRow } from '../../../../../components/parent/ExportsTable';

type ApiListResponse = {
  ok: boolean;
  items: ExportRow[];
  next_cursor: string | null;
};

export default function FamilyExportsPage({
  params,
}: {
  params: { familyId: string };
}) {
  const familyId = params.familyId;

  const [items, setItems] = useState<ExportRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [err, setErr] = useState<string>('');

  const baseEndpoint = useMemo(() => {
    return `/api/families/${encodeURIComponent(familyId)}/exports`;
  }, [familyId]);

  async function loadFirstPage() {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${baseEndpoint}?limit=30`, { method: 'GET', cache: 'no-store' });
      const json = (await res.json()) as ApiListResponse;

      if (!res.ok || !json.ok) throw new Error(json?.['error']?.message || 'فشل تحميل حزم التصدير');

      setItems(json.items || []);
      setNextCursor(json.next_cursor ?? null);
    } catch (e: any) {
      setErr(e?.message || 'خطأ غير متوقع');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${baseEndpoint}?limit=30&cursor=${nextCursor}`, { method: 'GET', cache: 'no-store' });
      const json = (await res.json()) as ApiListResponse;

      if (!res.ok || !json.ok) throw new Error(json?.['error']?.message || 'فشل تحميل المزيد');

      setItems((prev) => [...prev, ...(json.items || [])]);
      setNextCursor(json.next_cursor ?? null);
    } catch (e: any) {
      setErr(e?.message || 'خطأ غير متوقع');
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFirstPage();
  }, [baseEndpoint]);

  return (
    <div className="min-h-screen bg-slate-50/30 p-10 animate-in fade-in duration-700" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-10">
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">مركز حزم التصدير (Exports)</h1>
            <p className="text-slate-500 font-bold text-lg mt-2">إدارة الوثائق الجنائية الرسمية، لقطات الأدلة الموقعة، وسجلات الحيازة.</p>
          </div>
          <div className="bg-slate-900 text-[#D1A23D] px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-[#D1A23D]/20 flex items-center gap-3 shadow-2xl">
             <span className="w-2 h-2 bg-[#D1A23D] rounded-full animate-pulse"></span>
             Sovereign Archive Access
          </div>
        </div>

        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden min-h-[500px]">
          {err && (
            <div className="p-8">
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 font-black">
                ⚠️ {err}
              </div>
            </div>
          )}

          <ExportsTable loading={loading} items={items} familyId={familyId} onRefresh={loadFirstPage} />

          <div className="flex items-center justify-between p-8 bg-slate-50/30 border-t border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {items.length === 0 && !loading ? 'لا توجد حزم مصدرة' : `إجمالي الحزم: ${items.length}`}
            </div>

            <button
              className="px-10 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-xs font-black shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              onClick={loadMore}
              disabled={!nextCursor || loadingMore}
            >
              {loadingMore ? 'جاري التحميل...' : nextCursor ? 'تحميل المزيد من الأرشيف' : 'نهاية الأرشيف'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
