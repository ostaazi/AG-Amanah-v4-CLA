
import React, { useState, useEffect } from 'react';
import { ParentAccount, Child } from '../types';
import { AmanahShield } from '../constants';
import { createSovereignPairCode } from '../services/firestoreService';

const DeviceEnrollmentView: React.FC<{ currentUser: ParentAccount, children: Child[] }> = ({ currentUser, children }) => {
  const [pairCode, setPairCode] = useState('----');
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateNewCode = async () => {
    if (!selectedChildId) return alert("يرجى اختيار الطفل أولاً.");
    setIsGenerating(true);
    const code = await createSovereignPairCode(currentUser.id, selectedChildId);
    if (code) {
        setPairCode(code);
        setTimeLeft(180); // 3 دقائق TTL حسب الوثيقة
    }
    setIsGenerating(false);
  };

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <div className="max-w-4xl mx-auto py-12 animate-in zoom-in-95 duration-500" dir="rtl">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         <div className="lg:col-span-7 bg-white rounded-[4rem] shadow-2xl border-4 border-white p-12 space-y-10 text-center">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-[0_20px_50px_rgba(79,70,229,0.3)]">
               <AmanahShield className="w-16 h-16" animate={timeLeft > 0} />
            </div>

            <div className="space-y-4">
               <h2 className="text-4xl font-black text-slate-900 tracking-tighter">ربط جهاز سيادي</h2>
               <p className="text-slate-400 font-bold px-10 leading-relaxed text-sm">سيتم تفعيل الـ Device Binding لربط هاتف الطفل {children.find(c=>c.id===selectedChildId)?.name} بالنواة المركزية.</p>
            </div>

            <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-[3rem] p-10 space-y-8 relative overflow-hidden">
               {timeLeft > 0 ? (
                 <>
                   <div className="absolute top-0 right-0 left-0 h-2 bg-slate-200">
                      <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${(timeLeft / 180) * 100}%` }}></div>
                   </div>
                   <div className="space-y-2 pt-4">
                      <code className="text-6xl font-mono font-black tracking-[0.2em] text-indigo-600 block">{pairCode}</code>
                      <p className="text-[10px] font-mono text-slate-400">SIGNING_ROOT: AMANAH_KMS_V1_STABLE</p>
                   </div>
                   <div className="flex items-center justify-center gap-3">
                      <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                      <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">تنتهي الصلاحية خلال {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
                   </div>
                 </>
               ) : (
                 <div className="py-10 space-y-8">
                    <div className="text-5xl">⏳</div>
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">اختر الطفل لإنشاء رمز مخصص له</label>
                       <select 
                         value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)}
                         className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-black text-right outline-none"
                       >
                          {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <button onClick={generateNewCode} disabled={isGenerating} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black shadow-xl active:scale-95 transition-all hover:scale-105">
                       {isGenerating ? 'جاري التوليد...' : 'توليد رمز ربط سيادي'}
                    </button>
                 </div>
               )}
            </div>
         </div>

         <div className="lg:col-span-5 space-y-8">
            <div className="bg-indigo-950 p-10 rounded-[3rem] text-white shadow-2xl space-y-10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
               <h3 className="text-2xl font-black border-b border-white/10 pb-6">بروتوكول التحصين (Binding)</h3>
               
               <div className="space-y-8 relative z-10">
                  <BindingStep icon="🔑" title="توليد مفتاح RSA" desc="يقوم هاتف الطفل بتوليد مفتاح 4096-bit داخل الـ Keystore الآمن." />
                  <BindingStep icon="🤝" title="المصافحة الرقمية" desc="يتم إرسال المفتاح العام مع الـ Pair Code للخادم للارتباط." />
                  <BindingStep icon="🛡️" title="بصمة التثبيت" desc="يتم ربط الجلسة بـ Install ID فريد لمنع استنساخ التطبيق." />
               </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
               <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-3">
                  <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">⚠️</span>
                  سياسة الأمن (v1)
               </h4>
               <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                     <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                     الرمز صالح لمرة واحدة ولطفل واحد فقط.
                  </li>
                  <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                     <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                     يتم تدوير (Rotate) توكن الجهاز كل 30 يوم تلقائياً.
                  </li>
               </ul>
            </div>
         </div>

      </div>
    </div>
  );
};

const BindingStep = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="flex items-start gap-5">
     <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl border border-white/10 shadow-inner">{icon}</div>
     <div className="flex-1">
        <p className="font-black text-sm text-indigo-300 mb-1">{title}</p>
        <p className="text-[10px] font-bold text-indigo-100/60 leading-relaxed">{desc}</p>
     </div>
  </div>
);

export default DeviceEnrollmentView;
