
import React, { useState, useEffect, useRef } from 'react';
import { Child } from './types';
import { ICONS } from './constants';

interface LiveMonitorViewProps {
  children: Child[];
  lang: 'ar' | 'en';
}

const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({ children, lang }) => {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find(c => c.id === selectedChildId) || children[0];
  const [isLive, setIsLive] = useState(false);
  const [isLockdown, setIsLockdown] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  
  // خيارات المصادر
  const [videoSource, setVideoSource] = useState<'camera' | 'screen'>('camera');
  const [audioSource, setAudioSource] = useState<'mic' | 'system'>('mic');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [waveform, setWaveform] = useState<number[]>(new Array(30).fill(5));

  useEffect(() => {
    let interval: any;
    if (isLive || isTalking) {
      interval = setInterval(() => {
        setWaveform(prev => prev.map(() => Math.random() * 40 + 5));
      }, 80);
    } else {
      setWaveform(new Array(30).fill(4));
    }
    return () => clearInterval(interval);
  }, [isLive, isTalking]);

  const toggleLive = async () => {
    if (!isLive) {
      try {
        let stream: MediaStream;
        
        if (videoSource === 'screen') {
          // بث الشاشة - يتطلب getDisplayMedia
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: audioSource === 'system' // طلب صوت النظام مع الشاشة
          });
        } else {
          // بث الكاميرا - يتطلب getUserMedia
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: audioSource === 'mic'
          });
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsLive(true);
      } catch (err) {
        console.error("Live streaming error:", err);
        const msg = lang === 'ar' 
          ? 'تعذر الوصول للمصدر المختار. يرجى التأكد من منح الصلاحيات اللازمة في المتصفح.' 
          : 'Could not access the selected source. Please check browser permissions.';
        alert(msg);
      }
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsLive(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700" dir="rtl">
      
      {/* Child Selector for Live Monitoring */}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
         {children.map(c => (
           <button 
             key={c.id} 
             onClick={() => { setSelectedChildId(c.id); setIsLive(false); }}
             className={`flex items-center gap-3 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`}
           >
              <img src={c.avatar} className="w-10 h-10 rounded-xl object-cover border-2 border-white" />
              <div className="text-right">
                <p className="font-black text-sm">{c.name}</p>
                <p className={`text-[8px] font-bold ${c.status === 'online' ? 'text-emerald-400' : 'text-slate-400'}`}>{c.status === 'online' ? 'متصل' : 'أوفلاين'}</p>
              </div>
           </button>
         ))}
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-10 bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] shadow-xl border border-white">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-2xl animate-pulse">
              <ICONS.LiveCamera />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter">مركز التحكم المباشر</h2>
              <p className="text-slate-500 font-bold text-lg mt-1">بث مباشر لجهاز: <span className="text-indigo-600 font-black">{child.name}</span></p>
           </div>
        </div>

        <div className="flex flex-wrap justify-center gap-5">
           <button 
             onClick={() => setIsLockdown(!isLockdown)}
             className={`px-10 py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95 ${isLockdown ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}
           >
             {isLockdown ? '🔓 إلغاء التعتيم' : '🌑 تعتيم الشاشة'}
           </button>
           <button 
             onClick={toggleLive}
             className={`px-10 py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95 ${isLive ? 'bg-indigo-950 text-white' : 'bg-indigo-600 text-white shadow-indigo-100'}`}
           >
             {isLive ? '🔴 إنهاء البث' : '📡 فتح بث مباشر'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 space-y-10">
          {/* Main Video Screen */}
          <div className="relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.3)] aspect-video border-[12px] border-slate-900 ring-4 ring-indigo-500/20 group">
            {isLockdown && (
              <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white text-center p-10 animate-in fade-in">
                 <div className="text-7xl mb-6">🌑</div>
                 <h4 className="text-4xl font-black tracking-tighter mb-4 uppercase">وضع القفل النشط</h4>
                 <p className="text-slate-400 font-bold text-lg max-w-md">شاشة {child.name} معطلة تماماً الآن لضمان الحماية.</p>
              </div>
            )}
            {!isLive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-8 bg-slate-900">
                <div className="w-32 h-32 bg-white/5 rounded-3xl flex items-center justify-center border-2 border-white/10 text-5xl opacity-40"><ICONS.LiveCamera /></div>
                <div className="text-center">
                   <p className="font-black tracking-[0.4em] uppercase text-xs mb-2">في انتظار إشارة البث</p>
                   <p className="text-[10px] font-bold text-slate-500">اختر المصادر من القائمة الجانبية ثم ابدأ البث</p>
                </div>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute top-8 right-8 flex gap-4">
                   <div className="bg-red-600 text-white text-[10px] font-black px-8 py-3 rounded-full flex items-center gap-3 shadow-2xl">
                     <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></span>
                     LIVE • {videoSource === 'camera' ? 'CAMERA' : 'SCREEN'}
                   </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 space-y-10">
           {/* Source Selection Card */}
           <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-xl space-y-8">
              <h3 className="text-xl font-black text-slate-800 border-b pb-4 flex items-center gap-3">
                 تكوين البث
                 <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-black">AI Config</span>
              </h3>
              
              <div className="space-y-6">
                 {/* Video Source */}
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">مصدر الفيديو</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button 
                         onClick={() => !isLive && setVideoSource('camera')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${videoSource === 'camera' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">📷</span>
                          <span className="text-[10px] font-black">الكاميرا</span>
                       </button>
                       <button 
                         onClick={() => !isLive && setVideoSource('screen')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${videoSource === 'screen' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">📱</span>
                          <span className="text-[10px] font-black">شاشة الجهاز</span>
                       </button>
                    </div>
                 </div>

                 {/* Audio Source */}
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">مصدر الصوت</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button 
                         onClick={() => !isLive && setAudioSource('mic')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${audioSource === 'mic' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">🎙️</span>
                          <span className="text-[10px] font-black">الميكروفون</span>
                       </button>
                       <button 
                         onClick={() => !isLive && setAudioSource('system')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${audioSource === 'system' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">🔊</span>
                          <span className="text-[10px] font-black">صوت النظام</span>
                       </button>
                    </div>
                 </div>
              </div>
              
              {isLive && (
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-pulse">
                   <p className="text-[9px] font-black text-indigo-700 text-center leading-relaxed">
                      يتم الآن البث المباشر. تغيير المصادر يتطلب إنهاء البث الحالي أولاً.
                   </p>
                </div>
              )}
           </div>

           {/* Walkie-Talkie Section */}
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 flex flex-col items-center justify-center space-y-12 relative overflow-hidden group">
              <div className="text-center space-y-3 relative z-10">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner border border-indigo-100 mb-6">📻</div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">جهاز لاسلكي</h3>
              </div>
              <div className="flex items-center justify-center gap-1.5 h-32 w-full px-4 relative z-10">
                 {waveform.map((h, i) => (
                   <div key={i} className={`w-1.5 rounded-full transition-all duration-150 ${isTalking ? 'bg-indigo-600' : 'bg-slate-200'}`} style={{ height: `${h}%`, opacity: isTalking ? 1 : 0.4 }}></div>
                 ))}
              </div>
              <div className="relative z-10">
                 <button 
                   onMouseDown={() => setIsTalking(true)} onMouseUp={() => setIsTalking(false)}
                   onTouchStart={() => setIsTalking(true)} onTouchEnd={() => setIsTalking(false)}
                   className={`w-52 h-52 rounded-full border-[10px] transition-all active:scale-90 shadow-2xl flex flex-col items-center justify-center gap-4 ${isTalking ? 'bg-indigo-600 border-indigo-400 text-white scale-105' : 'bg-slate-50 border-white text-slate-300'}`}
                 >
                    <div className={isTalking ? 'animate-bounce' : ''}><ICONS.WalkieTalkie /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{isTalking ? 'تحدث الآن' : 'اضغط للتحدث'}</span>
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitorView;
