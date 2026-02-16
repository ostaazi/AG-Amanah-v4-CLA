
import React, { useState, useEffect } from 'react';
import { ICONS, AmanahShield } from '../../constants';

export default function DefensePolicyView({ familyId }: { familyId: string }) {
  const [policy, setPolicy] = useState<any>({
    critical_lock_overlay: true,
    critical_cut_internet: true,
    critical_block_chatapps: true,
    high_cut_internet: true,
    high_block_chatapps: true,
    medium_block_chatapps: false
  });
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) => setPolicy({ ...policy, [key]: !policy[key] });

  const savePolicy = async () => {
    setSaving(true);
    // محاكاة حفظ السياسة للسيرفر
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    alert("تم تحديث بروتوكولات الدفاع السيادي بنجاح.");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <div className="bg-[#020617] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D]">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(209,162,61,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-[#8A1538] rounded-3xl flex items-center justify-center shadow-2xl">
                  <AmanahShield className="w-16 h-16" animate />
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">إدارة سياسات الدفاع</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg uppercase tracking-widest">Autonomous Safety Engine</p>
               </div>
            </div>
            <button 
              onClick={savePolicy}
              disabled={saving}
              className="bg-[#D1A23D] text-black px-12 py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
            >
               {saving ? 'جاري الحفظ...' : 'اعتماد السياسة'}
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
         <PolicySection 
           title="مستوى الخطر: حرج (CRITICAL)" 
           desc="تُفعل عند رصد محاولات استدراج صريحة أو إيذاء نفس."
           color="border-red-600"
         >
            <PolicyToggle label="قفل شاشة الجهاز فوراً" active={policy.critical_lock_overlay} onToggle={() => toggle('critical_lock_overlay')} />
            <PolicyToggle label="قطع الإنترنت بالكامل (VPN Killswitch)" active={policy.critical_cut_internet} onToggle={() => toggle('critical_cut_internet')} />
            <PolicyToggle label="حظر كافة تطبيقات التواصل" active={policy.critical_block_chatapps} onToggle={() => toggle('critical_block_chatapps')} />
         </PolicySection>

         <PolicySection 
           title="مستوى الخطر: عالٍ (HIGH)" 
           desc="تُفعل عند رصد تنمر حاد أو محتوى غير لائق متكرر."
           color="border-orange-500"
         >
            <PolicyToggle label="عزل الشبكة (Quarantine)" active={policy.high_cut_internet} onToggle={() => toggle('high_cut_internet')} />
            <PolicyToggle label="تقييد تطبيقات التواصل" active={policy.high_block_chatapps} onToggle={() => toggle('high_block_chatapps')} />
         </PolicySection>
      </div>

      <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex items-center gap-6 shadow-2xl">
         <span className="text-3xl">⚖️</span>
         <p className="text-sm font-bold opacity-80 leading-relaxed">
            ملاحظة سيادية: يتم تنفيذ هذه القواعد محلياً على الجهاز بواسطة Amanah Agent في أقل من 50 مللي ثانية بمجرد استلام الإشارة، لضمان استجابة أسرع من أي تهديد.
         </p>
      </div>
    </div>
  );
}

const PolicySection = ({ title, desc, children, color }: any) => (
  <div className={`bg-white p-10 rounded-[4rem] shadow-xl border-t-[12px] ${color} space-y-8`}>
     <div>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h3>
        <p className="text-slate-400 font-bold text-sm mt-1">{desc}</p>
     </div>
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
     </div>
  </div>
);

const PolicyToggle = ({ label, active, onToggle }: any) => (
  <div 
    onClick={onToggle}
    className={`p-6 rounded-[2.2rem] border-2 cursor-pointer transition-all flex items-center justify-between group ${active ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent opacity-60'}`}
  >
     <span className={`font-black text-sm ${active ? 'text-indigo-900' : 'text-slate-500'}`}>{label}</span>
     <div className={`w-12 h-7 rounded-full p-1 transition-all ${active ? 'bg-indigo-600' : 'bg-slate-300'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${active ? (document.dir === 'rtl' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`}></div>
     </div>
  </div>
);
