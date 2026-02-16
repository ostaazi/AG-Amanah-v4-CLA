import React from 'react';
import { MonitoringAlert } from '../../types';

interface EvidenceListProps {
  lang: 'ar' | 'en';
  items: MonitoringAlert[];
}

const EvidenceList: React.FC<EvidenceListProps> = ({ lang, items }) => (
  <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h4 className="text-lg font-black text-slate-900">
      {lang === 'ar' ? 'قائمة الأدلة' : 'Evidence List'}
    </h4>
    <div className="space-y-2">
      {items.slice(0, 12).map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-black text-slate-900">{item.childName}</p>
          <p className="text-[11px] font-bold text-slate-500">{item.category} • {item.severity}</p>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm font-bold text-slate-400 text-center py-4">
          {lang === 'ar' ? 'لا توجد أدلة.' : 'No evidence items.'}
        </p>
      )}
    </div>
  </div>
);

export default EvidenceList;
