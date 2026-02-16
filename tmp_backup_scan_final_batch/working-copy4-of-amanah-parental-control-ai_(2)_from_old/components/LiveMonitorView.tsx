
import React, { useState, useEffect } from 'react';
import { Child, MonitoringAlert, Category } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';
import { sendRemoteCommand, subscribeToAlerts } from '../services/firestoreService';

interface LiveMonitorViewProps {
  children: Child[];
  lang: 'ar' | 'en';
}

const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({ children, lang }) => {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find(c => c.id === selectedChildId) || children[0];
  const [isLockdown, setIsLockdown] = useState(false);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);
  
  const t = translations[lang];

  // مراقبة وصول صور جديدة من هاتف الطفل
  useEffect(() => {
    if (!child || !child.parentId) return;

    const unsub = subscribeToAlerts(child.parentId, (alerts) => {
      // البحث عن أحدث لقطة شاشة تخص هذا الطفل تم إرسالها للتو (خلال آخر 30 ثانية مثلاً)
      const latestImageAlert = alerts.find(a => 
        a.childName === child.name && 
        a.imageData && 
        (a.content.includes("لقطة شاشة") || a.category === Category.SAFE)
      );

      if (latestImageAlert && latestImageAlert.imageData) {
        setLiveScreenshot(latestImageAlert.imageData);
        setIsCapturing(false);
      }
    });

    return () => unsub();
  }, [child]);

  const requestInstantScreenshot = async () => {
    if (!child) return;
    setIsCapturing(true);
    // إرسال الأمر للهاتف
    await sendRemoteCommand(child.id, 'takeScreenshot', true);
    
    // إذا لم تصل صورة خلال 15 ثانية، نلغي حالة التحميل
    setTimeout(() => setIsCapturing(false), 15000);
  };

  const triggerSiren = async () => {
    if (!child) return;
    setIsSirenActive(true);
    await sendRemoteCommand(child.id, 'playSiren', true);
    setTimeout(() => setIsSirenActive(false), 3000);
  };

  const toggleEmergencyLock = async () => {
    if (!child) return;
    const newState = !isLockdown;
    setIsLockdown(newState);
    await sendRemoteCommand(child.id, 'lockDevice', newState);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* شريط اختيار الطفل */}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
         {children.map(c => (
           <button key={c.id} onClick={() => { setSelectedChildId(c.id); setLiveScreenshot(null); }} className={`flex items-center gap-3 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`}>
              <img src={c.avatar} className="w-10 h-10 rounded-xl object-cover" />
              <div className="text-right">
                <p className="font-black text-sm">{c.name}</p>
                <p className={`text-[8px] font-bold ${c.status === 'online' ? 'text-emerald-400' : 'text-slate-400'}`}>Online</p>
              </div>
           </button>
         ))}
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-10 bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] shadow-xl border border-white">
        <div className="flex items-center gap-6">
           <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white text-3xl shadow-2xl ${isCapturing ? 'bg-amber-500 animate-spin' : 'bg-indigo-600 animate-pulse'}`}>
              <ICONS.LiveCamera />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter">مركز الرصد الحقيقي</h2>
              <p className="text-slate-500 font-bold text-lg mt-1">التحكم والتقاط الشاشة لـ: <span className="text-indigo-600 font-black">{child?.name || '...'}</span></p>
           </div>
        </div>
        <div className="flex flex-wrap justify-center gap-5">
           <button onClick={toggleEmergencyLock} className={`px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-xl ${isLockdown ? 'bg-red-600 text-white border-b-4 border-red-800' : 'bg-slate-900 text-white'}`}>
             {isLockdown ? '🔓 إلغاء القفل' : '🔒 قفل الهاتف الآن'}
           </button>
           <button onClick={requestInstantScreenshot} disabled={isCapturing} className={`px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 bg-indigo-600 text-white shadow-xl shadow-indigo-100 disabled:opacity-50`}>
             {isCapturing ? '📡 جاري جلب اللقطة...' : '📸 التقاط شاشة حية'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 space-y-10">
          <div className="relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl aspect-video border-[12px] border-slate-900 ring-4 ring-indigo-500/10">
            {isLockdown ? (
              <div className="absolute inset-0 z-50 bg-red-950/90 flex flex-col items-center justify-center text-white text-center p-10 animate-in fade-in">
                 <div className="text-8xl mb-6">🛡️</div>
                 <h4 className="text-5xl font-black tracking-tighter mb-4 uppercase">DEVICE LOCKED</h4>
                 <p className="text-red-200 text-xl font-bold">هاتف الطفل مغلق تماماً الآن.</p>
              </div>
            ) : liveScreenshot ? (
              <div className="absolute inset-0 group">
                <img src={liveScreenshot} className="w-full h-full object-contain animate-in fade-in duration-500 bg-black" alt="Live Stream" />
                <div className="absolute top-8 right-8 bg-red-600 text-white px-6 py-2 rounded-full text-[10px] font-black animate-pulse shadow-2xl">
                   🔴 بث حي
                </div>
                <div className="absolute bottom-8 left-8 bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-mono">
                   {new Date().toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-8 bg-slate-900">
                {isCapturing ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-24 h-24 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-black text-indigo-400 animate-pulse tracking-widest uppercase text-xs text-center px-10">Waiting for device handshake and image upload...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-32 h-32 bg-white/5 rounded-3xl flex items-center justify-center border-2 border-white/10 text-5xl opacity-40">👁️</div>
                    <p className="font-black tracking-[0.4em] uppercase text-xs mb-2">اضغط على زر التقاط شاشة لعرض البث</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 space-y-10">
           <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white space-y-8">
              <h3 className="text-xl font-black border-b border-white/10 pb-4 flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                حالة الاتصال النشط
              </h3>
              <div className="space-y-6">
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                    <span className="text-xs font-bold text-slate-400">زمن الاستجابة</span>
                    <span className="text-[10px] font-mono text-indigo-400">124ms</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                    <span className="text-xs font-bold text-slate-400">تشفير البيانات</span>
                    <span className="text-[10px] font-mono text-emerald-400">AES-256</span>
                 </div>
              </div>
           </div>

           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 flex flex-col items-center justify-center space-y-8">
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">صافرة الطوارئ</h3>
                <p className="text-xs text-slate-400 font-bold">إرسال صوت عالي جداً لهاتف الطفل</p>
              </div>
              <button 
                onClick={triggerSiren}
                disabled={isSirenActive}
                className={`w-40 h-40 rounded-full border-8 border-white shadow-2xl flex items-center justify-center text-4xl transition-all active:scale-90 group ${isSirenActive ? 'bg-amber-100' : 'bg-red-50 hover:bg-red-100'}`}
              >
                 <span className={`${isSirenActive ? 'animate-ping' : 'group-hover:animate-bounce'}`}>📢</span>
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitorView;
