
import React, { useState } from 'react';
import { ParentAccount, SafetyPlaybook, Category, AlertSeverity, AutomatedAction } from '../types';
import { ICONS, AmanahShield } from '../constants';
import { canPerform } from '../services/rbacService';

interface SafetyPlaybookHubProps {
  currentUser: ParentAccount;
  onUpdatePlaybooks: (playbooks: SafetyPlaybook[]) => void;
}

const SafetyPlaybookHub: React.FC<SafetyPlaybookHubProps> = ({ currentUser, onUpdatePlaybooks }) => {
  const [activeCategory, setActiveCategory] = useState<Category>(Category.PREDATOR);
  const isAuthorized = canPerform(currentUser.role, 'playbook.write');

  const playbooks = currentUser.playbooks || [];
  
  // دالة لجلب البروتوكول الحالي أو إنشاء افتراضي
  const getActivePlaybook = (): SafetyPlaybook => {
    return playbooks.find(p => p.category === activeCategory) || {
      id: 'pb-' + activeCategory,
      name: `بروتوكول حماية: ${activeCategory}`,
      category: activeCategory,
      minSeverity: AlertSeverity.HIGH,
      enabled: true,
      actions: [
        { id: 'a1', type: 'LOCK_DEVICE', isEnabled: true },
        { id: 'a2', type: 'BLOCK_APP', isEnabled: true },
        { id: 'a3', type: 'NOTIFY_PARENTS', isEnabled: true },
        { id: 'a4', type: 'SIREN', isEnabled: false },
        { id: 'a5', type: 'QUARANTINE_NET', isEnabled: true },
        { id: 'a6', type: 'DISABLE_HARDWARE', isEnabled: true }
      ]
    };
  };

  const activePlaybook = getActivePlaybook();

  const toggleAction = (actionId: string) => {
    if (!isAuthorized) return;
    const updatedActions = activePlaybook.actions.map(a => a.id === actionId ? { ...a, isEnabled: !a.isEnabled } : a);
    const updatedPlaybook = { ...activePlaybook, actions: updatedActions };
    const otherPlaybooks = playbooks.filter(p => p.category !== activeCategory);
    onUpdatePlaybooks([...otherPlaybooks, updatedPlaybook]);
  };

  const setMinSeverity = (sev: AlertSeverity) => {
    if (!isAuthorized) return;
    const updatedPlaybook = { ...activePlaybook, minSeverity: sev };
    const otherPlaybooks = playbooks.filter(p => p.category !== activeCategory);
    onUpdatePlaybooks([...otherPlaybooks, updatedPlaybook]);
  };

  const actionLabels: Record<string, { label: string, icon: string, desc: string }> = {
    LOCK_DEVICE: { label: 'إغلاق الشاشة (Lockdown)', icon: '🌑', desc: 'قفل فوري للجهاز لمنع أي تفاعل.' },
    BLOCK_APP: { label: 'قتل التطبيق (Kill Switch)', icon: '✂️', desc: 'إغلاق التطبيق المفتوح فوراً.' },
    NOTIFY_PARENTS: { label: 'تنبيه عالي الأولوية', icon: '🚨', desc: 'دفع إشعار عاجل لكافة المشرفين.' },
    SIREN: { label: 'صافرة ردع صوتية', icon: '🔊', desc: 'إطلاق صوت عالي لجذب الانتباه.' },
    QUARANTINE_NET: { label: 'حجر الشبكة', icon: '📡', desc: 'قطع الإنترنت مؤقتاً لعزل المهاجم.' },
    DISABLE_HARDWARE: { label: 'تعطيل الكاميرا والمايك', icon: '🚫', desc: 'منع التسجيل الاستدراجي فوراً.' }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      
      {/* Sovereign Header */}
      <div className="bg-[#0f172a] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-[#8A1538] rounded-3xl flex items-center justify-center text-4xl shadow-2xl">
                  <AmanahShield className="w-16 h-16" animate />
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-2">محرك الدفاع الآلي (ASE)</h2>
                  <p className="text-indigo-200 font-bold opacity-80 text-lg">Autonomous Safety Engine • بروتوكولات الاستجابة</p>
               </div>
            </div>
            {isAuthorized ? (
              <div className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-8 py-4 rounded-2xl font-black text-sm animate-pulse">
                وضع السيادة: يمكنك تعديل Playbooks
              </div>
            ) : (
              <div className="bg-amber-600/20 text-amber-400 border border-amber-500/30 px-8 py-4 rounded-2xl font-black text-sm">
                وضع العرض: لا تملك صلاحية التعديل
              </div>
            )}
         </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
         {[Category.PREDATOR, Category.BULLYING, Category.SELF_HARM, Category.BLACKMAIL, Category.ADULT_CONTENT, Category.VIOLENCE].map(cat => (
           <button 
             key={cat} onClick={() => setActiveCategory(cat)}
             className={`px-10 py-5 rounded-[1.8rem] font-black text-sm whitespace-nowrap transition-all border-2 ${activeCategory === cat ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
           >
              {cat}
           </button>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[4rem] p-10 shadow-xl border border-slate-100 space-y-10">
               {/* Severity Settings */}
               <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-50 pb-8 gap-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">حساسية التفعيل</h3>
                    <p className="text-slate-400 font-bold text-xs mt-1">متى يبدأ النظام بتنفيذ الإجراءات التقنية؟</p>
                  </div>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                     {[AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL].map(sev => (
                       <button 
                        key={sev} onClick={() => setMinSeverity(sev)}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black transition-all ${activePlaybook.minSeverity === sev ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                       >
                         {sev}
                       </button>
                     ))}
                  </div>
               </div>

               {/* Actions Matrix */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activePlaybook.actions.map(action => {
                    const info = actionLabels[action.type];
                    return (
                      <button 
                        key={action.id}
                        onClick={() => toggleAction(action.id)}
                        className={`p-8 rounded-[2.5rem] border-2 text-right transition-all flex flex-col justify-between h-52 group ${action.isEnabled ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}
                        disabled={!isAuthorized}
                      >
                         <div className="flex justify-between items-start w-full">
                            <span className="text-4xl">{info.icon}</span>
                            <div className={`w-12 h-6 rounded-full p-1 transition-all ${action.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                               <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${action.isEnabled ? '-translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                         </div>
                         <div>
                            <h4 className="font-black text-slate-800 mb-1">{info.label}</h4>
                            <p className="text-[10px] font-bold text-slate-400 leading-tight">{info.desc}</p>
                         </div>
                      </button>
                    );
                  })}
               </div>
            </div>
         </div>

         {/* Sidebar Insights */}
         <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl space-y-8 relative overflow-hidden">
               <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl"></div>
               <div className="relative z-10 space-y-6">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">🧩</div>
                  <h3 className="text-2xl font-black tracking-tighter leading-tight">قواعد ABAC السيادية</h3>
                  <p className="text-indigo-300 font-bold text-sm leading-relaxed opacity-80">
                     تعتمد الاستجابة الذكية على سياق الحادثة: <br/>
                     - دور المنفذ: {currentUser.role} <br/>
                     - حالة القفل: {activePlaybook.enabled ? 'مفعلة' : 'معطلة'} <br/>
                     - تكرار التهديد: > 1
                  </p>
                  <div className="pt-6 border-t border-white/10">
                     <button className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">سجل التدقيق (Audit)</button>
                  </div>
               </div>
            </div>

            <div className="bg-emerald-600 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col items-center justify-center text-center space-y-4">
               <div className="text-5xl animate-bounce">🛡️</div>
               <h3 className="text-xl font-black">حماية استباقية 100%</h3>
               <p className="text-xs font-bold opacity-80 leading-relaxed">بمجرد تفعيل البروتوكول، سيتخذ الهاتف وضع "الحجر الجنائي" تلقائياً في أقل من 0.05 ثانية.</p>
            </div>
         </div>
      </div>

    </div>
  );
};

export default SafetyPlaybookHub;
