'use client';

import React from 'react';

type EvidenceItem = {
  evidence_id: string;
  evidence_type: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  sha256_hex: string;
  captured_at: string;
  meta_json?: any;
};

function humanSize(bytes: number) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (!evidence || evidence.length === 0) {
    return (
      <div className="p-20 text-center">
         <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 opacity-50">📂</div>
         <p className="text-sm font-black text-slate-400 uppercase tracking-widest">لا توجد أدلة جنائية مسجلة لهذه الحادثة</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-6 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tighter">مستودع الأدلة (Forensic Vault)</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">كل عنصر موقع رقمياً ضد التلاعب</p>
        </div>
        <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-lg shadow-indigo-100">{evidence.length} عناصر</span>
      </div>

      <div className="grid grid-cols-1 gap-6 px-4">
        {evidence.map((e) => (
          <div key={e.evidence_id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="px-4 py-1.5 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                    {e.evidence_type}
                  </div>
                  <span className="px-4 py-1.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase border border-slate-100">
                    {e.mime_type}
                  </span>
                  <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase border border-indigo-100">
                    {humanSize(e.size_bytes)}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-slate-500">
                  تاريخ الالتقاط: <span className="text-slate-900">{new Date(e.captured_at).toLocaleString('ar-EG')}</span>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">مفتاح التخزين السيادي (Storage Key)</p>
                  <div className="break-all rounded-2xl bg-slate-50 border border-slate-100 p-4 font-mono text-[9px] font-bold text-slate-800 shadow-inner">
                    {e.storage_key}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-2">بصمة النزاهة (SHA-256)</p>
                  <div className="break-all rounded-2xl bg-indigo-50/50 border border-indigo-100 p-4 font-mono text-[9px] font-bold text-indigo-700 shadow-inner">
                    {e.sha256_hex}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                  onClick={() => navigator.clipboard.writeText(e.sha256_hex)}
                >
                  نسخ الهاش
                </button>
                <button
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  تحميل الدليل
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}