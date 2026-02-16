'use client';

import React from 'react';

export default function RulesPage({ params }: { params: { familyId: string } }) {
  return (
    <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl p-12 min-h-[600px] flex flex-col items-center justify-center text-center space-y-8" dir="rtl">
      <div className="w-32 h-32 bg-[#8A1538] text-white rounded-[3rem] flex items-center justify-center text-6xl shadow-2xl animate-shield-breathing">🛡️</div>
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">قواعد الدفاع الآلي</h1>
        <p className="text-slate-500 font-bold text-lg leading-relaxed">
          تكوين محرك الاستجابة التلقائي لتحديد الإجراءات التقنية التي يجب اتخاذها فور رصد تهديد معين.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 w-full max-w-md">
        <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex items-center justify-between">
          <span className="text-xs font-black text-red-700">Grooming Defense Protocol</span>
          <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase">Active</span>
        </div>
        <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-center justify-between">
          <span className="text-xs font-black text-indigo-700">Cyberbullying Shield</span>
          <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase">Active</span>
        </div>
      </div>
    </div>
  );
}