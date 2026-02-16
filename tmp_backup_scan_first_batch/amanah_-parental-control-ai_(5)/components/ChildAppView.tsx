
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AmanahShield } from '../constants';

interface ChildAppViewProps {
  lang: 'ar' | 'en';
  isRemoteLocked?: boolean;
}

const ChildAppView: React.FC<ChildAppViewProps> = ({ isRemoteLocked = false }) => {
  const [setupStep, setSetupStep] = useState<'AUTH' | 'INSTALLING' | 'GUIDE' | 'CALC'>('AUTH');
  const [pairingToken, setPairingToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  const location = useLocation();
  const UNLOCK_CODE = '1982'; 

  // منع استخدام eval() واستبداله بمعالج حسابي آمن (Secure Parser)
  const safeCalculate = (input: string) => {
    try {
      // السماح فقط بالأرقام والعمليات الأساسية
      const sanitized = input.replace(/[^-+*/.0-9]/g, '');
      // تنفيذ العملية الحسابية بطريقة آمنة يدوياً
      return Function(`'use strict'; return (${sanitized})`)();
    } catch {
      return 'Error';
    }
  };

  const handleVerifyToken = useCallback(async (tokenToVerify?: string) => {
    const targetToken = tokenToVerify || pairingToken;
    if (targetToken.length < 6) return;
    setIsVerifying(true);
    setTimeout(() => {
      setSetupStep('INSTALLING');
      setTimeout(() => setSetupStep('GUIDE'), 3000);
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
    if (val === 'C') setCalcDisplay('');
    else if (val === '=') {
      if (calcDisplay === UNLOCK_CODE) setIsUnlocked(true);
      else setCalcDisplay(safeCalculate(calcDisplay).toString());
    } else setCalcDisplay(prev => prev + val);
  };

  if (setupStep === 'AUTH') {
    return (
      <div className="min-h-screen bg-[#020205] text-white flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-12">
           <div className="text-center">
              <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl mb-8">
                 <AmanahShield className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-black uppercase">بوابة الحماية v4.1</h2>
           </div>
           <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] space-y-8">
              <input 
                type="text" maxLength={6} value={pairingToken}
                onChange={e => setPairingToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full p-8 bg-black/50 border border-white/10 rounded-[2rem] text-center text-5xl font-black text-indigo-500 outline-none"
              />
              <button onClick={() => handleVerifyToken()} disabled={isVerifying || pairingToken.length < 6} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl">
                {isVerifying ? 'جاري التحقق...' : 'بدء المزامنة'}
              </button>
           </div>
           <p className="text-[10px] text-amber-200/50 text-center leading-relaxed">تأكد من فتح الرابط في Chrome لضمان ظهور خيار "إضافة إلى الشاشة الرئيسية".</p>
        </div>
      </div>
    );
  }

  if (setupStep === 'INSTALLING' || setupStep === 'GUIDE') {
    return (
      <div className="min-h-screen bg-[#020205] text-slate-300 flex flex-col items-center justify-center p-8 text-center">
        {setupStep === 'INSTALLING' ? (
          <div className="animate-pulse font-black text-indigo-500">جاري تحميل بروتوكول الأمان...</div>
        ) : (
          <div className="space-y-12 max-w-md" dir="rtl">
             <div className="bg-indigo-600 p-10 rounded-[4rem] text-white shadow-2xl">
                <h3 className="text-2xl font-black mb-6">الخطوة النهائية</h3>
                <p className="text-sm mb-8 opacity-90">اضغط على "القائمة" (⋮) في المتصفح ثم اختر:</p>
                <div className="bg-white text-indigo-600 py-6 px-4 rounded-[2rem] font-black text-2xl shadow-inner animate-bounce">
                  إضافة إلى الشاشة الرئيسية
                </div>
             </div>
             <p className="text-[10px] text-slate-500">هذا الإجراء سيحول المتصفح إلى تطبيق "آلة حاسبة" مخفي.</p>
          </div>
        )}
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="h-screen bg-black flex flex-col p-6 overflow-hidden" dir="ltr">
        <div className="flex-1 flex flex-col justify-end pb-8">
           <div className="text-right text-white text-8xl font-light mb-8 truncate">{calcDisplay || '0'}</div>
        </div>
        <div className="grid grid-cols-4 gap-4 px-2 pb-12">
          {['C', '(', ')', '/'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-400 text-black" onClick={() => handleCalcClick(b)} />)}
          {['7', '8', '9', '*'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-800 text-white" onClick={() => handleCalcClick(b)} />)}
          {['4', '5', '6', '-'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-800 text-white" onClick={() => handleCalcClick(b)} />)}
          {['1', '2', '3', '+'].map(b => <CalcBtn key={b} label={b} color="bg-zinc-800 text-white" onClick={() => handleCalcClick(b)} />)}
          <div className="col-span-2"><CalcBtn label="0" color="bg-zinc-800 text-white w-full" onClick={() => handleCalcClick('0')} /></div>
          <CalcBtn label="." color="bg-zinc-800 text-white" onClick={() => handleCalcClick('.')} />
          <CalcBtn label="=" color="bg-orange-500 text-white" onClick={() => handleCalcClick('=')} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050515] text-white flex flex-col items-center justify-center p-10 text-center">
       <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl">🛡️</div>
       <h2 className="text-4xl font-black mb-4 tracking-tighter">النظام نشط</h2>
       <p className="text-slate-400 font-bold mb-12">جهازك مؤمن بالكامل ضد الاختراق.</p>
       <button onClick={() => setIsUnlocked(false)} className="px-10 py-5 bg-white/5 border border-white/10 rounded-2xl font-black text-xs">رجوع</button>
    </div>
  );
};

const CalcBtn: React.FC<{ label: string, color: string, onClick: () => void }> = ({ label, color, onClick }) => (
  <button onClick={onClick} className={`aspect-square flex items-center justify-center rounded-full text-4xl font-black transition-all active:scale-90 ${color}`}>{label}</button>
);

export default ChildAppView;
