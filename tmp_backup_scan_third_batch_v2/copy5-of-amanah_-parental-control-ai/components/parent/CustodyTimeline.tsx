'use client';

import React from 'react';

export type CustodyEvent = {
  custody_id: string;
  actor: string;
  event_key: string;
  event_at: string;
  event_json: any;
  prev_hash_hex: string | null;
  hash_hex: string;
};

function eventBadge(key: string) {
  const k = (key || '').toUpperCase();
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border';
  if (k.includes('INCIDENT')) return `${base} bg-blue-50 text-blue-700 border-blue-200`;
  if (k.includes('EVIDENCE')) return `${base} bg-purple-50 text-purple-700 border-purple-200`;
  if (k.includes('COMMAND')) return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  if (k.includes('EXPORT')) return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
}

export default function CustodyTimeline({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: string;
  items: CustodyEvent[];
}) {
  if (loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400">جاري سحب سلسلة الحيازة...</div>;
  if (error) return <div className="p-10 bg-red-50 text-red-700 rounded-3xl border border-red-200 text-center font-black">{error}</div>;
  if (!items || items.length === 0) return <div className="p-20 text-center font-black text-slate-300">السجل فارغ حالياً</div>;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row items-center justify-between px-6 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tighter">سجل الحيازة الرقمي (Digital Custody)</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تتبع كافة العمليات الموقعة في السلسلة</p>
        </div>
        <div className="flex items-center gap-3">
           <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Chain Integrity: Verified</span>
        </div>
      </div>

      <div className="relative space-y-8 pr-12 pb-10">
        <div className="absolute top-0 bottom-0 right-5 w-1 bg-slate-50 rounded-full"></div>
        
        {items.map((ev, idx) => (
          <div key={ev.custody_id} className="relative group">
            <div className={`absolute top-2 right-2.5 w-6 h-6 rounded-full border-4 border-white shadow-md z-10 transition-transform group-hover:scale-125 ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
            
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all mr-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <span className={eventBadge(ev.event_key)}>{ev.event_key}</span>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    {new Date(ev.event_at).toLocaleString('ar-EG')}
                  </span>
                </div>
                <div className="px-4 py-1 bg-slate-50 rounded-xl text-[10px] font-black text-slate-600 border border-slate-100">
                  Actor: {ev.actor}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Metadata (JSON)</p>
                  <pre className="max-h-40 overflow-auto rounded-2xl bg-slate-900 p-5 text-[10px] font-mono text-indigo-300 shadow-inner">
                    {JSON.stringify(ev.event_json || {}, null, 2)}
                  </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-slate-300 uppercase px-2">Prev Hash</p>
                    <div className="break-all rounded-xl bg-slate-50 p-3 font-mono text-[8px] font-bold text-slate-400 truncate">
                      {ev.prev_hash_hex || 'GENESIS_ROOT'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-indigo-300 uppercase px-2">Current Hash</p>
                    <div className="break-all rounded-xl bg-indigo-50/30 border border-indigo-100 p-3 font-mono text-[8px] font-bold text-indigo-600">
                      {ev.hash_hex}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}