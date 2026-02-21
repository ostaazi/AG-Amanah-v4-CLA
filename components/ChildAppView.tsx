import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AmanahShield } from '../constants';
import { translations } from '../translations';
import { sendSOSAlert, subscribeToParentMessages } from '../services/firestoreService';
import { formatTimeDefault } from '../services/dateTimeFormat';
import type { ParentMessage } from '../types';

interface ChildAppViewProps {
  childName: string;
  lang: 'ar' | 'en';
  onRequestPairing?: (pairingToken: string) => Promise<boolean> | boolean;
  onRequestUnlock?: (unlockCode: string) => Promise<boolean> | boolean;
  onSendSOS?: () => Promise<void> | void;
  batteryLevel?: number;
  signalStrength?: number;
  currentScreenTime?: number;
  screenTimeLimit?: number;
  isProtectionActive?: boolean;
  parentMessages?: ParentMessage[];
  parentId?: string;
  childId?: string;
  initialDeviceLocked?: boolean;
  autoSubscribeParentMessages?: boolean;
}

const ChildAppView: React.FC<ChildAppViewProps> = ({
  childName,
  lang,
  onRequestPairing,
  onRequestUnlock,
  onSendSOS,
  batteryLevel = 85,
  signalStrength = 3,
  currentScreenTime = 0,
  screenTimeLimit = 120,
  isProtectionActive = true,
  parentMessages,
  parentId,
  childId,
  initialDeviceLocked = false,
  autoSubscribeParentMessages = true,
}) => {
  const t = translations[lang];
  const isArabic = lang === 'ar';

  const [pairingToken, setPairingToken] = useState('');
  const [pairingState, setPairingState] = useState<'idle' | 'sending' | 'linked' | 'error'>('idle');
  const [isLocked, setIsLocked] = useState(initialDeviceLocked);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockState, setUnlockState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [shellMode, setShellMode] = useState(false);
  const [calcScreen, setCalcScreen] = useState('0');
  const [liveParentMessages, setLiveParentMessages] = useState<ParentMessage[]>([]);

  // SOS cooldown state
  const [sosCooldown, setSosCooldown] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const sosCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLocked(initialDeviceLocked);
  }, [initialDeviceLocked]);

  useEffect(() => {
    if (Array.isArray(parentMessages)) return;
    if (!autoSubscribeParentMessages || !childId) {
      setLiveParentMessages([]);
      return;
    }
    return subscribeToParentMessages(childId, setLiveParentMessages);
  }, [autoSubscribeParentMessages, childId, parentMessages]);

  useEffect(() => {
    return () => {
      if (sosCooldownRef.current) {
        clearTimeout(sosCooldownRef.current);
        sosCooldownRef.current = null;
      }
    };
  }, []);

  const resolvedParentMessages = parentMessages ?? liveParentMessages;
  const pairingCode = pairingToken.replace(/\D/g, '').slice(0, 6);

  const formatMessageTime = useCallback(
    (value: unknown): string => {
      let dateValue: Date | null = null;
      if (value instanceof Date) {
        dateValue = value;
      } else if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
        dateValue = (value as any).toDate();
      } else if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          dateValue = parsed;
        }
      }

      return dateValue
        ? formatTimeDefault(dateValue, {
            includeSeconds: false,
            fallback: '',
          })
        : '';
    },
    []
  );

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
    if (pairingState === 'sending' || pairingCode.length !== 6) return;
    setPairingState('sending');
    try {
      const approved = onRequestPairing
        ? await onRequestPairing(pairingCode)
        : pairingCode.length === 6;
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

  const handleSOS = useCallback(async () => {
    if (sosCooldown) return;
    setSosCooldown(true);
    setSosSent(true);
    try {
      if (onSendSOS) {
        await onSendSOS();
      } else if (parentId && childId) {
        await sendSOSAlert(parentId, childId, childName);
      }
    } catch (error) {
      console.error('SOS failed', error);
    }
    sosCooldownRef.current = setTimeout(() => {
      setSosCooldown(false);
      setSosSent(false);
    }, 60000);
  }, [childId, childName, onSendSOS, parentId, sosCooldown]);

  const appendCalc = (value: string) => {
    setCalcScreen((prev) => (prev === '0' ? value : `${prev}${value}`));
  };

  const clearCalc = () => {
    setCalcScreen('0');
  };

  const lockMessage = isArabic
    ? 'هذا الجهاز مقيد مؤقتًا بقرار الحماية.'
    : 'This device is temporarily restricted by safety policy.';

  const remainingMinutes = Math.max(0, screenTimeLimit - currentScreenTime);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMins = remainingMinutes % 60;
  const screenTimeDisplay = remainingHours > 0
    ? `${remainingHours}${isArabic ? 'س' : 'h'} ${remainingMins}${isArabic ? 'د' : 'm'}`
    : `${remainingMins}${isArabic ? ' دقيقة' : ' min'}`;

  const signalLabel = signalStrength >= 3
    ? (isArabic ? 'ممتاز' : 'Strong')
    : signalStrength >= 2
      ? (isArabic ? 'متوسط' : 'Medium')
      : (isArabic ? 'ضعيف' : 'Weak');

  const batteryColor = batteryLevel > 50 ? 'text-emerald-400' : batteryLevel > 20 ? 'text-amber-400' : 'text-red-400';

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#3A0715] via-[#8A1538] to-[#3A0715] flex flex-col items-center justify-start p-6 md:p-10 text-white relative overflow-hidden"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_20%,rgba(212,168,75,0.12)_0%,rgba(15,23,42,0)_55%)]" />

      {/* Lock overlay */}
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
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitUnlock();
              }}
              placeholder={isArabic ? 'رمز فك القفل' : 'Unlock code'}
              className="w-full h-12 rounded-xl px-4 bg-white/5 border border-white/20 text-center font-black outline-none"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={submitUnlock}
              className="w-full h-12 rounded-xl bg-[#8A1538] hover:bg-[#B83A60] transition-colors font-black"
            >
              {isArabic ? 'طلب فك القفل' : 'Request Unlock'}
            </button>
            <p className="text-xs font-bold text-slate-400">{unlockHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setShellMode((prev) => !prev)}
            className="text-[11px] font-black text-[#D4A84B] underline underline-offset-4"
          >
            {shellMode
              ? isArabic ? 'إخفاء وضع الواجهة البديلة' : 'Hide shell mode'
              : isArabic ? 'إظهار وضع الواجهة البديلة' : 'Show shell mode'}
          </button>
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl space-y-6 animate-in fade-in duration-700">
        {/* Header */}
        <div className="text-center space-y-3 pt-4">
          <div className="relative w-28 h-28 mx-auto">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#D4A84B]/20 to-[#D4A84B]/5 backdrop-blur-sm border border-[#D4A84B]/30 shadow-[0_0_40px_rgba(212,168,75,0.15)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <AmanahShield className="w-16 h-16 animate-shield-breathing" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#D4A84B] drop-shadow-[0_2px_10px_rgba(212,168,75,0.3)]">{t.childModeTitle}</h1>
          <p className="text-white/80 font-bold text-sm">{t.childStatusSafe}</p>
          <p className="text-sm font-black text-white/70">
            {isArabic ? 'مرحبًا' : 'Hello'} {childName}
          </p>
        </div>

        {/* SOS Emergency Button */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-sm">
            {!sosCooldown && (
              <div className="absolute -inset-1 rounded-[1.2rem] bg-red-500/30 animate-pulse blur-md" />
            )}
            <button
              type="button"
              onClick={handleSOS}
              disabled={sosCooldown}
              className={`relative w-full h-16 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${
                sosCooldown
                  ? 'bg-gray-600/60 text-gray-300 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-red-700 via-red-600 to-red-700 hover:from-red-600 hover:via-red-500 hover:to-red-600 active:scale-95 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)]'
              }`}
            >
              {!sosCooldown && (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              )}
              {sosSent
                ? t.sosSent
                : sosCooldown
                  ? t.sosCooldown
                  : t.sosButton}
            </button>
          </div>
        </div>

        {/* Device Status Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DeviceStatusCard
            icon={
              <svg className={`w-6 h-6 ${batteryColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="6" width="18" height="12" rx="2" />
                <path d="M22 10v4" />
                <rect x="4" y="8" width={Math.round((batteryLevel / 100) * 14)} height="8" rx="1" fill="currentColor" opacity="0.6" />
              </svg>
            }
            label={t.batteryLevel}
            value={`${batteryLevel}%`}
            valueColor={batteryColor}
          />
          <DeviceStatusCard
            icon={
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12.55a11 11 0 0 1 14.08 0" opacity={signalStrength >= 1 ? 1 : 0.3} />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" opacity={signalStrength >= 2 ? 1 : 0.3} />
                <circle cx="12" cy="20" r="1" fill="currentColor" opacity={signalStrength >= 1 ? 1 : 0.3} />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" opacity={signalStrength >= 3 ? 1 : 0.3} />
              </svg>
            }
            label={t.connectionStatus}
            value={signalLabel}
            valueColor="text-blue-400"
          />
          <DeviceStatusCard
            icon={
              <svg className="w-6 h-6 text-[#D4A84B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            label={t.screenTimeRemaining}
            value={screenTimeDisplay}
            valueColor="text-[#D4A84B]"
          />
          <DeviceStatusCard
            icon={
              <svg className={`w-6 h-6 ${isProtectionActive ? 'text-emerald-400' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                {isProtectionActive && <polyline points="9 12 11 14 15 10" />}
                {!isProtectionActive && <><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></>}
              </svg>
            }
            label={t.protectionStatus}
            value={isProtectionActive ? (isArabic ? 'نشطة' : 'Active') : (isArabic ? 'متوقفة' : 'Inactive')}
            valueColor={isProtectionActive ? 'text-emerald-400' : 'text-red-400'}
          />
        </section>

        {/* Device Pairing */}
        <section className="bg-white/[0.08] backdrop-blur-sm border border-[#D4A84B]/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black flex items-center gap-2">
              <svg className="w-5 h-5 text-[#D4A84B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.914-3.022L16.5 2.561a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" />
              </svg>
              {isArabic ? 'ربط الجهاز' : 'Device Pairing'}
            </h3>
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
              value={pairingCode}
              onChange={(e) => {
                setPairingToken(e.target.value);
                setPairingState('idle');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitPairing();
              }}
              placeholder={isArabic ? 'رمز الربط' : 'Pairing token'}
              className="flex-1 h-12 rounded-xl px-4 bg-black/30 border border-white/20 font-black outline-none focus:border-[#D4A84B]/60 focus:ring-1 focus:ring-[#D4A84B]/30 transition-all"
              inputMode="numeric"
              maxLength={6}
            />
            <button
              type="button"
              onClick={submitPairing}
              disabled={pairingState === 'sending' || pairingCode.length !== 6}
              className="h-12 px-8 rounded-xl bg-gradient-to-r from-[#D4A84B] to-[#C69126] text-[#3A0715] font-black hover:from-[#e0ba5e] hover:to-[#D4A84B] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(212,168,75,0.25)]"
            >
              {isArabic ? 'إرسال' : 'Pair'}
            </button>
          </div>
          <p className="text-xs font-bold text-white/60">{pairingHint}</p>
        </section>

        {/* Parent Messages */}
        <section className="bg-white/[0.08] backdrop-blur-sm border border-[#D4A84B]/20 rounded-2xl p-5 space-y-4">
          <h3 className="text-lg font-black text-[#D4A84B] flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {t.parentMessages}
          </h3>
          {resolvedParentMessages.length === 0 ? (
            <p className="text-sm text-white/50 font-bold text-center py-4">{t.noMessages}</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {resolvedParentMessages.slice(0, 5).map((msg, idx) => (
                <div key={msg.id} className={`bg-white/5 rounded-xl p-3 transition-all ${idx === 0 ? 'border border-[#D4A84B]/30 shadow-[0_0_15px_rgba(212,168,75,0.08)]' : 'border border-white/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#D4A84B]">{msg.senderName}</span>
                    <span className="text-[10px] text-white/40">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-sm text-white/80">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Protection Actions + Status/Shell */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/[0.08] backdrop-blur-sm border border-[#D4A84B]/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-black text-[#D4A84B] uppercase tracking-widest">
              {isArabic ? 'أوامر الحماية' : 'Protection Actions'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsLocked(true)}
                className="h-12 rounded-xl bg-red-600/80 hover:bg-red-600 transition-colors font-black text-sm"
              >
                {isArabic ? 'قفل الشاشة' : 'Lock screen'}
              </button>
              <button
                type="button"
                onClick={() => setShellMode((prev) => !prev)}
                className="h-12 rounded-xl bg-black/30 border border-white/15 font-black text-sm hover:bg-black/40 transition-colors"
              >
                {shellMode
                  ? isArabic ? 'إيقاف التمويه' : 'Disable shell'
                  : isArabic ? 'تفعيل التمويه' : 'Enable shell'}
              </button>
            </div>
            <p className="text-xs font-bold text-white/50">
              {isArabic
                ? 'يدعم هذا النموذج ربط الجهاز، قفل الشاشة، ومسار فك القفل.'
                : 'This flow supports pairing, lock screen, and unlock request.'}
            </p>
          </div>

          <div className="bg-white/[0.08] backdrop-blur-sm border border-[#D4A84B]/20 rounded-2xl p-5">
            {!shellMode ? (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[#D4A84B] uppercase tracking-widest">
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
                <h3 className="text-sm font-black text-[#D4A84B] uppercase tracking-widest">
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
                      className="h-10 rounded-lg bg-black/30 border border-white/10 font-black hover:bg-black/50 transition-colors"
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

        {/* Footer */}
        <div className="pt-2 pb-6 text-center flex flex-col items-center gap-2">
          <AmanahShield className="w-6 h-6 opacity-30" animate={false} />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">
            Amanah Child Agent v4
          </p>
        </div>
      </div>
    </div>
  );
};

const DeviceStatusCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
}> = ({ icon, label, value, valueColor }) => (
  <div className="bg-white/[0.08] backdrop-blur-sm border border-[#D4A84B]/20 rounded-2xl p-4 flex flex-col items-center space-y-1.5 hover:bg-white/[0.12] hover:border-[#D4A84B]/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,168,75,0.1)]">
    {icon}
    <p className="text-[10px] font-black text-white/50 uppercase tracking-wider">{label}</p>
    <p className={`text-base font-black ${valueColor}`}>{value}</p>
  </div>
);

const StatusTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-gradient-to-br from-black/30 to-black/10 border border-white/10 p-3 hover:border-[#D4A84B]/20 transition-all duration-300">
    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{label}</p>
    <p className="text-sm font-black text-white mt-1">{value}</p>
  </div>
);

export default ChildAppView;
