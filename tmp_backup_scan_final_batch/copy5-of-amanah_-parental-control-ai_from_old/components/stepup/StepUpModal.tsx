
'use client';

import React, { useEffect, useState } from 'react';
import { ICONS, AmanahShield } from '../../constants';

type Props = {
  familyId: string;
  purpose: string;
  scopes: string[];
  open: boolean;
  onClose: () => void;
  onVerified: (token: string) => void;
};

export default function StepUpModal({ familyId, purpose, scopes, open, onClose, onVerified }: Props) {
  const [stepupId, setStepupId] = useState('');
  const [otpDev, setOtpDev] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    initiateSession();
  }, [open]);

  const initiateSession = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/step-up/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, purpose, scopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'فشل تهيئة جلسة التحقق');
      setStepupId(data.stepupId);
      setOtpDev(data.otp_dev_only);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (code.length < 6) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/step-up/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepupId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'الرمز غير صحيح');
      onVerified(data.token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl animate-in fade-in p-6" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-[4rem] shadow-[0_0_100px_rgba(138,21,56,0.3)] overflow-hidden border-4 border-white animate-in zoom-in-95">
        <div className="bg-[#8A1538] p-12 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
          <div className="relative z-10 space-y-6">
             <div className="w-24 h-24 bg-white/20 rounded-[2.5rem] mx-auto flex items-center justify-center border-2 border-white/30 shadow-2xl">
                <AmanahShield className="w-14 h-14" animate />
             </div>
             <h3 className="text-3xl font-black tracking-tighter">مصادقة السيادة</h3>
             <p className="text-red-100/70 text-xs font-bold leading-relaxed px-4">
                أنت تحاول تنفيذ إجراء حرج: <span className="text-white">"{purpose}"</span>. <br/> يرجى إدخال الرمز السري للمتابعة.
             </p>
          </div>
        </div>

        <div className="p-12 space-y-8">
           {otpDev && (
             <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-3xl text-center">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Developer OTP Access</p>
                <code className="text-3xl font-black text-indigo-700 tracking-[0.4em]">{otpDev}</code>
             </div>
           )}

           <div className="space-y-4">
              <input 
                type="password" maxLength={6} autoFocus value={code} 
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] outline-none font-black text-center text-4xl tracking-[0.5em] focus:border-[#8A1538] transition-all shadow-inner"
                placeholder="••••••"
                disabled={busy}
              />
              {error && <p className="text-red-600 text-xs font-black text-center animate-shake">⚠️ {error}</p>}
           </div>

           <div className="flex flex-col gap-4">
              <button 
                onClick={handleVerify}
                disabled={busy || code.length < 6}
                className="w-full py-7 bg-slate-950 text-white rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                {busy ? 'جاري التحقق...' : 'إثبات الهوية السيادية'}
              </button>
              <button onClick={onClose} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">إلغاء العملية</button>
           </div>
        </div>

        <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-center items-center gap-3">
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">SECURE STEP-UP PROTOCOL V2.1 // SCOPES_BOUND: TRUE</p>
        </div>
      </div>
    </div>
  );
}
