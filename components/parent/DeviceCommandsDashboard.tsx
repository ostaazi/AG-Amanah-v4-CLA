import React, { useMemo } from 'react';
import { DeviceCommandAudit } from '../../types';

interface DeviceCommandsDashboardProps {
  lang: 'ar' | 'en';
  logs: DeviceCommandAudit[];
}

const DeviceCommandsDashboard: React.FC<DeviceCommandsDashboardProps> = ({ lang, logs }) => {
  const stats = useMemo(() => {
    const total = logs.length;
    const done = logs.filter((l) => l.status === 'done' || l.status === 'acked').length;
    const failed = logs.filter((l) => l.status === 'failed').length;
    return { total, done, failed };
  }, [logs]);

  return (
    <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <h4 className="text-lg font-black text-slate-900 mb-4">
        {lang === 'ar' ? 'لوحة أوامر الأجهزة' : 'Device Commands Dashboard'}
      </h4>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
          <p className="text-[11px] font-black text-slate-500">{lang === 'ar' ? 'إجمالي' : 'Total'}</p>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
          <p className="text-[11px] font-black text-emerald-600">{lang === 'ar' ? 'ناجح' : 'Done'}</p>
          <p className="text-2xl font-black text-emerald-700">{stats.done}</p>
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
          <p className="text-[11px] font-black text-rose-600">{lang === 'ar' ? 'فشل' : 'Failed'}</p>
          <p className="text-2xl font-black text-rose-700">{stats.failed}</p>
        </div>
      </div>
    </div>
  );
};

export default DeviceCommandsDashboard;
