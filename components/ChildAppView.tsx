import React, { useMemo, useState } from 'react';
import { AmanahShield } from '../constants';
import { translations } from '../translations';

interface ChildAppViewProps {
  childName: string;
  lang: 'ar' | 'en';
  onRequestPairing?: (pairingToken: string) => Promise<boolean> | boolean;
  onRequestUnlock?: (unlockCode: string) => Promise<boolean> | boolean;
}

const ChildAppView: React.FC<ChildAppViewProps> = ({
  childName,
  lang,
  onRequestPairing,
  onRequestUnlock,
}) => {
  const t = translations[lang];
  const isArabic = lang === 'ar';

  const [pairingToken, setPairingToken] = useState('');
  const [pairingState, setPairingState] = useState<'idle' | 'sending' | 'linked' | 'error'>('idle');
  const [isLocked, setIsLocked] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockState, setUnlockState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [shellMode, setShellMode] = useState(false);
  const [calcScreen, setCalcScreen] = useState('0');

  const pairingHint = useMemo(() => {
    if (pairingState === 'sending') return isArabic ? 'جاري إرسال طلب الربط...' : 'Sending pairing request...';
    if (pairingState === 'linked') return isArabic ? 'تم ربط الجهاز بنجاح.' : 'Device paired successfully.';
    if (pairingState === 'error') return isArabic ? 'فشل الربط. راجع الرمز وحاول مجددًا.' : 'Pairing failed. Check token and retry.';
    return isArabic ? 'أدخل رمز الربط من لوحة الوالد.' : 'Enter the pairing token from parent console.';
  }, [isArabic, pairingState]);

  const unlockHint = useMemo(() => {
    if (unlockState === 'sending') return isArabic ? 'جاري التحقق...' : 'Verifying...';
    if (unlockState === 'ok') return isArabic ? 'تم فك القفل.' : 'Device unlocked.';
    if (unlockState === 'error') return isArabic ? 'رمز غير صحيح أو مرفوض.' : 'Invalid or rejected code.';
    return isArabic ? 'يمكن للوالد إرسال رمز فك القفل عند الضرورة.' : 'Parent can provide an unlock code when needed.';
  }, [isArabic, unlockState]);

  const submitPairing = async () => {
    if (!pairingToken.trim() || pairingState === 'sending') return;
    setPairingState('sending');
    try {
      const approved = onRequestPairing
        ? await onRequestPairing(pairingToken.trim())
        : pairingToken.trim().length >= 6;
      setPairingState(approved ? 'linked' : 'error');
    } catch (error) {
      console.error('Pairing request failed', error);
      setPairingState('error');
    }
  };

  const submitUnlock = async () => {
    if (!unlockCode.trim() || unlockState === 'sending') return;
    setUnlockState('sending');
    try {
      const approved = onRequestUnlock
        ? await onRequestUnlock(unlockCode.trim())
        : unlockCode.trim() === '1234';
      if (approved) {
        setIsLocked(false);
        setUnlockState('ok');
        setUnlockCode('');
      } else {
        setUnlockState('error');
      }
    } catch (error) {
      console.error('Unlock request failed', error);
      setUnlockState('error');
    }
  };

  const appendCalc = (value: string) => {
    setCalcScreen((prev) => (prev === '0' ? value : `${prev}${value}`));
  };

  const clearCalc = () => {
    setCalcScreen('0');
  };

  const lockMessage = isArabic
    ? 'هذا الجهاز مقيد مؤقتًا بقرار الحماية.'
    : 'This device is temporarily restricted by safety policy.';

  return (
    <div
      className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-6 md:p-10 text-white relative overflow-hidden"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_25%,rgba(99,102,241,0.25)_0%,rgba(15,23,42,0)_55%)]" />

      {isLocked && (
        <div className="fixed inset-0 z-[70] bg-black/95 text-white flex flex-col items-center justify-center p-8 text-center space-y-6">
          <AmanahShield className="w-24 h-24" />
          <h2 className="text-3xl font-black">{isArabic ? 'الجهاز مقفل' : 'Device Locked'}</h2>
          <p className="text-sm font-bold text-slate-300 max-w-sm">{lockMessage}</p>
          <div className="w-full max-w-sm space-y-3">
            <input
              type="password"
              value={unlockCode}
              onChange={(e) => {
                setUnlockCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                setUnlockState('idle');
              }}
              placeholder={isArabic ? 'رمز فك القفل' : 'Unlock code'}
              className="w-full h-12 rounded-xl px-4 bg-white/5 border border-white/20 text-center font-black outline-none"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={submitUnlock}
              className="w-full h-12 rounded-xl bg-indigo-600 font-black"
            >
              {isArabic ? 'طلب فك القفل' : 'Request Unlock'}
            </button>
            <p className="text-xs font-bold text-slate-400">{unlockHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setShellMode((prev) => !prev)}
            className="text-[11px] font-black text-indigo-300 underline underline-offset-4"
          >
            {shellMode
              ? isArabic
                ? 'إخفاء وضع الواجهة البديلة'
                : 'Hide shell mode'
              : isArabic
                ? 'إظهار وضع الواجهة البديلة'
                : 'Show shell mode'}
          </button>
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl space-y-8 animate-in fade-in duration-700">
        <div className="text-center space-y-3">
          <div className="w-28 h-28 mx-auto bg-white/10 rounded-[2.5rem] border border-white/20 flex items-center justify-center shadow-2xl">
            <AmanahShield className="w-16 h-16" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">{t.childModeTitle}</h1>
          <p className="text-indigo-200 font-bold">{t.childStatusSafe}</p>
          <p className="text-sm font-black text-white/80">
            {isArabic ? 'مرحبًا' : 'Hello'} {childName}
          </p>
        </div>

        <section className="bg-white/10 border border-white/15 rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">{isArabic ? 'ربط الجهاز' : 'Device Pairing'}</h3>
            <span
              className={`text-[10px] px-3 py-1 rounded-full font-black ${
                pairingState === 'linked' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-white/80'
              }`}
            >
              {pairingState === 'linked' ? (isArabic ? 'مرتبط' : 'Linked') : isArabic ? 'غير مرتبط' : 'Not linked'}
            </span>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={pairingToken}
              onChange={(e) => {
                setPairingToken(e.target.value.toUpperCase().slice(0, 12));
                setPairingState('idle');
              }}
              placeholder={isArabic ? 'رمز الربط' : 'Pairing token'}
              className="flex-1 h-12 rounded-xl px-4 bg-slate-900/40 border border-white/20 font-black outline-none"
            />
            <button
              type="button"
              onClick={submitPairing}
              className="h-12 px-6 rounded-xl bg-indigo-600 font-black"
            >
              {isArabic ? 'إرسال' : 'Pair'}
            </button>
          </div>
          <p className="text-xs font-bold text-indigo-100">{pairingHint}</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/10 border border-white/15 rounded-[2rem] p-5 space-y-4">
            <h3 className="text-sm font-black text-indigo-200 uppercase tracking-widest">
              {isArabic ? 'أوامر الحماية' : 'Protection Actions'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsLocked(true)}
                className="h-12 rounded-xl bg-red-600/80 font-black text-sm"
              >
                {isArabic ? 'قفل الشاشة' : 'Lock screen'}
              </button>
              <button
                type="button"
                onClick={() => setShellMode((prev) => !prev)}
                className="h-12 rounded-xl bg-slate-900/60 border border-white/15 font-black text-sm"
              >
                {shellMode
                  ? isArabic
                    ? 'إيقاف التمويه'
                    : 'Disable shell'
                  : isArabic
                    ? 'تفعيل التمويه'
                    : 'Enable shell'}
              </button>
            </div>
            <p className="text-xs font-bold text-white/70">
              {isArabic
                ? 'يدعم هذا النموذج ربط الجهاز، قفل الشاشة، ومسار فك القفل.'
                : 'This flow supports pairing, lock screen, and unlock request.'}
            </p>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-[2rem] p-5">
            {!shellMode ? (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-indigo-200 uppercase tracking-widest">
                  {isArabic ? 'الحالة الذكية' : 'Smart Status'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatusTile label={isArabic ? 'Walkie Talkie' : 'Walkie Talkie'} value={isArabic ? 'جاهز' : 'Ready'} />
                  <StatusTile label={isArabic ? 'البث المباشر' : 'Live Stream'} value={isArabic ? 'عند الطلب' : 'On demand'} />
                  <StatusTile label={isArabic ? 'مراقبة الموقع' : 'Geo Monitor'} value={isArabic ? 'نشطة' : 'Active'} />
                  <StatusTile label={isArabic ? 'قفل طارئ' : 'Emergency Lock'} value={isLocked ? (isArabic ? 'نشط' : 'Active') : (isArabic ? 'غير نشط' : 'Idle')} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-indigo-200 uppercase tracking-widest">
                  {isArabic ? 'واجهة تمويه (آلة حاسبة)' : 'Shell Mode (Calculator)'}
                </h3>
                <div className="h-14 rounded-xl bg-black/50 border border-white/20 px-4 flex items-center justify-end text-2xl font-black">
                  <span dir="ltr">{calcScreen}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => appendCalc(digit)}
                      className="h-10 rounded-lg bg-slate-900/50 border border-white/10 font-black"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearCalc}
                    className="h-10 rounded-lg bg-red-600/80 font-black col-span-2"
                  >
                    {isArabic ? 'مسح' : 'Clear'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="pt-2 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">
            Amanah Child Agent v2
          </p>
        </div>
      </div>
    </div>
  );
};

const StatusTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-900/35 border border-white/10 p-3">
    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
    <p className="text-sm font-black text-white mt-1">{value}</p>
  </div>
);

export default ChildAppView;
