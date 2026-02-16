
import React, { useState, useEffect } from 'react';
import { AmanahShield, ICONS } from '../constants';

interface ChildAppViewProps {
  lang: 'ar' | 'en';
  isRemoteLocked?: boolean;
}

const ChildAppView: React.FC<ChildAppViewProps> = ({ lang, isRemoteLocked = false }) => {
  const [setupStep, setSetupStep] = useState<'AUTH' | 'INSTALLING' | 'GUIDE' | 'CALC'>('AUTH');
  const [pairingToken, setPairingToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const UNLOCK_CODE = '1982'; 

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setSetupStep('CALC');
    }
  }, []);

  const handleVerifyToken = async () => {
    if (pairingToken.length < 6) return;
    setIsVerifying(true);
    
    // محاكاة التحقق
    setTimeout(() => {
      setSetupStep('INSTALLING');
      setTimeout(() => setSetupStep('GUIDE'), 3000);
    }, 1500);
  };

  const handleCalcClick = (val: string) => {
    if (val === 'C') setCalcDisplay('');
    else if (val === '=') {
      if (calcDisplay === UNLOCK_CODE) setIsUnlocked(true);
      else {
        try { setCalcDisplay(eval(calcDisplay).toString()); } catch { setCalcDisplay('Error'); }
      }
    } else setCalcDisplay(prev => prev + val);
  };

  // 1. بوابة التحقق "الشبح" - قابلة للتمرير
  if (setupStep === 'AUTH') {
    return (
      <div className="scroll-viewport custom-scrollbar bg-[#020205] text-white flex flex-col items-center justify-center p-8 font-mono" dir="rtl">
        <div className="w-full max-w-sm space-y-12 animate-in fade-in duration-700">
           <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)] mb-8">
                 <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              </div>
              <h2 className="text-3xl font-black tracking-tighter uppercase">بوابة الدعم v4.0</h2>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">System Provisioning Portal</p>
           </div>

           <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] space-y-8">
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-4">أدخل كود المزامنة:</label>
                 <input 
                   type="text" 
                   maxLength={6}
                   value={pairingToken}
                   onChange={e => setPairingToken(e.target.value.replace(/\D/g, ''))}
                   placeholder="000 000"
                   className="w-full p-8 bg-black/50 border border-white/10 rounded-[2rem] text-center text-5xl font-black tracking-tighter outline-none focus:border-indigo-600 transition-all text-indigo-500"
                 />
              </div>

              <button 
                onClick={handleVerifyToken}
                disabled={isVerifying || pairingToken.length < 6}
                className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all disabled:opacity-30"
              >
                {isVerifying ? 'جاري التحقق...' : 'بدء المزامنة الآمنة'}
              </button>
           </div>

           <div className="p-8 text-[10px] text-slate-600 leading-relaxed text-center opacity-40">
              بوابة مشفرة 256-bit لنقل بروتوكولات الأمان السحابية. لا تقم بمشاركة هذا الكود مع أي شخص خارج نطاق الدعم المعتمد.
           </div>
        </div>
      </div>
    );
  }

  // 2. واجهة الدليل - قابلة للتمرير مع حاشية
  if (setupStep === 'INSTALLING' || setupStep === 'GUIDE') {
    return (
      <div className="scroll-viewport custom-scrollbar bg-[#020205] text-slate-300 flex flex-col items-center justify-center p-8 text-center font-mono">
        {setupStep === 'INSTALLING' && (
          <div className="space-y-10 animate-in zoom-in w-full max-w-xs">
             <div className="text-6xl animate-bounce">🛠️</div>
             <p className="text-indigo-500 font-black text-xs animate-pulse tracking-[0.3em]">DEPLOYING_KERNEL_PATCH...</p>
             <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 animate-[progress_3s_linear]"></div>
             </div>
             <p className="text-[10px] text-slate-600 uppercase">Synchronizing with node #882...</p>
          </div>
        )}

        {setupStep === 'GUIDE' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-10 w-full max-w-md" dir="rtl">
             <div className="space-y-4">
                <div className="text-emerald-500 font-black text-3xl uppercase tracking-widest">نجاح المزامنة</div>
                <p className="text-sm font-bold text-slate-400">الخطوة النهائية: تحويل هذه الصفحة إلى "آلة حاسبة" على شاشتك.</p>
             </div>

             <div className="bg-indigo-600 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-12">
                   <div className="flex justify-center gap-10 items-center">
                      <div className="text-center opacity-40 scale-75">
                         <div className="text-5xl">🌐</div>
                         <div className="text-[10px] font-black uppercase mt-2">Browser</div>
                      </div>
                      <div className="text-3xl animate-bounce">➡️</div>
                      <div className="text-center">
                         <div className="text-6xl shadow-2xl">🧮</div>
                         <div className="text-[10px] font-black uppercase mt-2">Calculator</div>
                      </div>
                   </div>

                   <div className="space-y-6 pt-8 border-t border-white/10">
                      <p className="font-black text-lg">اضغط على زر <span className="bg-white/20 px-4 py-2 rounded-xl">{isIOS ? 'Share 📤' : 'القائمة ⋮'}</span> ثم اختر:</p>
                      <p className="text-2xl font-black bg-white text-indigo-600 py-6 rounded-[2rem] shadow-2xl">
                        إضافة إلى الشاشة الرئيسية
                      </p>
                      <p className="text-[11px] opacity-70 uppercase tracking-widest">Add to Home Screen</p>
                   </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
             </div>
             <div className="h-20"></div> {/* حاشية إضافية */}
          </div>
        )}
        <style>{` @keyframes progress { 0% { width: 0; } 100% { width: 100%; } } `}</style>
      </div>
    );
  }

  // 3. الآلة الحاسبة (وضع التخفي)
  if (!isUnlocked) {
    return (
      <div className="h-screen bg-black flex flex-col p-6 font-mono select-none overflow-hidden" dir="ltr">
        <div className="flex-1 flex flex-col justify-end pb-8">
           <div className="text-right text-white text-8xl font-light mb-8 truncate px-4">
              {calcDisplay || '0'}
           </div>
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

  // 4. الواجهة الحقيقية
  return (
    <div className="h-screen bg-[#050515] text-white flex flex-col items-center justify-center p-10 text-center">
       <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl">
          <AmanahShield className="w-14 h-14" />
       </div>
       <h2 className="text-4xl font-black mb-4">النظام نشط</h2>
       <p className="text-slate-400 font-bold mb-12">جهازك مؤمن الآن سحابياً.</p>
       <button onClick={() => setIsUnlocked(false)} className="px-10 py-5 bg-white/5 border border-white/10 rounded-2xl font-black text-xs">رجوع</button>
    </div>
  );
};

const CalcBtn: React.FC<{ label: string, color: string, onClick: () => void }> = ({ label, color, onClick }) => (
  <button onClick={onClick} className={`aspect-square flex items-center justify-center rounded-full text-4xl font-black transition-all active:scale-90 ${color}`}>{label}</button>
);

export default ChildAppView;
