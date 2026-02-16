
'use client';

import React, { useState } from 'react';
import { ICONS, AmanahShield } from '../../constants';

export default function DefenseRulesView({ familyId }: { familyId: string }) {
  const [rules, setRules] = useState([
    { id: 'r1', name: 'بروتوكول حماية الاستدراج الحرجة', type: 'GROOMING', severity: 'CRITICAL', status: 'ACTIVE', actions: ['Lock Screen', 'Quarantine Net'] },
    { id: 'r2', name: 'درع التنمر الإلكتروني', type: 'BULLYING', severity: 'HIGH', status: 'ACTIVE', actions: ['Kill App', 'Notify Parent'] },
    { id: 'r3', name: 'فلتر المحتوى الحساس', type: 'NUDITY', severity: 'MEDIUM', status: 'PAUSED', actions: ['Blur Image'] },
  ]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-950 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group border-b-[12px] border-indigo-600">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(138,21,56,0.2)_0%,transparent_60%)] group-hover:scale-110 transition-transform duration-1000"></div>
         <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-[0_0_50px_rgba(79,70,229,0.4)] animate-shield-breathing">
                  <AmanahShield className="w-16 h-16" animate />
               </div>
               <div className="text-right">
                  <h2 className="text-5xl font-black tracking-tighter mb-2">محرك الدفاع السيادي</h2>
                  <p className="text-indigo-300 font-bold text-lg opacity-80 uppercase tracking-widest">Autonomous Response Engine • V1.0</p>
               </div>
            </div>
            <button className="bg-white text-slate-900 px-12 py-6 rounded-[2.2rem] font-black text-lg shadow-2xl hover:scale-105 transition-all active:scale-95">➕ إضافة بروتوكول جديد</button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
         {rules.map((rule) => (
           <div key={rule.id} className={`bg-white rounded-[3rem] p-8 border-2 transition-all group ${rule.status === 'ACTIVE' ? 'border-slate-50 shadow-md hover:shadow-2xl' : 'border-red-50 grayscale opacity-60'}`}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                 <div className="flex items-center gap-8 flex-1">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-inner ${rule.status === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                       {rule.type === 'GROOMING' ? '🐺' : rule.type === 'BULLYING' ? '🤬' : '🔞'}
                    </div>
                    <div className="text-right space-y-1">
                       <h3 className="text-2xl font-black text-slate-800">{rule.name}</h3>
                       <div className="flex items-center gap-4">
                          <span className={`px-4 py-1 rounded-full text-[9px] font-black tracking-widest ${rule.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-400 text-white'}`}>{rule.severity}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">نوع التهديد: {rule.type}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-3">
                    {rule.actions.map(a => (
                      <span key={a} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">{a}</span>
                    ))}
                 </div>

                 <div className="flex items-center gap-4 border-r border-slate-100 pr-8">
                    <button className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all"><ICONS.Settings className="w-6 h-6"/></button>
                    <button className={`w-16 h-9 rounded-full p-1.5 transition-all ${rule.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                       <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${rule.status === 'ACTIVE' ? '-translate-x-7' : 'translate-x-0'}`}></div>
                    </button>
                 </div>
              </div>
           </div>
         ))}
      </div>

      {/* Security Statement */}
      <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 p-10 rounded-[4rem] flex items-center gap-10">
         <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-5xl shadow-sm border border-indigo-100">🛡️</div>
         <div className="space-y-2">
            <h4 className="text-xl font-black text-indigo-900">حوكمة الدفاع التلقائي (ABAC)</h4>
            <p className="text-sm font-bold text-indigo-700 leading-relaxed max-w-3xl">
              تعمل هذه القواعد في "الطبقة الصفرية" من النواة. بمجرد تفعيل القاعدة، يتم اتخاذ القرار محلياً على جهاز الطفل وسحابياً في آن واحد لضمان الاستجابة في زمن يقل عن 50 مللي ثانية. كافة الإجراءات موثقة بتوقيع رقمي في سجل الحيازة.
            </p>
         </div>
      </div>
    </div>
  );
}
