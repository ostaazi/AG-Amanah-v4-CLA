import React, { useEffect, useMemo, useState } from 'react';
import { sendRemoteCommand, subscribeToChildren } from '../services/firestoreService';
import { Child } from '../types';
import {
  VisualThresholdDraft,
  VISUAL_THRESHOLD_DEFAULTS,
  VISUAL_THRESHOLD_RANGES,
  normalizeVisualThresholdDraft,
} from '../services/modelThresholdDefaults';

interface VisualThresholdsLabCardProps {
  lang: 'ar' | 'en';
  parentId: string;
}

type DraftKey = keyof VisualThresholdDraft;

const STORAGE_KEY = 'amanah_visual_thresholds_lab_draft_v1';

const parseMaybeNumber = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asFixed = (value: number, digits: number): string => value.toFixed(digits);

const VisualThresholdsLabCard: React.FC<VisualThresholdsLabCardProps> = ({ lang, parentId }) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [draft, setDraft] = useState<VisualThresholdDraft>({ ...VISUAL_THRESHOLD_DEFAULTS });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'مختبر ضبط عتبات النماذج البصرية',
            subtitle:
              'تحكم مباشر في حساسية نماذج NSFW ومشهد العنف وخوارزمية الإصابات. كل قيمة أدناه تؤثر مباشرة على سلوك كشف جهاز الطفل.',
            noParent: 'لا يوجد معرف ولي صالح للتحكم بالأجهزة.',
            selectChild: 'الجهاز المستهدف',
            applyOne: 'تطبيق على الجهاز المحدد',
            applyAll: 'تطبيق على كل أجهزة الأطفال',
            resetLocal: 'إعادة القيم الافتراضية (محلي)',
            sendReset: 'استعادة القيم الأصلية (Default)',
            range: 'النطاق',
            value: 'القيمة',
            sectionNsfw: 'NSFW Model (Adult)',
            sectionViolence: 'Violence Scene Model',
            sectionInjury: 'Injury Heuristic',
            noChildren: 'لا توجد أجهزة أطفال مرتبطة بهذا الحساب.',
            doneOne: 'تم إرسال العتبات للجهاز بنجاح.',
            doneAll: 'تم إرسال العتبات لكل الأجهزة.',
            resetDone: 'تمت استعادة القيم الأصلية محلياً وعلى الجهاز المحدد.',
            resetLocalDone: 'تمت استعادة القيم الأصلية محلياً.',
            failed: 'تعذر إرسال الإعدادات. تحقق من الاتصال والصلاحيات.',
          }
        : {
            title: 'Visual Model Threshold Tuning Lab',
            subtitle:
              'Directly tune NSFW, violence-scene, and injury heuristic sensitivity. Every value below changes on-device child detection behavior.',
            noParent: 'No valid parent ID found for remote control.',
            selectChild: 'Target child device',
            applyOne: 'Apply to selected child',
            applyAll: 'Apply to all child devices',
            resetLocal: 'Reset local defaults',
            sendReset: 'Restore Original Defaults',
            range: 'Range',
            value: 'Value',
            sectionNsfw: 'NSFW Model (Adult)',
            sectionViolence: 'Violence Scene Model',
            sectionInjury: 'Injury Heuristic',
            noChildren: 'No child devices linked to this account.',
            doneOne: 'Threshold payload sent to selected child.',
            doneAll: 'Threshold payload sent to all children.',
            resetDone: 'Original defaults restored locally and on selected device.',
            resetLocalDone: 'Original defaults restored locally.',
            failed: 'Failed to send threshold command. Check network and permissions.',
          },
    [lang]
  );

  const fields = useMemo(
    () => [
      {
        key: 'nsfwExplicitCritical' as DraftKey,
        section: t.sectionNsfw,
        label: lang === 'ar' ? 'عتبة Explicit -> Critical' : 'Explicit -> Critical threshold',
        hint:
          lang === 'ar'
            ? 'كلما انخفضت زادت حساسية كشف الإباحية الصريحة (قد تزيد الإنذارات).'
            : 'Lower value means higher sensitivity for explicit adult content (more alerts possible).',
      },
      {
        key: 'nsfwSexyMedium' as DraftKey,
        section: t.sectionNsfw,
        label: lang === 'ar' ? 'عتبة Sexy -> Medium' : 'Sexy -> Medium threshold',
        hint:
          lang === 'ar'
            ? 'تتحكم في رصد المحتوى الإيحائي غير الصريح.'
            : 'Controls suggestive-content detection sensitivity.',
      },
      {
        key: 'violenceMedium' as DraftKey,
        section: t.sectionViolence,
        label: lang === 'ar' ? 'عتبة Violence Medium' : 'Violence Medium threshold',
        hint:
          lang === 'ar'
            ? 'الحد الأدنى لإصدار تنبيه MEDIUM من نموذج مشهد العنف.'
            : 'Minimum score for MEDIUM alert from violence-scene model.',
      },
      {
        key: 'violenceHigh' as DraftKey,
        section: t.sectionViolence,
        label: lang === 'ar' ? 'عتبة Violence High' : 'Violence High threshold',
        hint:
          lang === 'ar' ? 'الحد الأدنى لإصدار تنبيه HIGH.' : 'Minimum score for HIGH severity.',
      },
      {
        key: 'violenceCritical' as DraftKey,
        section: t.sectionViolence,
        label: lang === 'ar' ? 'عتبة Violence Critical' : 'Violence Critical threshold',
        hint:
          lang === 'ar'
            ? 'الحد الأدنى لإصدار تنبيه CRITICAL من نموذج مشهد العنف.'
            : 'Minimum score for CRITICAL severity.',
      },
      {
        key: 'violenceSafeSuppression' as DraftKey,
        section: t.sectionViolence,
        label: lang === 'ar' ? 'Safe Suppression Guard' : 'Safe suppression guard',
        hint:
          lang === 'ar'
            ? 'عندما تكون ثقة safe عالية، يمنع الإنذارات الهامشية.'
            : 'Suppresses borderline alerts when safe confidence is high.',
      },
      {
        key: 'violenceMarginGuard' as DraftKey,
        section: t.sectionViolence,
        label: lang === 'ar' ? 'Margin Guard' : 'Margin guard',
        hint:
          lang === 'ar'
            ? 'فرق الثقة المطلوب بين الخطر وsafe لتجنب الحالات الرمادية.'
            : 'Required risk-vs-safe margin to reject ambiguous outputs.',
      },
      {
        key: 'injuryFastPathScore' as DraftKey,
        section: t.sectionInjury,
        label: lang === 'ar' ? 'Fast Path Critical Gate' : 'Fast-path critical gate',
        hint:
          lang === 'ar'
            ? 'يشترط شدة عالية جداً لتفعيل مسار الإصابة المباشر.'
            : 'Requires very high injury confidence before fast-path trigger.',
      },
      {
        key: 'injuryClusterCellRatio' as DraftKey,
        section: t.sectionInjury,
        label: lang === 'ar' ? 'Cluster Cell Ratio' : 'Cluster cell ratio',
        hint:
          lang === 'ar'
            ? 'نسبة البكسلات الخطرة داخل الخلية لاعتبارها تكتل إصابة.'
            : 'Danger-pixel ratio per grid cell to mark injury cluster.',
      },
      {
        key: 'injuryMinDangerRatio' as DraftKey,
        section: t.sectionInjury,
        label: lang === 'ar' ? 'Minimum Danger Ratio' : 'Minimum danger ratio',
        hint:
          lang === 'ar'
            ? 'الحد الأدنى لنسبة البكسلات الخطرة على كامل الصورة.'
            : 'Minimum global danger-pixel ratio required for injury trigger.',
      },
      {
        key: 'injuryVarianceGuard' as DraftKey,
        section: t.sectionInjury,
        label: lang === 'ar' ? 'Variance Guard' : 'Variance guard',
        hint:
          lang === 'ar'
            ? 'يرفض الأسطح اللونية المسطحة (مثل واجهات UI) لتقليل self-false-positive.'
            : 'Rejects flat-color regions (UI-like) to reduce self false positives.',
      },
    ],
    [lang, t.sectionInjury, t.sectionNsfw, t.sectionViolence]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<VisualThresholdDraft>;
      setDraft((prev) => normalizeVisualThresholdDraft({ ...prev, ...parsed }));
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
    setDraft((prev) => normalizeVisualThresholdDraft({ ...prev, [key]: parsed }));
  };

  const payload = useMemo(
    () => ({
      nsfw: {
        explicitCritical: Number(asFixed(draft.nsfwExplicitCritical, 3)),
        sexyMedium: Number(asFixed(draft.nsfwSexyMedium, 3)),
      },
      violenceScene: {
        medium: Number(asFixed(draft.violenceMedium, 3)),
        high: Number(asFixed(draft.violenceHigh, 3)),
        critical: Number(asFixed(draft.violenceCritical, 3)),
        safeSuppression: Number(asFixed(draft.violenceSafeSuppression, 3)),
        marginGuard: Number(asFixed(draft.violenceMarginGuard, 3)),
      },
      injury: {
        fastPathScore: Number(asFixed(draft.injuryFastPathScore, 3)),
        clusterCellRatio: Number(asFixed(draft.injuryClusterCellRatio, 3)),
        minDangerRatio: Number(asFixed(draft.injuryMinDangerRatio, 3)),
        varianceGuard: Number(asFixed(draft.injuryVarianceGuard, 1)),
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
      await sendRemoteCommand(selectedChildId, 'setVisualThresholds', payload);
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
        sendRemoteCommand(child.id, 'setVisualThresholds', payload)
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
    setDraft({ ...VISUAL_THRESHOLD_DEFAULTS });
    if (!selectedChildId) {
      setStatus(t.resetLocalDone);
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      await sendRemoteCommand(selectedChildId, 'setVisualThresholds', { resetToDefault: true });
      setStatus(t.resetDone);
    } catch {
      setStatus(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const resetLocal = () => {
    setDraft({ ...VISUAL_THRESHOLD_DEFAULTS });
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
                  const range = VISUAL_THRESHOLD_RANGES[field.key];
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

export default VisualThresholdsLabCard;
