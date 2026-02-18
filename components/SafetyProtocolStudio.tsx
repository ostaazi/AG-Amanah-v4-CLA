import React, { useMemo, useState } from 'react';
import { AlertSeverity, Category } from '../types';

export interface SafetyProtocolDraft {
  title: string;
  category: Category;
  severity: AlertSeverity;
  steps: string[];
}

interface SafetyProtocolStudioProps {
  lang: 'ar' | 'en';
  onCreateProtocol?: (draft: SafetyProtocolDraft) => Promise<void> | void;
  saving?: boolean;
}

const SafetyProtocolStudio: React.FC<SafetyProtocolStudioProps> = ({
  lang,
  onCreateProtocol,
  saving = false,
}) => {
  const [title, setTitle] = useState(lang === 'ar' ? 'بروتوكول جديد' : 'New Protocol');
  const [category, setCategory] = useState<Category>(Category.BULLYING);
  const [severity, setSeverity] = useState<AlertSeverity>(AlertSeverity.HIGH);
  const [steps, setSteps] = useState<string[]>([
    lang === 'ar' ? 'التقاط لقطة شاشة فورية' : 'Capture immediate screenshot',
    lang === 'ar' ? 'تنبيه الوالدين' : 'Notify parents',
  ]);
  const [newStep, setNewStep] = useState('');
  const [status, setStatus] = useState<'idle' | 'created' | 'error'>('idle');

  const texts = useMemo(
    () =>
      lang === 'ar'
        ? {
            add: 'إضافة',
            addToHub: 'إضافة إلى البروتوكولات',
            emptyTitle: 'اسم البروتوكول مطلوب.',
            created: 'تمت إضافة البروتوكول محليًا. اضغط حفظ التغييرات لتثبيته في قاعدة البيانات.',
            createError: 'فشل إنشاء البروتوكول. حاول مرة أخرى.',
          }
        : {
            add: 'Add',
            addToHub: 'Add To Playbooks',
            emptyTitle: 'Protocol title is required.',
            created: 'Protocol added locally. Click Save Changes to persist in Firestore.',
            createError: 'Failed to create protocol. Try again.',
          },
    [lang]
  );

  const addStep = () => {
    const s = newStep.trim();
    if (!s) return;
    setSteps((prev) => [...prev, s]);
    setNewStep('');
  };

  const createProtocol = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setStatus('error');
      return;
    }
    if (!onCreateProtocol) {
      setStatus('created');
      return;
    }

    try {
      await onCreateProtocol({
        title: nextTitle,
        category,
        severity,
        steps: steps.map((step) => step.trim()).filter(Boolean),
      });
      setStatus('created');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div
      className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <h4 className="text-xl font-black text-slate-900">
        {lang === 'ar' ? 'استوديو بروتوكولات الحماية' : 'Safety Protocol Studio'}
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setStatus('idle');
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as Category);
            setStatus('idle');
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
        >
          <option value={Category.BULLYING}>{Category.BULLYING}</option>
          <option value={Category.PREDATOR}>{Category.PREDATOR}</option>
          <option value={Category.SELF_HARM}>{Category.SELF_HARM}</option>
          <option value={Category.BLACKMAIL}>{Category.BLACKMAIL}</option>
        </select>
        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as AlertSeverity);
            setStatus('idle');
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
        >
          <option value={AlertSeverity.MEDIUM}>{AlertSeverity.MEDIUM}</option>
          <option value={AlertSeverity.HIGH}>{AlertSeverity.HIGH}</option>
          <option value={AlertSeverity.CRITICAL}>{AlertSeverity.CRITICAL}</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-[11px] font-black text-slate-500 mb-2">
          {lang === 'ar' ? 'خطوات التنفيذ' : 'Execution Steps'}
        </p>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div
              key={`${step}-${idx}`}
              className="text-sm font-bold text-slate-700 bg-white rounded-lg border border-slate-200 p-2"
            >
              {idx + 1}. {step}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            placeholder={lang === 'ar' ? 'أضف خطوة...' : 'Add step...'}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold"
          />
          <button onClick={addStep} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-black">
            {texts.add}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-bold text-indigo-700">
        {lang === 'ar'
          ? `ملخص: ${title} • ${category} • الحد الأدنى للشدة ${severity}`
          : `Summary: ${title} • ${category} • min severity ${severity}`}
      </div>

      <button
        onClick={createProtocol}
        disabled={saving}
        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black disabled:opacity-50"
      >
        {texts.addToHub}
      </button>

      {status === 'created' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
          {texts.created}
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
          {title.trim() ? texts.createError : texts.emptyTitle}
        </div>
      )}
    </div>
  );
};

export default SafetyProtocolStudio;
