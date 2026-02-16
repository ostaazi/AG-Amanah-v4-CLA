
'use client';

import React from 'react';
import { useParams } from 'react-router-dom';
import DeviceCommandsDashboard from '../../../../../components/parent/DeviceCommandsDashboard';
import { secureFetch } from '../../../../../lib/http/secureFetch';

export default function DeviceControlPage() {
  const { familyId, deviceId } = useParams<{ familyId: string, deviceId: string }>();

  const applyMode = async (mode: string) => {
    try {
      const res = await secureFetch(`/api/families/${familyId}/devices/${deviceId}/modes/apply`, {
        method: 'POST',
        body: JSON.stringify({ mode_key: mode })
      });
      if (res.ok) alert(`تم تفعيل وضع ${mode} بنجاح.`);
    } catch (e) { alert("فشل تفعيل الوضع."); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 p-8" dir="rtl">
      <div className="bg-slate-950 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(138,21,56,0.2)_0%,transparent_60%)]"></div>
         <div className="relative z-10 space-y-8">
            <h1 className="text-5xl font-black tracking-tighter">قمرة التحكم السيادي</h1>
            <p className="text-slate-400 font-bold text-lg">إدارة الأوضاع والتعليمات البرمجية لجهاز {deviceId?.slice(0, 8)}</p>
            
            <div className="flex flex-wrap gap-4">
               <button onClick={() => applyMode('STUDY')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl transition-all active:scale-95">📚 تفعيل وضع الدراسة</button>
               <button onClick={() => applyMode('SLEEP')} className="bg-[#8A1538] hover:bg-red-700 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl transition-all active:scale-95">🌙 تفعيل وضع النوم</button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-8">
            <DeviceCommandsDashboard familyId={familyId!} deviceId={deviceId!} />
         </div>
         <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100">
               <h3 className="text-xl font-black text-slate-800 border-b pb-6 mb-6">الحالة الفورية</h3>
               <div className="space-y-6">
                  <div className="flex justify-between items-center text-sm font-bold">
                     <span className="text-slate-400">آخر ظهور:</span>
                     <span className="text-emerald-600">منذ دقيقتين</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold">
                     <span className="text-slate-400">التشفير:</span>
                     <span className="text-indigo-600">AES-256 Valid</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
