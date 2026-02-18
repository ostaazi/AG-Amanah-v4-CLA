import React, { useMemo } from 'react';
import { AlertSeverity, SafetyPlaybook } from '../../types';

interface DefensePolicyViewProps {
  lang: 'ar' | 'en';
  playbooks: SafetyPlaybook[];
  onTogglePolicy: (id: string) => void;
  onUpdateSeverity: (id: string, minSeverity: AlertSeverity) => void;
}

const DefensePolicyView: React.FC<DefensePolicyViewProps> = ({
  lang,
  playbooks,
  onTogglePolicy,
  onUpdateSeverity,
}) => {
  const enabledCount = useMemo(() => playbooks.filter((it) => it.enabled).length, [playbooks]);

  return (
    <div
      className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-black text-slate-900">
          {lang === 'ar' ? 'سياسات الدفاع' : 'Defense Policy'}
        </h4>
        <span className="text-[11px] font-black text-slate-500">
          {lang === 'ar'
            ? `مفعّل: ${enabledCount}/${playbooks.length}`
            : `Enabled: ${enabledCount}/${playbooks.length}`}
        </span>
      </div>

      {playbooks.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-500">
          {lang === 'ar' ? 'لا توجد بروتوكولات محفوظة بعد.' : 'No saved playbooks yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {playbooks.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <button
                onClick={() => onTogglePolicy(item.id)}
                className="w-full flex items-center justify-between"
              >
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{item.name}</p>
                  <p className="text-[11px] font-bold text-slate-500">
                    {item.category} • {item.minSeverity}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black ${
                    item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {item.enabled
                    ? lang === 'ar'
                      ? 'مفعّل'
                      : 'Enabled'
                    : lang === 'ar'
                      ? 'متوقف'
                      : 'Disabled'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                {[AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL].map((severity) => (
                  <button
                    key={`${item.id}-${severity}`}
                    onClick={() => onUpdateSeverity(item.id, severity)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                      item.minSeverity === severity
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {severity}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DefensePolicyView;
