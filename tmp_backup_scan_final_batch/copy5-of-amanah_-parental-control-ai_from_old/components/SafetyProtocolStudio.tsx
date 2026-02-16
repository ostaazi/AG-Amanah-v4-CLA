
import React, { useState, useEffect } from 'react';
import { Category, AlertSeverity, AutoRule, ParentAccount } from '../types';
import { ICONS, AmanahShield } from '../constants';

const SafetyProtocolStudio: React.FC<{ currentUser: ParentAccount }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'RULES' | 'SIMULATOR'>('RULES');
  const [rules, setRules] = useState<AutoRule[]>([
    {
      rule_id: 'r1',
      name: 'درع مكافحة الاستدراج الحرج',
      category: Category.PREDATOR,
      min_severity: AlertSeverity.HIGH,
      enabled: true,
      actions_json: ['LOCKSCREEN', 'NET_BLOCK', 'EVIDENCE_CAPTURE']
    },
    {
      rule_id: 'r2',
      name: 'فلتر المحتوى الصريح',
      category: Category.ADULT_CONTENT,
      min_severity: AlertSeverity.MEDIUM,
      enabled: true,
      actions_json: ['APP_KILL', 'NOTIFY_PARENT']
    },
    {
      rule_id: 'r3',
      name: 'مراقبة التنمر الإلكتروني',
      category: Category.BULLYING,
      min_severity: AlertSeverity.MEDIUM,
      enabled: false,
      actions_json: ['NOTIFY_PARENT']
    }
  ]);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.rule_id === id ? { ...r, enabled: !r.enabled } : r));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      {/* Sovereign Header */}
      <div className="bg-[#020617] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-[#8A1538] rounded-3xl flex items-center justify-center shadow-2xl animate-shield-breathing">
                  <AmanahShield className="w-16 h-16" />
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">Safety Control Plane</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg">إدارة محرك الاستجابة التلقائي والقواعد السيادية.</p>
               </div>
            </div>
            <div className="flex bg-white/5 p-2 rounded-2xl border border-white/10">
               <button onClick={() => setActiveTab('RULES')} className={`px-8 py-4 rounded-xl font-black text-xs transition-all ${activeTab === 'RULES' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>القواعد النشطة</button>
               <button onClick={() => setActiveTab('SIMULATOR')} className={`px-8 py-4 rounded-xl font-black text-xs transition-all ${activeTab === 'SIMULATOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>محاكي الرد</button>
            </div>
         </div>
      </div>

      {activeTab === 'RULES' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
           {rules.map(rule => (
             <div key={rule.rule_id} className={`bg-white rounded-[3rem] p-8 shadow-xl border-2 transition-all group ${rule.enabled ? 'border-slate-50' : 'border-red-50 grayscale opacity-60'}`}>
                <div className="flex justify-between items-start mb-8">
                   <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${rule.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                         {rule.category === Category.PREDATOR ? '🐺' : '🛡️'}
                      </div>
                      <div>
                         <h3 className="text-xl font-black text-slate-800">{rule.name}</h3>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{rule.category}</span>
                      </div>
                   </div>
                   <button 
                    onClick={() => toggleRule(rule.rule_id)}
                    className={`w-14 h-8 rounded-full p-1 transition-all ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                   >
                      <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${rule.enabled ? '-translate-x-6' : 'translate-x-0'}`}></div>
                   </button>
                </div>

                <div className="space-y-4">
                   <p className="text-xs font-bold text-slate-500 leading-relaxed border-r-4 border-indigo-100 pr-4">إجراءات الاستجابة: {rule.actions_json.join(' + ')}</p>
                   <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                      <span className="text-[10px] font-black text-slate-400">الحساسية الدنيا: <span className="text-indigo-600">{rule.min_severity}</span></span>
                      <button className="text-[10px] font-black text-indigo-600 hover:underline">تعديل الأوامر ⚙️</button>
                   </div>
                </div>
             </div>
           ))}
           <button className="rounded-[3rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center p-10 gap-4 group hover:border-indigo-200 transition-all">
              <span className="text-5xl group-hover:scale-125 transition-transform">➕</span>
              <span className="font-black text-slate-400 group-hover:text-indigo-600">إضافة قاعدة استجابة مخصصة</span>
           </button>
        </div>
      ) : (
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 text-center space-y-8 animate-in zoom-in-95">
           <div className="max-w-2xl mx-auto space-y-6">
              <h3 className="text-3xl font-black text-slate-900">محاكي المنطق السيادي</h3>
              <p className="text-slate-500 font-bold leading-relaxed">اختبر رد فعل النظام عند وصول حادثة معينة للتأكد من أن القواعد تعمل كما هو مخطط لها.</p>
              <div className="grid grid-cols-2 gap-6 pt-6">
                 <select className="p-6 bg-slate-50 border border-slate-100 rounded-3xl font-black text-right outline-none focus:border-indigo-500">
                    {Object.values(Category).map(c => <option key={c}>{c}</option>)}
                 </select>
                 <select className="p-6 bg-slate-50 border border-slate-100 rounded-3xl font-black text-right outline-none focus:border-indigo-500">
                    <option>High Severity</option>
                    <option>Critical</option>
                 </select>
              </div>
              <button className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all">تشغيل اختبار الرد 🧪</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SafetyProtocolStudio;
