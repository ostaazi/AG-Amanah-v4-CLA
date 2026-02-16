import React, { useEffect, useMemo, useState } from 'react';
import { ICONS } from '../../constants';
import { StepUpSession } from '../../types';

interface StepUpModalProps {
  isOpen: boolean;
  lang: 'ar' | 'en';
  reason: StepUpSession['reason'];
  isBusy: boolean;
  error: string | null;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
}

const reasonLabel = (
  reason: StepUpSession['reason'],
  lang: 'ar' | 'en'
): string => {
  const mapAr: Record<StepUpSession['reason'], string> = {
    LOCKDOWN: 'تنفيذ الإغلاق الطارئ',
    DELETE_EVIDENCE: 'حذف دليل جنائي',
    EXPORT_EVIDENCE: 'تصدير حزمة أدلة',
    SENSITIVE_SETTINGS: 'تعديل إعدادات حساسة',
  };
  const mapEn: Record<StepUpSession['reason'], string> = {
    LOCKDOWN: 'Emergency Lockdown',
    DELETE_EVIDENCE: 'Delete Evidence',
    EXPORT_EVIDENCE: 'Export Evidence',
    SENSITIVE_SETTINGS: 'Sensitive Settings Change',
  };
  return lang === 'ar' ? mapAr[reason] : mapEn[reason];
};

const StepUpModal: React.FC<StepUpModalProps> = ({
  isOpen,
  lang,
  reason,
  isBusy,
  error,
  onClose,
  onVerify,
}) => {
  const [code, setCode] = useState('');
  const isArabic = lang === 'ar';
  const title = useMemo(
    () => (isArabic ? 'تحقق إضافي قبل المتابعة' : 'Additional Verification Required'),
    [isArabic]
  );
  const subtitle = useMemo(
    () =>
      isArabic
        ? 'أدخل رمز المصادقة الثنائية (2FA) لإتمام الإجراء.'
        : 'Enter your two-factor authentication (2FA) code to continue.',
    [isArabic]
  );

  useEffect(() => {
    if (!isOpen) {
      setCode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9500] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <h3 className="text-xl font-black text-slate-900">{title}</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-700 disabled:opacity-50"
            aria-label={isArabic ? 'إغلاق' : 'Close'}
          >
            <ICONS.Close className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-[11px] font-black text-indigo-700 uppercase tracking-widest">
            {isArabic ? 'السبب' : 'Reason'}
          </p>
          <p className="text-sm font-black text-indigo-900 mt-1">{reasonLabel(reason, lang)}</p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
            {isArabic ? 'رمز التحقق (6 أرقام)' : 'Verification Code (6 digits)'}
          </label>
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-center text-2xl tracking-[0.25em] font-black outline-none focus:ring-4 focus:ring-indigo-100"
            placeholder="000000"
            dir="ltr"
          />
          {error && <p className="text-xs font-black text-red-600 text-right">{error}</p>}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onVerify(code)}
            disabled={isBusy || code.length !== 6}
            className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-black text-sm disabled:opacity-50"
          >
            {isBusy
              ? isArabic
                ? 'جاري التحقق...'
                : 'Verifying...'
              : isArabic
                ? 'تحقق ومتابعة'
                : 'Verify & Continue'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex-1 h-12 rounded-xl bg-slate-100 text-slate-700 font-black text-sm disabled:opacity-50"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepUpModal;
