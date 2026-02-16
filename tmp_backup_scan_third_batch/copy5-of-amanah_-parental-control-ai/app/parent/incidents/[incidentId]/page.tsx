'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import IncidentDetailsTabs from '../../../../../components/parent/IncidentDetailsTabs';

type IncidentDetailsResponse = {
  ok: boolean;
  incident: {
    incident_id: string;
    family_id: string;
    device_id: string;
    child_user_id: string | null;
    incident_type: string;
    risk_level: string;
    summary: string;
    detected_at: string;
    status: string;
    meta_json: any;
  };
  evidence: any[];
};

export default function IncidentDetailsPage() {
  const { incidentId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState<IncidentDetailsResponse | null>(null);

  async function load() {
    if (!incidentId) return;
    setLoading(true);
    setErr('');

    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load incident details');

      setData(json);
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [incidentId]);

  return (
    <div className="min-h-screen bg-slate-50/20 p-10 animate-in fade-in duration-700" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex items-start justify-between gap-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">تفاصيل الحادثة الجنائية</h1>
            <p className="text-slate-500 font-bold text-lg mt-2">الأدلة، سجل الحيازة، وإجراءات الدفاع الآلي المتخذة.</p>
          </div>

          <button
            onClick={load}
            className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl text-xs font-black shadow-sm hover:bg-slate-50 transition-all flex items-center gap-3"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span> تحديث البيانات
          </button>
        </div>

        <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl overflow-hidden min-h-[600px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-40 space-y-6">
               <div className="w-20 h-20 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
               <p className="text-sm font-black text-slate-400 uppercase tracking-widest">جاري سحب الملف الجنائي من الخادم الآمن...</p>
            </div>
          ) : err ? (
            <div className="p-20 text-center space-y-8">
               <div className="text-8xl">🛑</div>
               <div className="bg-red-50 p-10 rounded-[3rem] border border-red-100 max-w-2xl mx-auto">
                  <h3 className="text-2xl font-black text-red-900 mb-2">خطأ في الوصول للملف</h3>
                  <p className="text-red-700 font-bold">{err}</p>
               </div>
               <button onClick={load} className="text-indigo-600 font-black underline">إعادة المحاولة</button>
            </div>
          ) : data ? (
            <IncidentDetailsTabs incident={data.incident} evidence={data.evidence} />
          ) : (
            <div className="p-40 text-center font-black text-slate-300 uppercase tracking-widest">No Record Found</div>
          )}
        </div>
      </div>
    </div>
  );
}
