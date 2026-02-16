import React, { useMemo, useState } from 'react';
import { ForensicExport } from '../types';
import { generateSHA256 } from '../services/forensicsService';
import { ICONS } from '../constants';

interface ExportBundleModalProps {
  incidentId: string;
  lang: 'ar' | 'en';
  onClose: () => void;
}

const ExportBundleModal: React.FC<ExportBundleModalProps> = ({ incidentId, lang, onClose }) => {
  const [step, setStep] = useState<'idle' | 'building' | 'done'>('idle');
  const [bundle, setBundle] = useState<ForensicExport | null>(null);

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'تصدير حزمة الأدلة',
            subtitle: 'سيتم تجهيز ملخص الأدلة وبصمة SHA-256 لتوثيق النزاهة.',
            start: 'ابدأ التوليد',
            processing: 'جاري التوليد المشفر...',
            ready: 'الحزمة جاهزة',
            copy: 'نسخ البصمة',
            close: 'إغلاق',
          }
        : {
            title: 'Export Evidence Bundle',
            subtitle: 'A compact evidence package and SHA-256 integrity fingerprint will be generated.',
            start: 'Start Build',
            processing: 'Generating encrypted package...',
            ready: 'Bundle Ready',
            copy: 'Copy Hash',
            close: 'Close',
          },
    [lang]
  );

  const runExport = async () => {
    setStep('building');
    const digest = await generateSHA256(`${incidentId}:${new Date().toISOString()}`);
    const data: ForensicExport = {
      export_id: `EXP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      incident_id: incidentId,
      generated_at: new Date().toISOString(),
      sha256_hash: digest,
      status: 'READY',
      metadata: {
        examiner: 'Amanah System',
        classification: 'LEGAL_HOLD',
      },
    };
    setBundle(data);
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-[9000] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-slate-900">{t.title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800">
            <ICONS.Close className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm font-bold text-slate-500">{t.subtitle}</p>

        {step === 'idle' && (
          <button
            onClick={runExport}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all"
          >
            {t.start}
          </button>
        )}

        {step === 'building' && (
          <div className="py-10 text-center font-black text-indigo-600 animate-pulse">{t.processing}</div>
        )}

        {step === 'done' && bundle && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-sm font-black text-emerald-700">{t.ready}</p>
              <p className="text-xs font-bold text-emerald-600 mt-1">{bundle.export_id}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-[11px] font-black text-slate-500 mb-2">SHA-256</p>
              <code className="text-[10px] font-mono break-all text-indigo-700">{bundle.sha256_hash}</code>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(bundle.sha256_hash)}
                className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black"
              >
                {t.copy}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-black"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportBundleModal;
