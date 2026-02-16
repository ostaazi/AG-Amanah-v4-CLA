
import React, { useState, useEffect } from 'react';
import { ICONS, AmanahShield } from '../../constants';

export default function GeoFenceManager({ familyId }: { familyId: string }) {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    // محاكاة جلب المناطق
    setTimeout(() => {
      setZones([
        { zone_id: 'z1', name: 'المنزل', center: '25.2854, 51.5310', radius: 150, is_enabled: true, auto_defense: false },
        { zone_id: 'z2', name: 'المدرسة', center: '25.3214, 51.5012', radius: 300, is_enabled: true, auto_defense: true }
      ]);
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <div className="bg-[#020617] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl">
                  <span className="text-5xl">🌍</span>
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">المناطق الآمنة (Geo-Fencing)</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg uppercase tracking-widest">Autonomous Spatial Defense</p>
               </div>
            </div>
            <button 
              onClick={() => setShowAdd(true)}
              className="bg-white text-slate-900 px-12 py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
            >
               إضافة منطقة جديدة
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {zones.map(zone => (
           <div key={zone.zone_id} className="bg-white p-10 rounded-[3.5rem] shadow-xl border-2 border-slate-50 hover:shadow-2xl transition-all group">
              <div className="flex justify-between items-start mb-8">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl">📍</div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-800">{zone.name}</h3>
                       <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-tighter">{zone.center}</p>
                    </div>
                 </div>
                 <div className={`w-14 h-8 rounded-full p-1 transition-all ${zone.is_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${zone.is_enabled ? '-translate-x-6' : 'translate-x-0'}`}></div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="flex justify-between items-center bg-slate-50 p-6 rounded-2xl">
                    <span className="text-sm font-bold text-slate-500">نطاق الحماية:</span>
                    <span className="text-lg font-black text-slate-900">{zone.radius} متر</span>
                 </div>

                 <div className={`p-6 rounded-2xl border-2 transition-all flex items-center justify-between ${zone.auto_defense ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-transparent opacity-60'}`}>
                    <div className="flex items-center gap-4">
                       <span className="text-xl">{zone.auto_defense ? '🛡️' : '⚪'}</span>
                       <div className="text-right">
                          <p className={`text-xs font-black ${zone.auto_defense ? 'text-red-700' : 'text-slate-500'}`}>الدفاع التلقائي عند الخروج</p>
                          <p className="text-[9px] font-bold opacity-60">تفعيل Lockdown فور مغادرة النطاق</p>
                       </div>
                    </div>
                    {zone.auto_defense && <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase">Active</span>}
                 </div>
              </div>

              <div className="mt-10 flex gap-4">
                 <button className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black text-xs transition-all hover:bg-black">تعديل الإحداثيات</button>
                 <button className="px-6 py-4 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-600 hover:text-white transition-all">حذف</button>
              </div>
           </div>
         ))}
      </div>

      <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 p-10 rounded-[4rem] flex items-center gap-8">
         <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-sm">⚖️</div>
         <p className="text-sm font-bold text-indigo-700 leading-relaxed">
            ملاحظة سيادية: تعتمد دقة السياج الجغرافي على إعدادات "الدقة العالية" في جهاز الطفل. يتم استخدام تقنيات الـ Fusion Location (GPS + WiFi + Cell) لضمان عدم استهلاك البطارية مع الحفاظ على الرصد اللحظي.
         </p>
      </div>
    </div>
  );
}
