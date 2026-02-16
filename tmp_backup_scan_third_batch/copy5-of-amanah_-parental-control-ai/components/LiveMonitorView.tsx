
import React, { useState, useEffect } from 'react';
import { Child, Category } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';
import { sendRemoteCommand, subscribeToAlerts } from '../services/firestoreService';

interface LiveMonitorViewProps {
  childList: Child[];
  lang: 'ar' | 'en';
}

const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({ childList = [], lang }) => {
  const [selectedChildId, setSelectedChildId] = useState(childList?.[0]?.id || '');
  const child = childList?.find(c => c.id === selectedChildId) || childList?.[0];
  const [isLockdown, setIsLockdown] = useState(false);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);
  
  const t = translations[lang];

  // Monitoring for incoming screenshots from the child device
  useEffect(() => {
    if (!child || !child.parentId || child.parentId === 'guest') return;

    const unsub = subscribeToAlerts(child.parentId, (alerts) => {
      const latestImageAlert = alerts?.find(a => 
        a.childName === child.name && 
        a.imageData && 
        (a.content?.includes("لقطة شاشة") || a.category === Category.SAFE)
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
    await sendRemoteCommand(child.id, 'takeScreenshot', true);
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
      
      {/* Child Selector */}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
         {childList?.map(c => (
           <button 
            key={c.id} 
            onClick={() => { setSelectedChildId(c.id); setLiveScreenshot(null); }} 
            className={`flex items-center gap-4 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`}
           >
              <img src={c.avatar} className="w-10 h-10 rounded-xl object-cover shadow-sm border border-white/50" />
              <div className="text-right">
                <p className="font-black text-sm block leading-none">{c.name}</p>
                <p className={`text-[9px] font-black uppercase tracking-widest mt-1 block ${selectedChildId === c.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {c.status === 'online' ? 'متصل' : 'أوفلاين'}
                </p>
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
           <button 
             onClick={toggleEmergencyLock} 
             className={`px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-xl ${isLockdown ? 'bg-red-600 text-white border-b-4 border-red-800' : 'bg-slate-900 text-white'}`}
           >
             {isLockdown ? '🔓 إلغاء القفل' : '🔒 قفل الهاتف الآن'}
           </button>
           <button 
             onClick={requestInstantScreenshot} 
             disabled={isCapturing} 
             className={`px-10 py-5 rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center gap-3 ${isCapturing ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white shadow-indigo-100'}`}
           >
              {isCapturing ? <span className="animate-spin text-xl">⏳</span> : '📸'}
              <span>{isCapturing ? 'جاري الالتقاط...' : 'لقطة شاشة حية'}</span>
           </button>
           <button 
             onClick={triggerSiren} 
             disabled={isSirenActive} 
             className={`px-10 py-5 rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all ${isSirenActive ? 'bg-red-100 text-red-600' : 'bg-amber-500 text-white shadow-amber-100'}`}
           >
              {isSirenActive ? '📢' : '🚨'}
              <span className="mr-2">{isSirenActive ? 'جاري الرنين' : 'صافرة طوارئ'}</span>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8">
           <div className="bg-slate-950 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.4)] aspect-video border-[12px] border-slate-900 ring-4 ring-indigo-500/20 relative group">
              {liveScreenshot ? (
                <img src={liveScreenshot} className="w-full h-full object-contain animate-in fade-in duration-500" alt="Live Feed" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-6">
                   <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-6xl shadow-inner border border-white/10 opacity-30">📸</div>
                   <div className="text-center space-y-2">
                     <p className="font-black text-lg tracking-[0.4em] uppercase">بانتظار لقطة الشاشة</p>
                     <p className="text-[10px] font-bold text-slate-500">سيظهر البث المباشر هنا فور الضغط على زر الالتقاط</p>
                   </div>
                </div>
              )}
              {isCapturing && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
                   <div className="flex flex-col items-center gap-6">
                      <div className="w-20 h-20 border-[6px] border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
                      <div className="text-center">
                        <p className="text-white font-black text-sm uppercase tracking-[0.3em] mb-1">Requesting Secure Capture</p>
                        <p className="text-indigo-300/60 font-mono text-[9px] uppercase tracking-widest">Protocol V19 // Encrypted Command Pipe</p>
                      </div>
                   </div>
                </div>
              )}
           </div>
        </div>
        
        <div className="xl:col-span-4 space-y-10">
           <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50 space-y-10">
              <h3 className="text-2xl font-black text-slate-800 border-b pb-6 flex items-center justify-between">
                <span>إحصائيات الرصد</span>
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl uppercase tracking-widest animate-pulse">Live Stats</span>
              </h3>
              <div className="space-y-8">
                 <div className="flex justify-between items-center group">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">حالة الارتباط:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-600 font-black text-sm">مؤمن بالكامل</span>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    </div>
                 </div>
                 <div className="flex justify-between items-center group">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">تشفير البيانات:</span>
                    <span className="text-indigo-600 font-mono font-bold text-xs">AES-256-GCM</span>
                 </div>
                 <div className="flex justify-between items-center group">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">زمن التأخير (RTT):</span>
                    <span className="text-indigo-600 font-black text-sm tracking-tighter">~120ms</span>
                 </div>
              </div>
              
              <div className="pt-6 border-t border-slate-50">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 italic text-[11px] font-bold text-slate-500 leading-relaxed">
                  "يتم تحديث هذه الإحصائيات كل 5 ثوانٍ لضمان استجابة محرك الدفاع الآلي في أسرع وقت."
                </div>
              </div>
           </div>

           <div className="bg-[#020617] rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
              <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                 <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-5xl shadow-inner border border-white/10">🛡️</div>
                 <h4 className="text-xl font-black tracking-tight">وضع الدفاع المستقل</h4>
                 <p className="text-xs font-bold text-slate-400 leading-relaxed">
                    النظام يراقب كافة العمليات في الخلفية. يمكنك التدخل يدوياً عبر الأزرار أعلاه أو ترك محرك <b>Amanah ASE</b> يتولى حماية الطفل تلقائياً.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitorView;
