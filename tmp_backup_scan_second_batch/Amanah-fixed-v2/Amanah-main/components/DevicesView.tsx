
import React, { useState } from 'react';
import { Child, AppUsage, CallRecord, ChildLocation } from '../types';
import { ICONS } from '../constants';
import { analyzeLocationSafety } from '../services/geminiService';

interface DevicesViewProps {
  children: Child[];
  onToggleAppBlock: (childId: string, appId: string) => void;
  onUpdateDevice: (childId: string, updates: Partial<Child>) => void;
}

const DevicesView: React.FC<DevicesViewProps> = ({ children, onToggleAppBlock, onUpdateDevice }) => {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find(c => c.id === selectedChildId) || children[0];
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationIntel, setLocationIntel] = useState<{text: string, mapsLinks: any[]} | null>(null);

  if (!child) return <div className="p-10 text-center font-black">لا يوجد أطفال مضافين حالياً.</div>;

  const trackLocation = () => {
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      onUpdateDevice(child.id, { location: { lat: latitude, lng: longitude, address: "جاري تحديد العنوان...", lastUpdated: new Date() } });
      const intel = await analyzeLocationSafety(latitude, longitude);
      setLocationIntel(intel);
      setLoadingLocation(false);
    }, () => {
      alert("يرجى تفعيل صلاحيات الموقع الجغرافي.");
      setLoadingLocation(false);
    });
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700" dir="rtl">
      {/* Child Selector */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 custom-scrollbar flex-1 items-center w-full">
           {children.map(c => (
             <button key={c.id} onClick={() => setSelectedChildId(c.id)} className={`flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`}>
                <img src={c.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover border-2 border-white" />
                <span className="font-black text-xs md:text-sm">{c.name}</span>
             </button>
           ))}
        </div>
        
        {/* Device Pulse Widget */}
        <div className="w-full sm:w-auto bg-slate-900 text-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] flex items-center justify-around md:justify-start gap-6 md:gap-8 shadow-2xl border-b-4 border-indigo-600">
           <div className="flex flex-col items-center gap-1">
              <p className="text-[7px] md:text-[8px] font-black text-indigo-400 uppercase">البطارية</p>
              <div className="flex items-center gap-2">
                 <div className="w-6 md:w-8 h-3 md:h-4 rounded-sm border border-white/40 p-0.5 relative">
                    <div className={`h-full ${child.batteryLevel > 20 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${child.batteryLevel}%` }}></div>
                 </div>
                 <span className="text-[9px] md:text-[10px] font-black">{child.batteryLevel}%</span>
              </div>
           </div>
           <div className="flex flex-col items-center gap-1">
              <p className="text-[7px] md:text-[8px] font-black text-indigo-400 uppercase">الشبكة</p>
              <div className="flex items-end gap-0.5 h-3 md:h-4">
                 {[1, 2, 3, 4].map(i => <div key={i} className={`w-0.5 md:w-1 rounded-full ${child.signalStrength >= i ? 'bg-indigo-500' : 'bg-white/10'}`} style={{ height: `${i*25}%` }}></div>)}
              </div>
           </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        <div className="lg:col-span-8 bg-white/70 backdrop-blur-2xl rounded-2xl md:rounded-[3.5rem] border border-white shadow-2xl overflow-hidden flex flex-col h-[350px] md:h-[500px]">
           <div className="p-4 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white/50">
              <div className="hidden sm:block">
                <h3 className="text-lg md:text-2xl font-black text-slate-800 tracking-tighter">Live GPS</h3>
                <p className="text-[10px] md:text-xs font-bold text-slate-400">تتبع حي مع ميزة المناطق الآمنة.</p>
              </div>
              <button onClick={trackLocation} disabled={loadingLocation} className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-xs flex items-center gap-2 transition-all active:scale-95 w-full sm:w-auto justify-center ${loadingLocation ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white shadow-lg'}`}>
                {loadingLocation ? <span className="animate-spin text-lg">⏳</span> : <ICONS.Location />}
                تحديث الموقع
              </button>
           </div>
           
           <div className="flex-1 relative bg-slate-100 overflow-hidden">
              {child.location ? (
                <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={`https://maps.google.com/maps?q=${child.location.lat},${child.location.lng}&z=15&output=embed`} className="absolute inset-0 grayscale-[0.2] contrast-[1.1]"></iframe>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 md:gap-6 opacity-30 p-10"><div className="text-6xl md:text-8xl">🌍</div><p className="font-black text-sm md:text-xl text-center">بانتظار إشارة الـ GPS لجهاز {child.name}</p></div>
              )}
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6 md:space-y-8">
           <div className="bg-white/80 backdrop-blur-xl p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-white shadow-xl space-y-6 md:space-y-8">
              <h3 className="text-lg md:text-xl font-black text-slate-800 border-b pb-4 flex items-center gap-3">تحكم العتاد المباشر <span className="text-[8px] md:text-[10px] text-red-500 font-black animate-pulse">LIVE</span></h3>
              <div className="space-y-3 md:space-y-4">
                 <HardwareToggle label="قفل الميكروفون" active={child.micBlocked} icon="🎙️" onToggle={() => onUpdateDevice(child.id, { micBlocked: !child.micBlocked })} />
                 <HardwareToggle label="قفل الكاميرا" active={child.cameraBlocked} icon="📷" onToggle={() => onUpdateDevice(child.id, { cameraBlocked: !child.cameraBlocked })} />
                 <HardwareToggle label="منع التثبيت" active={child.preventAppInstall} icon="📲" onToggle={() => onUpdateDevice(child.id, { preventAppInstall: !child.preventAppInstall })} />
              </div>
           </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl p-6 md:p-10 rounded-2xl md:rounded-[4rem] border border-white shadow-2xl">
         <div className="flex flex-col sm:flex-row justify-between items-center mb-6 md:mb-10 px-2 gap-4">
            <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter text-center sm:text-right">جدار حماية التطبيقات</h3>
            <span className="text-[8px] md:text-[10px] font-black text-slate-400 bg-slate-100 px-4 py-1 rounded-full uppercase">إجمالي {child.appUsage.length} مرصود</span>
         </div>
         <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-6">
            {child.appUsage.map(app => (
              <button key={app.id} onClick={() => onToggleAppBlock(child.id, app.id)} className={`relative w-full aspect-square rounded-2xl md:rounded-[2.5rem] flex flex-col items-center justify-center transition-all border-2 md:border-4 ${app.isBlocked ? 'bg-red-50 border-red-500 shadow-lg' : 'bg-white border-slate-50 hover:scale-105 shadow-sm'}`}>
                 <span className="text-2xl md:text-4xl mb-1">{app.icon}</span>
                 <p className="text-[7px] md:text-[9px] font-black truncate w-full px-2 text-center text-slate-700">{app.appName}</p>
                 {app.isBlocked && <div className="absolute inset-0 bg-red-600/5 rounded-2xl md:rounded-[2.5rem] flex items-center justify-center text-xl">🚫</div>}
              </button>
            ))}
         </div>
      </div>
    </div>
  );
};

const HardwareToggle: React.FC<{ label: string, active: boolean, icon: string, onToggle: () => void }> = ({ label, active, icon, onToggle }) => (
  <div onClick={onToggle} className={`flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border-2 cursor-pointer transition-all ${active ? 'bg-red-50 border-red-200 shadow-md' : 'bg-slate-50/50 border-transparent hover:bg-slate-100'}`}>
     <div className="flex items-center gap-3 md:gap-4">
        <span className="text-xl md:text-2xl">{icon}</span>
        <span className="text-xs md:text-sm font-black text-slate-700">{label}</span>
     </div>
     <div className={`w-10 md:w-12 h-6 md:h-7 rounded-full p-1 transition-all ${active ? 'bg-red-600' : 'bg-slate-300'}`}>
        <div className={`w-4 h-4 md:w-5 md:h-5 bg-white rounded-full shadow-lg transition-transform ${active ? '-translate-x-4 md:-translate-x-5' : 'translate-x-0'}`}></div>
     </div>
  </div>
);

export default DevicesView;
