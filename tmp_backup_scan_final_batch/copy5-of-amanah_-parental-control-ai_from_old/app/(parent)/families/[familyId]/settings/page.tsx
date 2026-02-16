'use client';

import React from 'react';

export default function FamilySettingsPage({ params }: { params: { familyId: string } }) {
  return (
    <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl p-12 min-h-[600px] flex flex-col items-center justify-center text-center space-y-8" dir="rtl">
      <div className="w-32 h-32 bg-slate-100 text-slate-400 rounded-[3rem] flex items-center justify-center text-6xl shadow-inner border-2 border-white">⚙️</div>
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">إعدادات العائلة والأعضاء</h1>
        <p className="text-slate-500 font-bold text-lg leading-relaxed">
          إدارة حسابات الوالدين والمشرفين، تخصيص الإشعارات، وإدارة مفاتيح الربط السيادية.
        </p>
      </div>
      <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] w-full max-w-lg">
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm mb-4">
          <div className="text-right">
            <p className="text-xs font-black text-slate-800">دعوة مشرف جديد</p>
            <p className="text-[9px] text-slate-400 font-bold">يمكن إضافة الأم كـ Co-Admin بصلاحيات محدودة.</p>
          </div>
          <button className="bg-indigo-600 text-white p-2 rounded-xl text-xl">➕</button>
        </div>
      </div>
    </div>
  );
}