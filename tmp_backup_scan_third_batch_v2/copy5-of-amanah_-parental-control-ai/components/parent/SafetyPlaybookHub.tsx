
import React, { useState } from 'react';
import { ParentAccount, SafetyPlaybook, Category, AlertSeverity } from '../../types';
import { ICONS, AmanahShield } from '../../constants';

const SafetyPlaybookHub: React.FC<{ currentUser: ParentAccount }> = ({ currentUser }) => {
  const [activeCategory, setActiveCategory] = useState<Category>(Category.PREDATOR);

  const [playbooks, setPlaybooks] = useState<SafetyPlaybook[]>([
    {
      id: 'pb-predator',
      name: 'بروتوكول حماية الاستدراج',
      category: Category.PREDATOR,
      minSeverity: AlertSeverity.HIGH,
      enabled: true,
      actions: [
        { id: 'a1', type: 'LOCK_DEVICE', isEnabled: true },
        { id: 'a2', type: 'QUARANTINE_NET', isEnabled: true },
        { id: 'a3', type: 'DISABLE_HARDWARE', isEnabled: true }
      ]
    }
  ]);

  const toggleAction = (pbId: string, actId: string) => {
    setPlaybooks(playbooks.map(pb => pb.id === pbId ? {
      ...pb,
      actions: pb.actions.map(a => a.id === actId ? { ...a, isEnabled: !a.isEnabled } : a)
    } : pb));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <div className="bg-[#020617] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-[#8A1538] rounded-3xl flex items-center justify-center shadow-2xl animate-shield-breathing">
                  <AmanahShield className="w-16 h-16" />
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">قمرة الدفاع الآلي (ASE)</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg uppercase tracking-widest">Autonomous Safety Engine • Control Plane</p>
               </div>
            </div>
            <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-xl">
               <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
               النظام في وضع الاستجابة الفورية
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[4rem] p-10 shadow-xl border border-slate-100">
               <h3 className="text-2xl font-black text-slate-800 mb-8 border-b pb-6">إجراءات الاستجابة التلقائية</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {playbooks[0].actions.map(action => (
                    <div key={action.id} className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col justify-between h-48 ${action.isEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent opacity-60'}`}>
                       <div className="flex justify-between items-start">
                          <span className="text-3xl">{action.type === 'LOCK_DEVICE' ? '🌑' : action.type === 'QUARANTINE_NET' ? '📡' : '🚫'}</span>
                          <button 
                            onClick={() => toggleAction(playbooks[0].id, action.id)}
                            className={`w-14 h-8 rounded-full p-1 transition-all ${action.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                          >
                             <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${action.isEnabled ? '-translate-x-6' : 'translate-x-0'}`}></div>
                          </button>
                       </div>
                       <div>
                          <h4 className="font-black text-slate-800">{action.type.replace('_', ' ')}</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">تنفيذ سيادي فوري عند رصد الخطر.</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="lg:col-span-4">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl space-y-8 sticky top-20">
               <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                  <span className="text-3xl">⚖️</span>
                  <h3 className="text-xl font-black">حوكمة القرار</h3>
               </div>
               <p className="text-sm font-bold text-slate-400 leading-relaxed">
                  تعتمد ميزة ASE على معالجة الأدلة في "الطبقة الصفرية". يتم اتخاذ القرار بناءً على درجة موثوقية الذكاء الاصطناعي (Confidence Score > 95%).
               </p>
               <div className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">حالة المحرك المحلي</p>
                  <div className="flex items-center gap-3">
                     <span className="text-lg font-black">0.045ms</span>
                     <span className="text-[8px] bg-emerald-500 px-2 py-0.5 rounded-full text-white">OPTIMAL</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default SafetyPlaybookHub;
