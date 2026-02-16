import React, { useMemo, useState } from 'react';
import { IncidentReport } from '../../types';

interface IncidentDetailsTabsProps {
  lang: 'ar' | 'en';
  incident: IncidentReport | null;
}

type TabKey = 'summary' | 'timeline' | 'actions';

const IncidentDetailsTabs: React.FC<IncidentDetailsTabsProps> = ({ lang, incident }) => {
  const [tab, setTab] = useState<TabKey>('summary');
  const tabs = useMemo(
    () =>
      lang === 'ar'
        ? { summary: 'الملخص', timeline: 'التسلسل', actions: 'الإجراءات' }
        : { summary: 'Summary', timeline: 'Timeline', actions: 'Actions' },
    [lang]
  );

  if (!incident) {
    return (
      <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm text-sm font-bold text-slate-500 text-center">
        {lang === 'ar' ? 'اختر حادثًا لعرض التفاصيل.' : 'Select an incident to inspect details.'}
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex gap-2">
        {(Object.keys(tabs) as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black border ${
              tab === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            {tabs[key]}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="space-y-2">
          <p className="text-sm font-black text-slate-900">{incident.childName}</p>
          <p className="text-sm font-bold text-slate-600">{incident.summary || '-'}</p>
        </div>
      )}
      {tab === 'timeline' && (
        <div className="space-y-2">
          <p className="text-[11px] font-black text-slate-500">{incident.created_at}</p>
          <p className="text-[11px] font-black text-slate-500">{incident.updated_at}</p>
          <p className="text-sm font-bold text-slate-700">
            {lang === 'ar' ? 'تم اكتشاف الحادث ومتابعته ضمن مسار التدخل.' : 'Incident was detected and tracked in the intervention pipeline.'}
          </p>
        </div>
      )}
      {tab === 'actions' && (
        <div className="space-y-2">
          <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-100">
            lockDevice
          </span>
          <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-100">
            notifyParent
          </span>
          <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-100">
            captureEvidence
          </span>
        </div>
      )}
    </div>
  );
};

export default IncidentDetailsTabs;
