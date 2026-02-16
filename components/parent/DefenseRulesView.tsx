import React, { useMemo } from 'react';
import { AlertSeverity, Category, SafetyPlaybook } from '../../types';
import { getDefenseActionsWithPlaybooks } from '../../services/ruleEngineService';

interface DefenseRulesViewProps {
  lang: 'ar' | 'en';
  playbooks: SafetyPlaybook[];
}

const DefenseRulesView: React.FC<DefenseRulesViewProps> = ({ lang, playbooks }) => {
  const rows = useMemo(() => {
    const scenarios: Array<{ category: Category; severity: AlertSeverity }> = [
      { category: Category.BULLYING, severity: AlertSeverity.HIGH },
      { category: Category.PREDATOR, severity: AlertSeverity.CRITICAL },
      { category: Category.SELF_HARM, severity: AlertSeverity.CRITICAL },
      { category: Category.BLACKMAIL, severity: AlertSeverity.HIGH },
    ];

    return scenarios.map((s) => ({
      ...s,
      actions: getDefenseActionsWithPlaybooks(s.category, s.severity, playbooks),
    }));
  }, [playbooks]);

  return (
    <div
      className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <h4 className="text-xl font-black text-slate-900">
        {lang === 'ar' ? 'قواعد الاستجابة الدفاعية' : 'Defense Rules'}
      </h4>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={`${row.category}-${row.severity}`}
            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-800">{row.category}</span>
              <span className="text-[11px] font-black text-slate-500">{row.severity}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {row.actions.map((action) => (
                <span
                  key={action.id}
                  className="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black"
                >
                  {action.command}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DefenseRulesView;
