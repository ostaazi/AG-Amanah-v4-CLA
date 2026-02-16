'use client';

import React from 'react';

export default function DevicesPage({ params }: { params: { familyId: string } }) {
  return (
    <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl p-12 min-h-[600px] flex flex-col items-center justify-center text-center space-y-8" dir="rtl">
      <div className="w-32 h-32 bg-indigo-600 text-white rounded-[3rem] flex items-center justify-center text-6xl shadow-2xl animate-pulse">📱</div>
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">إدارة أجهزة الأطفال</h1>
        <p className="text-slate-500 font-bold text-lg leading-relaxed">
          إدارة أسطول الأجهزة، مراقبة حالة الاتصال، الموقع الجغرافي، وإجراءات التحكم المباشر بالعتاد.
        </p>
      </div>
      <div className="bg-slate-50 border-2 border-slate-100 p-8 rounded-[2.5rem] w-full max-w-lg">
        <h4 className="text-slate-900 font-black text-sm mb-4">الميزات التقنية قيد التطوير:</h4>
        <ul className="text-right space-y-3">
          <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
            رصد نبض الجهاز (Heartbeat) وتنبيهات الخروج عن الاتصال.
          </li>
          <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
            تفعيل الـ Device Binding لضمان عدم حذف التطبيق.
          </li>
          <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
            إدارة صلاحيات الوصول المباشر (الكاميرا، المايك، الموقع).
          </li>
        </ul>
      </div>
    </div>
  );
}