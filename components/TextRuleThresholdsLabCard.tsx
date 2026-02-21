import React, { useEffect, useMemo, useState } from 'react';
import { sendRemoteCommand, subscribeToChildren } from '../services/firestoreService';
import { Child } from '../types';
import {
  TextThresholdDraft,
  TEXT_RULE_THRESHOLD_DEFAULTS,
  TEXT_RULE_THRESHOLD_RANGES,
  normalizeTextThresholdDraft,
} from '../services/modelThresholdDefaults';

interface TextRuleThresholdsLabCardProps {
  lang: 'ar' | 'en';
  parentId: string;
}

type DraftKey = keyof TextThresholdDraft;

const STORAGE_KEY = 'amanah_text_thresholds_lab_draft_v1';

const parseMaybeNumber = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asFixed = (value: number, digits: number): string => value.toFixed(digits);

const TextRuleThresholdsLabCard: React.FC<TextRuleThresholdsLabCardProps> = ({ lang, parentId }) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [draft, setDraft] = useState<TextThresholdDraft>({ ...TEXT_RULE_THRESHOLD_DEFAULTS });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'مختبر عتبات محرك النص',
            subtitle:
              'تحكم منفصل في حساسية Rule-Engine للنصوص بعد التطبيع. كل قيمة تؤثر على قرار التنبيه النصي مباشرة.',
            noParent: 'لا يوجد معرف ولي صالح للتحكم بالأجهزة.',
            selectChild: 'الجهاز المستهدف',
            applyOne: 'تطبيق على الجهاز المحدد',
            applyAll: 'تطبيق على كل أجهزة الأطفال',
            resetLocal: 'إعادة القيم الافتراضية (محلي)',
            sendReset: 'استعادة القيم الأصلية (Default)',
            range: 'النطاق',
            value: 'القيمة',
            sectionSeverity: 'Text Severity Mapping',
            sectionCategory: 'Category Gates',
            noChildren: 'لا توجد أجهزة أطفال مرتبطة بهذا الحساب.',
            doneOne: 'تم إرسال عتبات النص للجهاز بنجاح.',
            doneAll: 'تم إرسال عتبات النص لكل الأجهزة.',
            resetDone: 'تمت استعادة عتبات النص الأصلية محلياً وعلى الجهاز المحدد.',
            resetLocalDone: 'تمت استعادة عتبات النص الأصلية محلياً.',
            failed: 'تعذر إرسال إعدادات عتبات النص. تحقق من الاتصال والصلاحيات.',
          }
        : {
            title: 'Text Rule-Engine Threshold Lab',
            subtitle:
              'Separate controls for normalized text rule-engine sensitivity. Every value below directly affects text alert decisions.',
            noParent: 'No valid parent ID found for remote control.',
            selectChild: 'Target child device',
            applyOne: 'Apply to selected child',
            applyAll: 'Apply to all child devices',
            resetLocal: 'Reset local defaults',
            sendReset: 'Restore Original Defaults',
            range: 'Range',
            value: 'Value',
            sectionSeverity: 'Text Severity Mapping',
            sectionCategory: 'Category Gates',
            noChildren: 'No child devices linked to this account.',
            doneOne: 'Text thresholds payload sent to selected child.',
            doneAll: 'Text thresholds payload sent to all children.',
            resetDone: 'Original text defaults restored locally and on selected device.',
            resetLocalDone: 'Original text defaults restored locally.',
            failed: 'Failed to send text threshold command. Check network and permissions.',
          },
    [lang]
  );

  const fields = useMemo(
    () => [
      {
        key: 'severityMedium' as DraftKey,
        section: t.sectionSeverity,
        label: lang === 'ar' ? 'عتبة MEDIUM العامة' : 'Global MEDIUM threshold',
        hint:
          lang === 'ar'
            ? 'أدنى score لإطلاق أي تنبيه نصي. رفعها يقلل الحساسية العامة.'
            : 'Minimum score required before any text alert can fire.',
      },
      {
        key: 'severityHigh' as DraftKey,
        section: t.sectionSeverity,
        label: lang === 'ar' ? 'عتبة HIGH' : 'HIGH threshold',
        hint:
          lang === 'ar'
            ? 'الحد الأدنى لتحويل التنبيه النصي إلى HIGH.'
            : 'Minimum score required to map text alert to HIGH.',
      },
      {
        key: 'severityCritical' as DraftKey,
        section: t.sectionSeverity,
        label: lang === 'ar' ? 'عتبة CRITICAL' : 'CRITICAL threshold',
        hint:
          lang === 'ar'
            ? 'الحد الأدنى لتحويل التنبيه النصي إلى CRITICAL.'
            : 'Minimum score required to map text alert to CRITICAL.',
      },
      {
        key: 'gatePredator' as DraftKey,
        section: t.sectionCategory,
        label: lang === 'ar' ? 'Gate: تواصل مشبوه' : 'Gate: Predator/Grooming',
        hint:
          lang === 'ar'
            ? 'أدنى score لقبول حالة الاستدراج/التواصل المشبوه.'
            : 'Category gate for grooming/suspicious-contact signals.',
      },
      {
        key: 'gateSelfHarm' as DraftKey,
        section: t.sectionCategory,
        label: lang === 'ar' ? 'Gate: إيذاء النفس' : 'Gate: Self-harm',
        hint:
          lang === 'ar'
            ? 'أدنى score لقبول حالات إيذاء النفس.'
            : 'Category gate for self-harm text signals.',
      },
      {
        key: 'gateBlackmail' as DraftKey,
        section: t.sectionCategory,
        label: lang === 'ar' ? 'Gate: ابتزاز' : 'Gate: Blackmail',
        hint:
          lang === 'ar'
            ? 'أدنى score لقبول حالات الابتزاز والتهديد بالنشر.'
            : 'Category gate for extortion/blackmail text.',
      },
      {
        key: 'gateViolence' as DraftKey,
        section: t.sectionCategory,
        label: lang === 'ar' ? 'Gate: عنف/تحريض' : 'Gate: Violence/Incitement',
        hint:
          lang === 'ar'
            ? 'أدنى score لقبول تهديد/تحريض العنف نصياً.'
            : 'Category gate for violence and incitement text.',
      },
      {
        key: 'gateAdultContent' as DraftKey,
        section: t.sectionCategory,
        label: lang === 'ar' ? 'Gate: محتوى بالغين' : 'Gate: Adult content',
        hint:
          lang === 'ar'
            ? 'أدنى score لقبول إشارات النص ذات الطابع الجنسي/الإباحي.'
            : 'Category gate for adult-content text vocabulary.',
      },
      {
        key: 'gateBullying' as DraftKey,
        section: t.sectionCategory,
        label: lang === 'ar' ? 'Gate: تنمر' : 'Gate: Bullying',
        hint:
          lang === 'ar'
            ? 'أدنى score لقبول حالات التنمر والإساءة اللفظية.'
            : 'Category gate for bullying/verbal-abuse signals.',
      },
    ],
    [lang, t.sectionCategory, t.sectionSeverity]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TextThresholdDraft>;
      setDraft((prev) => normalizeTextThresholdDraft({ ...prev, ...parsed }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    if (!parentId) return;
    const unsubscribe = subscribeToChildren(parentId, (rows) => {
      setChildren(rows);
      setSelectedChildId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id || '';
      });
    });
    return () => unsubscribe();
  }, [parentId]);

  const sections = useMemo(() => {
    const unique = fields.map((f) => f.section);
    return Array.from(new Set(unique));
  }, [fields]);

  const updateField = (key: DraftKey, rawValue: string) => {
    const parsed = parseMaybeNumber(rawValue);
    if (parsed === null) return;
    setDraft((prev) => normalizeTextThresholdDraft({ ...prev, [key]: parsed }));
  };

  const payload = useMemo(
    () => ({
      severity: {
        medium: Number(asFixed(draft.severityMedium, 3)),
        high: Number(asFixed(draft.severityHigh, 3)),
        critical: Number(asFixed(draft.severityCritical, 3)),
      },
      category: {
        predator: Number(asFixed(draft.gatePredator, 3)),
        selfHarm: Number(asFixed(draft.gateSelfHarm, 3)),
        blackmail: Number(asFixed(draft.gateBlackmail, 3)),
        violence: Number(asFixed(draft.gateViolence, 3)),
        adultContent: Number(asFixed(draft.gateAdultContent, 3)),
        bullying: Number(asFixed(draft.gateBullying, 3)),
      },
      source: 'developer_lab',
      issuedAt: Date.now(),
    }),
    [draft]
  );

  const applyToSelectedChild = async () => {
    if (!selectedChildId) return;
    setBusy(true);
    setStatus('');
    try {
      await sendRemoteCommand(selectedChildId, 'setTextRuleThresholds', payload);
      setStatus(t.doneOne);
    } catch {
      setStatus(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const applyToAllChildren = async () => {
    if (!children.length) return;
    setBusy(true);
    setStatus('');
    try {
      const operations = children.map((child) =>
        sendRemoteCommand(child.id, 'setTextRuleThresholds', payload)
      );
      const settled = await Promise.allSettled(operations);
      const failed = settled.filter((result) => result.status === 'rejected').length;
      if (failed === 0) {
        setStatus(t.doneAll);
      } else {
        setStatus(`${t.failed} (${failed}/${children.length})`);
      }
    } catch {
      setStatus(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const sendRemoteReset = async () => {
    setDraft({ ...TEXT_RULE_THRESHOLD_DEFAULTS });
    if (!selectedChildId) {
      setStatus(t.resetLocalDone);
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      await sendRemoteCommand(selectedChildId, 'setTextRuleThresholds', { resetToDefault: true });
      setStatus(t.resetDone);
    } catch {
      setStatus(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const resetLocal = () => {
    setDraft({ ...TEXT_RULE_THRESHOLD_DEFAULTS });
    setStatus('');
  };

  if (!parentId) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
        {t.noParent}
      </div>
    );
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg">
      <div className="mb-4">
        <h3 className="text-xl font-black text-slate-900">{t.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-bold text-slate-600">{t.selectChild}</label>
          <select
            value={selectedChildId}
            onChange={(event) => setSelectedChildId(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
            disabled={busy || !children.length}
          >
            {!children.length && <option value="">{t.noChildren}</option>}
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name} ({child.id})
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3 flex flex-wrap items-end gap-2">
          <button
            onClick={applyToSelectedChild}
            disabled={busy || !selectedChildId}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.applyOne}
          </button>
          <button
            onClick={applyToAllChildren}
            disabled={busy || !children.length}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.applyAll}
          </button>
          <button
            onClick={resetLocal}
            disabled={busy}
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.resetLocal}
          </button>
          <button
            onClick={sendRemoteReset}
            disabled={busy}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.sendReset}
          </button>
        </div>
        {!!status && (
          <div className="md:col-span-5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            {status}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {sections.map((section) => (
          <div key={section} className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-black text-slate-900">{section}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {fields
                .filter((field) => field.section === section)
                .map((field) => {
                  const range = TEXT_RULE_THRESHOLD_RANGES[field.key];
                  const value = draft[field.key];
                  return (
                    <div key={field.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-black text-slate-800">{field.label}</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-600">{field.hint}</p>
                      <div className="mt-2 grid grid-cols-12 gap-2">
                        <input
                          type="range"
                          min={range.min}
                          max={range.max}
                          step={range.step}
                          value={value}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          className="col-span-8"
                        />
                        <input
                          type="number"
                          min={range.min}
                          max={range.max}
                          step={range.step}
                          value={asFixed(value, range.digits)}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          className="col-span-4 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <p className="mt-2 text-[10px] font-bold text-slate-500">
                        {t.range}: {range.min} - {range.max} | {t.value}: {asFixed(value, range.digits)}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TextRuleThresholdsLabCard;
