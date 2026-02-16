
'use client';

import React, { useState, useEffect } from 'react';
import { ICONS, AmanahShield } from '../../constants';

interface StepUpGuardProps {
  isOpen: boolean;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

export default function StepUpGuard({ isOpen, onSuccess, onCancel }: StepUpGuardProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/step-up/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret_code: code })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error?.message || 'فشل التحقق من الهوية');

      onSuccess(data.step_up_token);
      setCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-[0_0_100px_rgba(138,21,56,0.3)] overflow-hidden border-4 border-white animate-in zoom-in-95">
        <div className="bg-[#8A1538] p-10 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="relative z-10 space-y-6">
            <div className="w-20 h-20 bg-white/20 rounded-3xl mx-auto flex items-center justify-center border-2 border-white/30 shadow-xl">
               <AmanahShield className="w-12 h-12" animate />
            </div>
            <h3 className="text-3xl font-black tracking-tighter">تأكيد الهوية السيادية</h3>
            <p className="text-red-100/70 text-xs font-bold leading-relaxed px-4">
              أنت تحاول تنفيذ إجراء حساس. يرجى إدخال رمز الأمان الخاص بك للمتابعة.
            </p>
          </div>
        </div>

        <div className="p-10 space-y-8">
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">رمز الأمان (Security Pin)</label>
              <input 
                type="password" 
                autoFocus
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="••••••"
                className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-center text-3xl tracking-[0.5em] focus:border-[#8A1538] transition-all shadow-inner"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-black text-center animate-shake">
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading || code.length < 4}
              className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {loading ? 'جاري التحقق...' : 'تأكيد الصلاحية'}
            </button>
          </form>

          <button 
            onClick={onCancel}
            className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            إلغاء العملية
          </button>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-100">
           <p className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-tighter">
             SECURE STEP-UP PROTOCOL V1.0 // SESSION_BOUND_TOKEN: ENABLED
           </p>
        </div>
      </div>
    </div>
  );
}
