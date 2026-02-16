
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AmanahShield } from '../constants';

const ChildAppView: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const [setupStep, setSetupStep] = useState<'AUTH' | 'INSTALLING' | 'GUIDE' | 'CALC'>('AUTH');
  const [pairingToken, setPairingToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('');
  const [calcHistory, setCalcHistory] = useState<string[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  const location = useLocation();
  const UNLOCK_CODE = '1982'; 

  // محاكاة إرسال نبضات الأمان للخادم
  useEffect(() => {
    if (setupStep === 'CALC') {
        const interval = setInterval(() => {
            console.log("Amanah Guard: Syncing active device logs...");
        }, 15000);
        return () => clearInterval(interval);
    }
  }, [setupStep]);

  const hapticFeedback = () => {
    if ("vibrate" in navigator) {
        navigator.vibrate(10);
    }
  };

  const handleVerifyToken = useCallback(async (tokenToVerify?: string) => {
    const targetToken = tokenToVerify || pairingToken;
    if (targetToken.length < 6) return;
    setIsVerifying(true);
    setTimeout(() => {
      setSetupStep('INSTALLING');
      setTimeout(() => setSetupStep('GUIDE'), 2000);
    }, 1500);
  }, [pairingToken]);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) setSetupStep('CALC');

    const params = new URLSearchParams(location.search);
    const t = params.get('t');
    if (t && t.length === 6) {
      setPairingToken(t);
      handleVerifyToken(t);
    }
  }, [location.search, handleVerifyToken]);

  const handleCalcClick = (val: string) => {
    hapticFeedback();
    if (val === 'AC') {
        setCalcDisplay('');
        setCalcHistory([]);
    }
    else if (val === '=') {
      if (calcDisplay === UNLOCK_CODE) {
          setIsUnlocked(true);
      } else {
          try {
              // استخدام وظيفة تقييم آمنة للعمليات الحسابية
              const res = Function(`"use strict"; return (${calcDisplay.replace('×', '*').replace('÷', '/')})`)();
              setCalcHistory(prev => [...prev, `${calcDisplay} = ${res}`].slice(-2));
              setCalcDisplay(res.toString());
          } catch { setCalcDisplay('Error'); }
      }
    } else {
        setCalcDisplay(prev => prev + val);
    }
  };

  if (setupStep === 'AUTH') {
    return (
      <div className="min-h-screen bg-[#050510] text-white flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
           <div className="text-center">
              <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.4)] mb-8">
                 <AmanahShield className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Amanah Guard</h2>
              <p className="text-slate-500 font-bold text-sm">Enterprise Identity Bridge</p>
           </div>
           <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] space-y-8 backdrop-blur-3xl shadow-2xl">
              <input 
                type="text" maxLength={6} value={pairingToken}
                onChange={e => setPairingToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000 000"
                className="w-full p-8 bg-black/60 border border-white/10 rounded-[2rem] text-center text-5xl font-black text-indigo-500 outline-none focus:border-indigo-600 transition-all placeholder:text-white/5"
              />
              <button onClick={() => handleVerifyToken()} disabled={isVerifying || pairingToken.length < 6} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all disabled:opacity-30">
                {isVerifying ? 'Verifying...' : 'Link Device'}
              </button>
           </div>
        </div>
      </div>
    );
  }

  if (setupStep === 'INSTALLING' || setupStep === 'GUIDE') {
    return (
      <div className="min-h-screen bg-[#020205] text-slate-300 flex flex-col items-center justify-center p-8 text-center">
        {setupStep === 'INSTALLING' ? (
          <div className="flex flex-col items-center gap-6">
             <div className="w-16 h-16 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
             <div className="font-black text-white text-xl uppercase tracking-widest">Applying Security Patch...</div>
          </div>
        ) : (
          <div className="space-y-12 max-w-md animate-in zoom-in duration-700" dir="rtl">
             <div className="bg-indigo-600 p-10 rounded-[4rem] text-white shadow-[0_30px_100px_rgba(79,70,229,0.3)]">
                <h3 className="text-3xl font-black mb-6">تفعيل وضع التخفي</h3>
                <p className="text-sm mb-10 opacity-90 font-bold leading-relaxed">لضمان عمل الحماية في الخلفية، يرجى إضافة هذا التطبيق لشاشتك الرئيسية.</p>
                <div className="bg-white text-indigo-600 py-6 px-4 rounded-[2rem] font-black text-2xl shadow-inner animate-pulse">
                   Add to Home Screen
                </div>
             </div>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Invisible Mode v2.4 Active</p>
          </div>
        )}
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="h-screen bg-black flex flex-col p-6 overflow-hidden select-none touch-none" dir="ltr">
        <div className="flex-1 flex flex-col justify-end pb-10">
           <div className="space-y-2 opacity-30 px-6 text-right transition-all">
              {calcHistory.map((h, i) => <p key={i} className="text-white text-2xl font-light font-mono">{h}</p>)}
           </div>
           <div className="text-right text-white text-9xl font-light mb-4 truncate px-4">{calcDisplay || '0'}</div>
        </div>
        <div className="grid grid-cols-4 gap-4 px-2 pb-14">
          {['AC', '±', '%', '÷'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-400 text-black" onClick={() => handleCalcClick(b)} />)}
          {['7', '8', '9', '×'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-800 text-white" onClick={() => handleCalcClick(b)} />)}
          {['4', '5', '6', '-'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-800 text-white" onClick={() => handleCalcClick(b)} />)}
          {['1', '2', '3', '+'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-800 text-white" onClick={() => handleCalcClick(b)} />)}
          <div className="col-span-2">
             <button onClick={() => handleCalcClick('0')} className="h-20 w-full flex items-center justify-start pl-10 rounded-full text-4xl font-bold bg-zinc-800 text-white active:bg-zinc-600 transition-all">0</button>
          </div>
          <CalcBtn label="." color="bg-zinc-800 text-white" onClick={() => handleCalcClick('.')} />
          <CalcBtn label="=" color="bg-orange-500 text-white" onClick={() => handleCalcClick('=')} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050515] text-white flex flex-col items-center justify-center p-10 text-center animate-in fade-in zoom-in duration-700">
       <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-[0_0_80px_rgba(79,70,229,0.5)] animate-pulse">🛡️</div>
       <h2 className="text-4xl font-black mb-4 tracking-tighter">ENVIRONMENT SECURED</h2>
       <p className="text-slate-400 font-bold mb-12 text-sm leading-relaxed max-w-xs">Amanah AI is currently monitoring digital activities to ensure child safety. No active threats detected.</p>
       <button onClick={() => setIsUnlocked(false)} className="px-10 py-5 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-white/10 transition-all">
          Exit Admin Interface
       </button>
    </div>
  );
};

const CalcBtn: React.FC<{ label: string, color: string, onClick: () => void }> = ({ label, color, onClick }) => (
  <button onClick={onClick} className={`h-20 w-20 flex items-center justify-center rounded-full text-4xl font-bold transition-all active:brightness-125 ${color}`}>{label}</button>
);

export default ChildAppView;
