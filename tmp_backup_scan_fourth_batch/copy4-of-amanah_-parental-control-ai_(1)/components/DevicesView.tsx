
import React, { useState } from 'react';
import { Child, AppUsage, ChildLocation } from '../types';
import { ICONS } from '../constants';
import { analyzeLocationSafety } from '../services/geminiService';
import { translations } from '../translations';

interface DevicesViewProps {
  children: Child[];
  onToggleAppBlock: (childId: string, appId: string) => void;
  onUpdateDevice: (childId: string, updates: Partial<Child>) => void;
  lang: 'ar' | 'en';
}

const DEVICE_ICONS = [
  { label: 'Smartphone', icon: '📱' },
  { label: 'Tablet', icon: '平板' }, // Tablet
  { label: 'Laptop', icon: '💻' },
  { label: 'Gaming', icon: '🎮' }
];

const DevicesView: React.FC<DevicesViewProps> = ({ children, onToggleAppBlock, onUpdateDevice, lang }) => {
  const t = translations[lang];
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find(c => c.id === selectedChildId) || children[0];
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationIntel, setLocationIntel] = useState<{text: string, mapsLinks: any[]} | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', nickname: '', avatar: '' });

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

  const handleStartEdit = () => {
    setEditData({ 
      name: child.name, 
      nickname: child.deviceNickname || '', 
      avatar: child.avatar 
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onUpdateDevice(child.id, { 
      name: editData.name, 
      deviceNickname: editData.nickname,
      avatar: editData.avatar
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-10 pb-40 animate-in fade-in duration-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Child Selector */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar flex-1 items-center">
           {children.map(c => (
             <button key={c.id} onClick={() => { setSelectedChildId(c.id); setLocationIntel(null); }} className={`flex items-center gap-4 px-6 py-3.5 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`}>
                <img src={c.avatar} className="w-12 h-12 rounded-full object-cover shadow-sm border border-white/50" />
                <div className="text-right">
                  <span className="font-black text-sm block leading-none">{c.name}</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest mt-1 block ${selectedChildId === c.id ? 'text-indigo-200' : 'text-slate-400'}`}>{c.deviceNickname || 'Android Mobile'}</span>
                </div>
             </button>
           ))}
        </div>
        
        <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] flex items-center gap-8 shadow-2xl border-b-4 border-indigo-600">
           <div className="flex flex-col items-center gap-1">
              <p className="text-[8px] font-black text-indigo-400 uppercase">البطارية</p>
              <div className="flex items-center gap-2">
                 <div className={`w-8 h-4 rounded-sm border border-white/40 p-0.5 relative`}>
                    <div className={`h-full ${child.batteryLevel > 20 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${child.batteryLevel}%` }}></div>
                 </div>
                 <span className="text-[10px] font-black">{child.batteryLevel}%</span>
              </div>
           </div>
           <div className="flex flex-col items-center gap-1">
              <p className="text-[8px] font-black text-indigo-400 uppercase">الشبكة</p>
              <div className="flex items-end gap-0.5 h-4">
                 {[1, 2, 3, 4].map(i => <div key={i} className={`w-1 rounded-full ${child.signalStrength >= i ? 'bg-indigo-500' : 'bg-white/10'}`} style={{ height: `${i*25}%` }}></div>)}
              </div>
           </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Map Section */}
        <div className="lg:col-span-8 bg-white/70 backdrop-blur-2xl rounded-[3.5rem] border border-white shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
           <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Live GPS & Geofencing</h3>
                <p className="text-xs font-bold text-slate-400">تتبع حي مع ميزة المناطق الآمنة.</p>
              </div>
              <button onClick={trackLocation} disabled={loadingLocation} className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-3 transition-all active:scale-95 ${loadingLocation ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white shadow-lg'}`}>
                {loadingLocation ? <span className="animate-spin text-lg">⏳</span> : <ICONS.Location />}
                تحديث الموقع
              </button>
           </div>
           <div className="flex-1 relative bg-slate-100 flex items-center justify-center overflow-hidden">
              {child.location ? (
                <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={`https://maps.google.com/maps?q=${child.location.lat},${child.location.lng}&z=15&output=embed`} className="absolute inset-0 grayscale-[0.2] contrast-[1.1]"></iframe>
              ) : (
                <div className="flex flex-col items-center gap-6 opacity-30"><div className="text-8xl">🌍</div><p className="font-black text-xl text-center">بانتظار إشارة الـ GPS لجهاز {child.name}</p></div>
              )}
           </div>
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-xl space-y-6">
              <h3 className="text-xl font-black text-slate-800 border-b pb-4 flex items-center gap-3">تحكم العتاد المباشر <span className="text-[10px] text-red-500 font-black animate-pulse">LIVE</span></h3>
              <div className="space-y-4">
                 <HardwareToggle label="قفل الميكروفون" active={child.micBlocked} icon="🎙️" onToggle={() => onUpdateDevice(child.id, { micBlocked: !child.micBlocked })} />
                 <HardwareToggle label="قفل الكاميرا" active={child.cameraBlocked} icon="📷" onToggle={() => onUpdateDevice(child.id, { cameraBlocked: !child.cameraBlocked })} />
                 <HardwareToggle label="منع التثبيت" active={child.preventAppInstall} icon="📲" onToggle={() => onUpdateDevice(child.id, { preventAppInstall: !child.preventAppInstall })} />
                 <HardwareToggle 
                    label={t.preventLock} 
                    active={child.preventDeviceLock || false} 
                    icon="🔓" 
                    onToggle={() => onUpdateDevice(child.id, { preventDeviceLock: !child.preventDeviceLock })} 
                 />
              </div>
              
              <button 
                onClick={handleStartEdit}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
              >
                <ICONS.Settings className="w-5 h-5 text-indigo-400" />
                {t.customizeDevice}
              </button>
           </div>

           <div className="bg-slate-900 rounded-[3rem] p-8 shadow-2xl text-white relative overflow-hidden h-full flex flex-col justify-between group">
              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><ICONS.Shield /></div>
                  <h4 className="text-xl font-black tracking-tight">تحليل المحيط (AI Ambient)</h4>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl italic text-xs font-bold leading-relaxed text-indigo-100">
                  {locationIntel?.text || "بانتظار بيانات الموقع لتحليل جودة المنطقة المحيطة ودرجة الأمان."}
                </div>
              </div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl group-hover:scale-150 transition-transform"></div>
           </div>
        </div>
      </div>

      {/* App Wall */}
      <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[4rem] border border-white shadow-2xl">
         <div className="flex justify-between items-center mb-10 px-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter">جدار حماية التطبيقات</h3>
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-4 py-1 rounded-full uppercase">إجمالي {child.appUsage.length} تطبيق مرصود</span>
         </div>
         <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
            {child.appUsage.map(app => (
              <button key={app.id} onClick={() => onToggleAppBlock(child.id, app.id)} className={`relative w-full aspect-square rounded-[2.5rem] flex flex-col items-center justify-center transition-all border-4 ${app.isBlocked ? 'bg-red-50 border-red-500 shadow-lg' : 'bg-white border-slate-50 hover:scale-105 shadow-sm'}`}>
                 <span className="text-4xl mb-1">{app.icon}</span>
                 <p className="text-[9px] font-black truncate w-full px-2 text-center text-slate-700">{app.appName}</p>
                 {app.isBlocked && <div className="absolute inset-0 bg-red-600/5 rounded-[2.5rem] flex items-center justify-center text-2xl">🚫</div>}
              </button>
            ))}
         </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden border-4 border-white">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <button onClick={() => setIsEditing(false)} className="text-white/60 hover:text-white"><ICONS.Close /></button>
                 <h3 className="text-2xl font-black">{t.customizeDevice}</h3>
              </div>
              <div className="p-10 space-y-8">
                 <div className="flex justify-center">
                    <div className="relative group cursor-pointer">
                       <img src={editData.avatar} className="w-24 h-24 rounded-[2rem] object-cover border-4 border-indigo-50 shadow-xl" />
                       <div className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-white text-[10px] font-black">تغيير</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-4">{lang === 'ar' ? 'اسم الطفل' : 'Child Name'}</label>
                       <input 
                         value={editData.name} 
                         onChange={(e) => setEditData({...editData, name: e.target.value})} 
                         className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-right text-lg focus:border-indigo-500" 
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-4">{t.deviceNickname}</label>
                       <input 
                         value={editData.nickname} 
                         onChange={(e) => setEditData({...editData, nickname: e.target.value})} 
                         placeholder="مثلاً: iPhone 15 Pro"
                         className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-right text-lg focus:border-indigo-500" 
                       />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase px-4">نوع الجهاز</p>
                    <div className="grid grid-cols-4 gap-2">
                       {DEVICE_ICONS.map(di => (
                         <button 
                           key={di.label}
                           onClick={() => setEditData({...editData, nickname: di.label})}
                           className={`p-4 rounded-xl text-2xl bg-slate-50 border-2 transition-all ${editData.nickname.includes(di.label) ? 'border-indigo-500 bg-indigo-50' : 'border-transparent'}`}
                         >
                           {di.icon}
                         </button>
                       ))}
                    </div>
                 </div>

                 <button 
                   onClick={handleSaveEdit}
                   className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all shadow-indigo-200"
                 >
                    {t.saveDeviceSettings}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const HardwareToggle: React.FC<{ label: string, active: boolean, icon: string, onToggle: () => void }> = ({ label, active, icon, onToggle }) => (
  <div onClick={onToggle} className={`flex items-center justify-between p-5 rounded-[2.2rem] border-2 cursor-pointer transition-all ${active ? 'bg-red-50 border-red-200 shadow-md' : 'bg-slate-50/50 border-transparent hover:bg-slate-100'}`}>
     <div className="flex items-center gap-4">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-black text-slate-700">{label}</span>
     </div>
     <div className={`w-12 h-7 rounded-full p-1 transition-all ${active ? 'bg-red-600' : 'bg-slate-300'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${active ? (document.dir === 'rtl' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`}></div>
     </div>
  </div>
);

export default DevicesView;
