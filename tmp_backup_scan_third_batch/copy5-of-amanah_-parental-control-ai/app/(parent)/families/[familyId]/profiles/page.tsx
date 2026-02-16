'use client';

import React from 'react';

export default function ProfilesPage({ params }: { params: { familyId: string } }) {
  return (
    <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl p-12 min-h-[600px] flex flex-col items-center justify-center text-center space-y-8" dir="rtl">
      <div className="w-32 h-32 bg-amber-500 text-white rounded-[3rem] flex items-center justify-center text-6xl shadow-2xl">⚡</div>
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">الملفات الذكية (Profiles)</h1>
        <p className="text-slate-500 font-bold text-lg leading-relaxed">
          تخصيص قواعد الوصول حسب الزمان والمكان (وقت الدراسة، وقت النوم، وضع السفر).
        </p>
      </div>
      <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-8 rounded-[2.5rem] w-full max-w-lg text-right">
        <h4 className="text-amber-900 font-black text-sm mb-4">قوالب الجدولة المخطط لها:</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-amber-100 font-black text-xs text-amber-700">📚 وقت المذاكرة</div>
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-amber-100 font-black text-xs text-amber-700">🌙 وضع السكون</div>
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-amber-100 font-black text-xs text-amber-700">🎮 ساعات اللعب</div>
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-amber-100 font-black text-xs text-amber-700">🏖️ وضع العطلة</div>
        </div>
      </div>
    </div>
  );
}