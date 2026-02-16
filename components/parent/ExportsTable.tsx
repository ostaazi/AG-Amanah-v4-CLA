import React from 'react';
import { ForensicExport } from '../../types';

interface ExportsTableProps {
  lang: 'ar' | 'en';
  exportsData: ForensicExport[];
  onDownload?: (entry: ForensicExport) => void;
}

const statusColor = (status: ForensicExport['status']) => {
  if (status === 'READY') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'FAILED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const ExportsTable: React.FC<ExportsTableProps> = ({ lang, exportsData, onDownload }) => (
  <div
    className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3"
    dir={lang === 'ar' ? 'rtl' : 'ltr'}
  >
    <h4 className="text-lg font-black text-slate-900">
      {lang === 'ar' ? 'سجل التصدير' : 'Exports Table'}
    </h4>
    <div className="space-y-2">
      {exportsData.map((entry) => (
        <div key={entry.export_id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-900">{entry.export_id}</p>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${statusColor(entry.status)}`}>
              {entry.status}
            </span>
          </div>
          <p className="text-[11px] font-bold text-slate-600">
            {lang === 'ar' ? 'الحادث' : 'Incident'}: {entry.incident_id}
          </p>
          <p className="text-[11px] font-bold text-slate-600">
            {lang === 'ar' ? 'الدليل' : 'Evidence'}: {entry.metadata?.evidence_count ?? 0} •{' '}
            {lang === 'ar' ? 'الأوامر' : 'Commands'}: {entry.metadata?.commands_count ?? 0}
          </p>
          <p className="text-[11px] font-mono text-slate-500 break-all">{entry.sha256_hash}</p>
          <div>
            <button
              type="button"
              onClick={() => onDownload?.(entry)}
              disabled={!onDownload || !entry.manifest_json}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lang === 'ar' ? 'تنزيل الحزمة' : 'Download Package'}
            </button>
          </div>
        </div>
      ))}
      {exportsData.length === 0 && (
        <p className="text-sm font-bold text-slate-400 text-center py-4">
          {lang === 'ar' ? 'لا توجد عمليات تصدير.' : 'No exports yet.'}
        </p>
      )}
    </div>
  </div>
);

export default ExportsTable;
