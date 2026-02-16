import React, { useEffect, useMemo, useState } from 'react';
import { PairingRequest, ParentAccount } from '../types';

interface DeviceEnrollmentViewProps {
  lang: 'ar' | 'en';
  currentUser: ParentAccount;
  requests: PairingRequest[];
  onRotatePairingKey: () => Promise<string | undefined>;
  onApprove: (request: PairingRequest) => Promise<void> | void;
  onReject: (requestId: string) => Promise<void> | void;
}

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      const parsed = maybeTimestamp.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
};

const DeviceEnrollmentView: React.FC<DeviceEnrollmentViewProps> = ({
  lang,
  currentUser,
  requests,
  onRotatePairingKey,
  onApprove,
  onReject,
}) => {
  const [isRotating, setIsRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expiryDate = useMemo(
    () => asDate(currentUser.pairingKeyExpiresAt),
    [currentUser.pairingKeyExpiresAt]
  );
  const remainingSec = useMemo(() => {
    if (!expiryDate) return 0;
    return Math.max(0, Math.floor((expiryDate.getTime() - nowMs) / 1000));
  }, [expiryDate, nowMs]);
  const isExpired = remainingSec <= 0;
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');

  const t = {
    title: lang === 'ar' ? 'ربط الأجهزة' : 'Device Enrollment',
    subtitle:
      lang === 'ar'
        ? 'أدر رمز الربط ووافق على طلبات الأجهزة الجديدة'
        : 'Manage pairing key and pending child-device requests',
    pairingKey: lang === 'ar' ? 'رمز الربط' : 'Pairing Key',
    rotate: lang === 'ar' ? 'تدوير الرمز الآن' : 'Rotate Key Now',
    copy: lang === 'ar' ? 'نسخ' : 'Copy',
    copied: lang === 'ar' ? 'تم النسخ' : 'Copied',
    expiresIn: lang === 'ar' ? 'ينتهي خلال' : 'Expires In',
    expired: lang === 'ar' ? 'منتهي' : 'Expired',
    pending: lang === 'ar' ? 'طلبات الربط المعلقة' : 'Pending Enrollment Requests',
    approve: lang === 'ar' ? 'موافقة' : 'Approve',
    reject: lang === 'ar' ? 'رفض' : 'Reject',
    empty: lang === 'ar' ? 'لا توجد طلبات معلقة.' : 'No pending requests.',
    rotateLoading: lang === 'ar' ? 'جارٍ التدوير...' : 'Rotating...',
  };

  const copyKey = async () => {
    if (!currentUser.pairingKey) return;
    try {
      await navigator.clipboard.writeText(currentUser.pairingKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const rotateKey = async () => {
    setIsRotating(true);
    try {
      await onRotatePairingKey();
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="bg-slate-900 text-white p-8 rounded-[3rem] border-b-4 border-indigo-500">
        <h2 className="text-3xl font-black tracking-tight">{t.title}</h2>
        <p className="text-indigo-200 font-bold mt-2">{t.subtitle}</p>
      </section>

      <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 space-y-6">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-4">
          <p className="text-sm font-black text-slate-500">{t.pairingKey}</p>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div className="text-3xl tracking-[0.35em] font-black text-indigo-700">
              {currentUser.pairingKey || '------'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyKey}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-black bg-white"
              >
                {copied ? t.copied : t.copy}
              </button>
              <button
                onClick={rotateKey}
                disabled={isRotating}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50"
              >
                {isRotating ? t.rotateLoading : t.rotate}
              </button>
            </div>
          </div>
          <p className="text-xs font-black text-slate-500">
            {t.expiresIn}: {isExpired ? t.expired : `${mm}:${ss}`}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-black text-slate-800">{t.pending}</h3>
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-slate-400 font-black">
              {t.empty}
            </div>
          ) : (
            requests.map((request) => (
              <article
                key={request.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="font-black text-slate-900">{request.childName}</p>
                  <p className="text-xs font-bold text-slate-500">{request.model} • {request.os}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(request)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black"
                  >
                    {t.approve}
                  </button>
                  <button
                    onClick={() => onReject(request.id)}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black"
                  >
                    {t.reject}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DeviceEnrollmentView;
