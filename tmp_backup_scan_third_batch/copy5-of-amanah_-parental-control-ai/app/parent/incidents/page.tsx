'use client';

import React, { useEffect, useMemo, useState } from 'react';
import IncidentsTable, { IncidentRow } from '../../../../components/parent/IncidentsTable';

type ApiListResponse = {
  ok: boolean;
  items: IncidentRow[];
  next_cursor: string | null;
};

export default function FamilyIncidentsPage({
  params,
}: {
  params: { familyId: string };
}) {
  const familyId = params.familyId || '000-default';

  const [risk, setRisk] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');

  const [items, setItems] = useState<IncidentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [err, setErr] = useState<string>('');

  async function loadFirstPage() {
    setLoading(true);
    setErr('');
    try {
      const url = new URL(`/api/families/${familyId}/incidents`, window.location.origin);
      if (risk) url.searchParams.set('risk', risk);
      if (status) url.searchParams.set('status', status);
      if (deviceId) url.searchParams.set('device_id', deviceId);
      url.searchParams.set('limit', '30');

      const res = await fetch(url.toString());
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load incidents');

      setItems(json.items || []);
      setNextCursor(json.next_cursor ?? null);
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFirstPage();
  }, [risk, status, deviceId]);

  return (
    <div className="min-h-screen bg-slate-50/30 p-10 animate-in fade-in duration-700" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-10">
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">مركز الحوادث الأمنية</h1>
            <p className="text-slate-500 font-bold text-lg mt-2">مراجعة الحوادث المرصودة، الأدلة الجنائية، والخط الزمني للعمليات.</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-emerald-100 flex items-center gap-3">
             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
             Global Integrity Shield: ON
          </div>
        </div>

        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-10 border-b border-slate-50 bg-slate-50/30">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              <FilterSelect label="مستوى الخطورة" value={risk} onChange={setRisk}>
                <option value="">كافة المستويات</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </FilterSelect>

              <FilterSelect label="حالة الحادثة" value={status} onChange={setStatus}>
                <option value="">كافة الحالات</option>
                <option value="OPEN">OPEN (مفتوحة)</option>
                <option value="MITIGATED">MITIGATED (تم الاحتواء)</option>
                <option value="CLOSED">CLOSED (مغلقة)</option>
              </FilterSelect>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">معرف الجهاز (اختياري)</label>
                <input
                  className="w-full rounded-2xl bg-white border border-slate-200 px-6 py-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="ابحث بمعرف جهاز معين..."
                />
              </div>
            </div>

            {err && (
              <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-3xl text-red-700 text-sm font-black flex items-center gap-4">
                <span className="text-2xl">⚠️</span> {err}
              </div>
            )}
          </div>

          <IncidentsTable loading={loading} items={items} familyId={familyId} />

          <div className="flex items-center justify-between p-8 bg-slate-50/30 border-t border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {items.length === 0 && !loading ? 'لا توجد نتائج' : `إجمالي المعروض: ${items.length}`}
            </div>

            <button
              className="px-10 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-xs font-black shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              disabled={!nextCursor || loadingMore}
            >
              {loadingMore ? 'جاري التحميل...' : nextCursor ? 'عرض المزيد من السجلات' : 'نهاية السجل'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, children, value, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">{label}</label>
      <select
        className="w-full rounded-2xl bg-white border border-slate-200 px-6 py-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}
