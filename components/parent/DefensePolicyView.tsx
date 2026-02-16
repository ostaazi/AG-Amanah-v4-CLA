import React, { useMemo, useState } from 'react';
import { AlertSeverity, Category } from '../../types';

interface DefensePolicyViewProps {
  lang: 'ar' | 'en';
}

interface PolicyItem {
  id: string;
  name: string;
  category: Category;
  minSeverity: AlertSeverity;
  enabled: boolean;
}

const DefensePolicyView: React.FC<DefensePolicyViewProps> = ({ lang }) => {
  const [items, setItems] = useState<PolicyItem[]>([
    {
      id: 'policy-bully',
      name: lang === 'ar' ? 'درع التنمر' : 'Bullying Shield',
      category: Category.BULLYING,
      minSeverity: AlertSeverity.HIGH,
      enabled: true,
    },
    {
      id: 'policy-predator',
      name: lang === 'ar' ? 'بروتوكول الاستدراج' : 'Predator Protocol',
      category: Category.PREDATOR,
      minSeverity: AlertSeverity.CRITICAL,
      enabled: true,
    },
  ]);

  const toggle = (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, enabled: !it.enabled } : it)));
  };

  const enabledCount = useMemo(() => items.filter((it) => it.enabled).length, [items]);

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
          {lang === 'ar' ? `مفعّل: ${enabledCount}/${items.length}` : `Enabled: ${enabledCount}/${items.length}`}
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 flex items-center justify-between"
          >
            <div className="text-right">
              <p className="text-sm font-black text-slate-900">{item.name}</p>
              <p className="text-[11px] font-bold text-slate-500">{item.category} • {item.minSeverity}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black ${
                item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {item.enabled ? (lang === 'ar' ? 'مفعّل' : 'Enabled') : (lang === 'ar' ? 'متوقف' : 'Disabled')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DefensePolicyView;
