
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Hold = {
  hold_id: string;
  family_id: string;
  incident_id: string | null;
  reason: string;
  created_by_user_id: string | null;
  created_at: string;
  released_at: string | null;
  release_reason: string | null;
};

export default function LegalHoldsPage() {
  const { familyId } = useParams<{ familyId: string }>();

  const [items, setItems] = useState<Hold[]>([]);
  const [incidentId, setIncidentId] = useState('');
  const [reason, setReason] = useState('Manual legal hold by father');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!familyId) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/families/${encodeURIComponent(familyId)}/legal-hold`, {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json?.error?.message || 'Failed to load holds');
        return;
      }
      setItems(json.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function createHold() {
    if (!familyId) return;
    setMsg('');
    const res = await fetch(`/api/families/${encodeURIComponent(familyId)}/legal-hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        incident_id: incidentId.trim() || null,
        reason: reason.trim() || 'Manual legal hold by father',
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMsg(json?.error?.message || 'Failed to create hold');
      return;
    }
    setIncidentId('');
    setReason('Manual legal hold by father');
    await load();
    setMsg('Legal hold created.');
  }

  useEffect(() => {
    load();
  }, [familyId]);

  return (
    <div className="p-6" dir="rtl">
      <div className="text-right">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">الحجز القانوني (Legal Holds)</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">
          تفعيل وضع الحجر يمنع الحذف أو الإتلاف النهائي للأدلة.
        </p>
      </div>

      {msg ? (
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-3 text-sm text-indigo-700 font-bold">
          {msg}
        </div>
      ) : null}

      <div className="mt-8 rounded-[3rem] border border-slate-100 bg-white p-10 shadow-xl overflow-hidden relative group">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform"></div>
        <div className="relative z-10 space-y-6">
          <div className="text-lg font-black text-slate-900">تفعيل حجز جديد</div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase px-3">معرف الحادثة (اختياري)</label>
              <input
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
                placeholder="inc_..."
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase px-3">السبب</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>

          <button
            onClick={createHold}
            className="rounded-2xl bg-slate-900 px-10 py-5 text-sm font-black text-white hover:bg-black transition-all active:scale-95 shadow-xl"
          >
            تفعيل الحجر الجنائي
          </button>
        </div>
      </div>

      <div className="mt-10 rounded-[3rem] border border-slate-100 bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-slate-50 p-8 bg-slate-50/30">
          <div className="text-xl font-black text-slate-800">قائمة الحجوزات النشطة</div>
          <div className="mt-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">عرض أحدث القيود المسجلة</div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-right">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">الحجز</th>
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">الحادثة</th>
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">السبب</th>
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">الحالة</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-sm font-bold text-slate-300 animate-pulse">جاري جلب القيود الجنائية...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-sm font-bold text-slate-200">لا توجد حوادث محجوزة حالياً.</td></tr>
              ) : (
                items.map((h) => (
                  <tr key={h.hold_id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="border-b border-slate-100 px-8 py-5">
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600">{h.hold_id.slice(0, 12)}...</div>
                      <div className="mt-1 text-[10px] font-bold text-slate-400">{new Date(h.created_at).toLocaleString('ar-EG')}</div>
                    </td>

                    <td className="border-b border-slate-100 px-8 py-5 text-xs font-black text-indigo-500 font-mono">
                      {h.incident_id ? h.incident_id : 'Family-wide (سيادي)'}
                    </td>

                    <td className="border-b border-slate-100 px-8 py-5 text-xs font-bold text-slate-600 italic">"{h.reason}"</td>

                    <td className="border-b border-slate-100 px-8 py-5 text-sm">
                      {h.released_at ? (
                        <span className="rounded-xl border-2 border-slate-100 bg-white px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase">Released</span>
                      ) : (
                        <span className="rounded-xl bg-slate-900 px-4 py-1.5 text-[9px] font-black text-white uppercase shadow-lg shadow-slate-200 animate-pulse">Active Hold</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
