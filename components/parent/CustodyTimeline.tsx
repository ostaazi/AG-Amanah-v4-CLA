import React from 'react';
import { EvidenceCustody } from '../../types';

interface CustodyTimelineProps {
  lang: 'ar' | 'en';
  rows: EvidenceCustody[];
}

const CustodyTimeline: React.FC<CustodyTimelineProps> = ({ lang, rows }) => (
  <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h4 className="text-lg font-black text-slate-900">
      {lang === 'ar' ? 'التسلسل الزمني للحيازة' : 'Custody Timeline'}
    </h4>
    <div className="space-y-2">
      {rows.slice(0, 12).map((row) => (
        <div key={row.custody_id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-black text-slate-900">{row.event_key}</p>
          <p className="text-[11px] font-bold text-slate-600">{row.actor} • {row.action}</p>
          <p className="text-[11px] font-bold text-slate-500">{row.created_at}</p>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-sm font-bold text-slate-400 text-center py-4">
          {lang === 'ar' ? 'لا توجد عناصر في السلسلة.' : 'No custody entries.'}
        </p>
      )}
    </div>
  </div>
);

export default CustodyTimeline;
