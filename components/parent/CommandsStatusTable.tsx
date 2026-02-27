import React from 'react';
import { DeviceCommandAudit } from '../../types';

interface CommandsStatusTableProps {
  lang: 'ar' | 'en';
  logs: DeviceCommandAudit[];
}

const badgeClass = (status: string) => {
  if (status === 'done' || status === 'acked') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const CommandsStatusTable: React.FC<CommandsStatusTableProps> = ({ lang, logs }) => (
  <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h4 className="text-lg font-black text-slate-900">
      {lang === 'ar' ? 'حالة الأوامر' : 'Command Status'}
    </h4>
    <div className="space-y-2">
      {logs.slice(0, 12).map((log, idx) => (
        <div key={log.command_id ? `${log.command_id}-${idx}` : idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3">
          <div className="text-right">
            <p className="text-sm font-black text-slate-900">{log.command_type}</p>
            <p className="text-[11px] font-bold text-slate-500">{log.child_id}</p>
          </div>
          <span className={`px-2 py-1 rounded-lg border text-[10px] font-black ${badgeClass(log.status)}`}>
            {log.status}
          </span>
        </div>
      ))}
      {logs.length === 0 && (
        <p className="text-sm font-bold text-slate-400 text-center py-4">
          {lang === 'ar' ? 'لا توجد أوامر بعد.' : 'No command logs yet.'}
        </p>
      )}
    </div>
  </div>
);

export default CommandsStatusTable;
