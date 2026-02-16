
import React, { useState, useEffect, useRef } from 'react';
import { Child, AlertSeverity, Category } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';
import { localSentinelCheck } from '../services/securitySentinel';
import { scanImageLocally, loadVisualSentinelModel } from '../services/visualSentinel';

interface LiveMonitorViewProps {
  children: Child[];
  lang: 'ar' | 'en';
}

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({ children, lang }) => {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find(c => c.id === selectedChildId) || children[0];
  const [isLive, setIsLive] = useState(false);
  const [isLockdown, setIsLockdown] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const t = translations[lang];
  
  // خيارات المصادر
  const [videoSource, setVideoSource] = useState<'camera' | 'screen'>('camera');
  const [audioSource, setAudioSource] = useState<'mic' | 'system'>('mic');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Audio Analysis State
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Avoid ArrayBuffer vs SharedArrayBuffer generic incompatibilities across TS/lib versions
  // by using the default Uint8Array type.
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // SonicWall (Speech) State
  const recognitionRef = useRef<any>(null);
  const [transcripts, setTranscripts] = useState<{text: string, isDanger: boolean, timestamp: Date}[]>([]);
  
  // VisionGuard (Video) State
  const visionIntervalRef = useRef<any>(null);
  const [visionThreat, setVisionThreat] = useState<{label: string, prob: number} | null>(null);
  
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [sentiment, setSentiment] = useState<'CALM' | 'AGITATED' | 'AGGRESSIVE'>('CALM');

  useEffect(() => {
    // Preload the Vision Model on mount
    loadVisualSentinelModel();

    return () => {
      stopAllServices();
    };
  }, []);

  const stopAllServices = () => {
      if (audioContextRef.current) audioContextRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
      
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
  };

  // --- VisionGuard: تحليل الفيديو اللحظي ---
  const startVisionGuard = () => {
    if (!videoRef.current) return;

    // فحص إطار واحد كل ثانية (لتحسين الأداء)
    visionIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        // تحويل إطار الفيديو الحالي إلى صورة للفحص
        // نستخدم عنصر الفيديو مباشرة لأنه HTMLImageElement-compatible في بعض المكتبات، 
        // أو يمكن رسمه على كانفاس مخفي. هنا نمرره مباشرة للدالة التي ستتعامل معه.
        
        // ملاحظة: scanImageLocally تتوقع HTMLImageElement، لذا سنقوم بإنشاء صورة مؤقتة
        // أو تحديث scanImageLocally لتقبل HTMLVideoElement. 
        // للتبسيط والأداء، سنقوم برسم الإطار على Canvas خفي.
        
        const canvas = document.createElement('canvas');
        canvas.width = 224; // حجم مناسب للشبكات العصبية
        canvas.height = 224;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            // تحويل الكانفاس إلى صورة للفحص (محاكاة للكائن المطلوب)
            const img = new Image();
            img.src = canvas.toDataURL('image/jpeg');
            
            // ننتظر تحميل الصورة في الذاكرة
            img.onload = async () => {
                const result = await scanImageLocally(img);
                
                if (result.isDanger) {
                    setVisionThreat({ label: result.label, prob: result.probability });
                    // إجراء أمني فوري: قفل الشاشة
                    if (result.severity === AlertSeverity.CRITICAL) {
                        setIsLockdown(true);
                        // يمكن إضافة صوت إنذار هنا
                    }
                } else {
                    setVisionThreat(null);
                }
            };
        }
    }, 1500); // كل 1.5 ثانية
  };

  // --- SonicWall: تحليل الكلام ---
  const startSpeechRecognition = () => {
    const { webkitSpeechRecognition } = window as unknown as IWindow;
    if (!webkitSpeechRecognition) return;

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) processTranscript(finalTranscript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const processTranscript = (text: string) => {
    const check = localSentinelCheck(text);
    setTranscripts(prev => {
        const newItem = { text, isDanger: check.isDanger, timestamp: new Date() };
        return [newItem, ...prev].slice(0, 5);
    });
    if (check.isDanger && check.severity === AlertSeverity.CRITICAL) {
        setIsLockdown(true);
    }
  };

  // --- Sense Engine: تحليل النبرة ---
  const startAudioAnalysis = (stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) return;
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256; 
      source.connect(analyser);
      
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      // TS DOM lib types may require Uint8Array<ArrayBuffer> for getByteFrequencyData.
      // In practice, Uint8Array(length) is backed by ArrayBuffer, so we cast for compatibility.
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(bufferLength));
      
      const analyze = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        (analyserRef.current as any).getByteFrequencyData(dataArrayRef.current);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArrayRef.current[i];
        const average = sum / bufferLength;
        const vol = Math.min(100, (average / 255) * 250); 
        setVolumeLevel(vol);

        if (vol > 65) setSentiment('AGGRESSIVE');
        else if (vol > 30) setSentiment('AGITATED');
        else setSentiment('CALM');

        animationFrameRef.current = requestAnimationFrame(analyze);
      };
      analyze();
    } catch (e) {
      console.error("Audio Analysis Failed:", e);
    }
  };

  const toggleLive = async () => {
    if (!isLive) {
      const constraints = {
        video: true,
        audio: (videoSource === 'screen' ? audioSource === 'system' : audioSource === 'mic')
      };

      try {
        let stream: MediaStream;
        try {
            if (videoSource === 'screen') {
              stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            } else {
              stream = await navigator.mediaDevices.getUserMedia(constraints);
            }
        } catch (initialErr: any) {
            if (constraints.audio) {
                const videoOnlyConstraints = { video: true, audio: false };
                stream = videoSource === 'screen' 
                    ? await navigator.mediaDevices.getDisplayMedia(videoOnlyConstraints)
                    : await navigator.mediaDevices.getUserMedia(videoOnlyConstraints);
                alert(lang === 'ar' ? 'تم تشغيل الفيديو فقط (الصوت غير متاح).' : 'Video only mode.');
            } else {
                throw initialErr;
            }
        }

        if (videoRef.current) videoRef.current.srcObject = stream;
        
        // تشغيل المحركات الذكية
        if (stream.getAudioTracks().length > 0) {
           startAudioAnalysis(stream);
           startSpeechRecognition(); // SonicWall
        }
        
        // تشغيل VisionGuard (للفيديو)
        startVisionGuard();

        setIsLive(true);
      } catch (err: any) {
        console.error("Live Error:", err);
        alert(`Error: ${err.name}`);
      }
    } else {
      stopAllServices();
      setVolumeLevel(0);
      setSentiment('CALM');
      setTranscripts([]);
      setVisionThreat(null);
      setIsLive(false);
    }
  };

  const getSentimentColor = () => {
    switch(sentiment) {
      case 'AGGRESSIVE': return 'bg-red-500 text-white animate-pulse shadow-red-500/50';
      case 'AGITATED': return 'bg-amber-400 text-white shadow-amber-400/50';
      default: return 'bg-emerald-500 text-white shadow-emerald-500/50';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Child Selector */}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
         {children.map(c => (
           <button 
             key={c.id} 
             onClick={() => { setSelectedChildId(c.id); setIsLive(false); }}
             className={`flex items-center gap-3 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`}
           >
              <img src={c.avatar} className="w-10 h-10 rounded-xl object-cover border-2 border-white" />
              <div className={`text-${lang === 'ar' ? 'right' : 'left'}`}>
                <p className="font-black text-sm">{c.name}</p>
                <p className={`text-[8px] font-bold ${c.status === 'online' ? 'text-emerald-400' : 'text-slate-400'}`}>{c.status === 'online' ? 'Online' : 'Offline'}</p>
              </div>
           </button>
         ))}
      </div>

      {/* Control Header */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-10 bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] shadow-xl border border-white">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-2xl animate-pulse">
              <ICONS.LiveCamera />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{t.liveControl}</h2>
              <p className="text-slate-500 font-bold text-lg mt-1">{t.liveStreamFor} <span className="text-indigo-600 font-black">{child.name}</span></p>
           </div>
        </div>

        <div className="flex flex-wrap justify-center gap-5">
           <button 
             onClick={() => setIsLockdown(!isLockdown)}
             className={`px-10 py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95 ${isLockdown ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}
           >
             {isLockdown ? `🔓 ${t.undimScreen}` : `🌑 ${t.dimScreen}`}
           </button>
           <button 
             onClick={toggleLive}
             className={`px-10 py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95 ${isLive ? 'bg-indigo-950 text-white' : 'bg-indigo-600 text-white shadow-indigo-100'}`}
           >
             {isLive ? `🔴 ${t.endStream}` : `📡 ${t.startStream}`}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 space-y-10">
          {/* Main Video Screen with VisionGuard & SonicWall Overlays */}
          <div className="relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.3)] aspect-video border-[12px] border-slate-900 ring-4 ring-indigo-500/20 group">
            
            {/* 1. Lockdown Overlay */}
            {isLockdown && (
              <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white text-center p-10 animate-in fade-in duration-300">
                 <div className="text-7xl mb-6 animate-bounce">🛡️</div>
                 <h4 className="text-4xl font-black tracking-tighter mb-4 uppercase text-red-500">{t.activeLock}</h4>
                 <p className="text-slate-300 font-bold text-lg max-w-md mb-2">
                    {visionThreat ? `تم رصد محتوى بصري مخالف: ${visionThreat.label}` : 'Device screen is locked for safety.'}
                 </p>
                 {visionThreat && <p className="text-xs font-mono text-red-400">Confidence: {(visionThreat.prob * 100).toFixed(1)}%</p>}
              </div>
            )}

            {!isLive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-8 bg-slate-900">
                <div className="w-32 h-32 bg-white/5 rounded-3xl flex items-center justify-center border-2 border-white/10 text-5xl opacity-40"><ICONS.LiveCamera /></div>
                <div className="text-center">
                   <p className="font-black tracking-[0.4em] uppercase text-xs mb-2">{t.waitingSignal}</p>
                   <p className="text-[10px] font-bold text-slate-500">{t.selectSource}</p>
                </div>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                
                {/* 2. Live Status Badge */}
                <div className="absolute top-8 right-8 flex gap-4 z-20">
                   <div className="bg-red-600 text-white text-[10px] font-black px-8 py-3 rounded-full flex items-center gap-3 shadow-2xl">
                     <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></span>
                     LIVE • {videoSource === 'camera' ? 'CAMERA' : 'SCREEN'}
                   </div>
                </div>

                {/* 3. VisionGuard Indicator */}
                <div className="absolute top-8 left-8 z-20">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md ${visionThreat ? 'bg-red-600/80 border-red-400 text-white animate-pulse' : 'bg-black/30 border-white/10 text-white/50'}`}>
                        <span className="text-xl">👁️</span>
                        <div className="text-[9px] font-black uppercase tracking-widest">
                            {visionThreat ? `THREAT: ${visionThreat.label}` : 'VisionGuard Active'}
                        </div>
                    </div>
                </div>

                {/* 4. SonicWall Transcripts */}
                {transcripts.length > 0 && (
                    <div className="absolute top-24 right-8 left-8 flex flex-col items-end gap-2 z-20 pointer-events-none">
                        {transcripts.map((t, idx) => (
                            <div key={idx} className={`max-w-md p-4 rounded-2xl backdrop-blur-md border animate-in slide-in-from-right-10 duration-300 ${t.isDanger ? 'bg-red-600/80 border-red-400 text-white shadow-red-900/50 shadow-xl' : 'bg-black/40 border-white/10 text-white shadow-lg'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[8px] font-black uppercase opacity-70">{t.timestamp.toLocaleTimeString()}</span>
                                    {t.isDanger && <span className="bg-white text-red-600 text-[8px] font-black px-1.5 rounded uppercase">THREAT</span>}
                                </div>
                                <p className="text-sm font-bold leading-snug">"{t.text}"</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* 5. Audio Intelligence (Sense Layer) */}
                {(audioSource === 'mic' || audioSource === 'system') && volumeLevel > 0 && (
                  <div className="absolute bottom-8 left-8 right-8 bg-black/40 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 flex items-center justify-between z-20 transition-all">
                      <div className="flex items-center gap-4">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-colors duration-300 ${getSentimentColor()}`}>
                            {sentiment === 'AGGRESSIVE' ? '🤬' : sentiment === 'AGITATED' ? '😨' : '🙂'}
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.audioAnalysis}</p>
                            <p className="text-white font-black text-sm">{transcripts.length > 0 ? t.liveTranscript : t.detectingAudio}</p>
                         </div>
                      </div>
                      
                      {/* Audio Visualizer Bar */}
                      <div className="flex items-center gap-1 h-8">
                         {[...Array(15)].map((_, i) => (
                            <div 
                              key={i} 
                              className={`w-1.5 rounded-full transition-all duration-75 ${i < volumeLevel / 6.5 ? (sentiment === 'AGGRESSIVE' ? 'bg-red-500' : 'bg-indigo-400') : 'bg-white/10'}`}
                              style={{ height: `${Math.max(20, Math.min(100, Math.random() * (volumeLevel * 1.5)))}%` }}
                            ></div>
                         ))}
                      </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar Controls (Config) */}
        <div className="xl:col-span-4 space-y-10">
           {/* Source Selection Card */}
           <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-xl space-y-8">
              <h3 className="text-xl font-black text-slate-800 border-b pb-4 flex items-center gap-3">
                 {t.configStream}
                 <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-black">AI Config</span>
              </h3>
              
              <div className="space-y-6">
                 {/* Video Source */}
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t.videoSource}</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button 
                         onClick={() => !isLive && setVideoSource('camera')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${videoSource === 'camera' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">📷</span>
                          <span className="text-[10px] font-black">{t.camera}</span>
                       </button>
                       <button 
                         onClick={() => !isLive && setVideoSource('screen')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${videoSource === 'screen' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">📱</span>
                          <span className="text-[10px] font-black">{t.screen}</span>
                       </button>
                    </div>
                 </div>

                 {/* Audio Source */}
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t.audioSource}</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button 
                         onClick={() => !isLive && setAudioSource('mic')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${audioSource === 'mic' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">🎙️</span>
                          <span className="text-[10px] font-black">{t.mic}</span>
                       </button>
                       <button 
                         onClick={() => !isLive && setAudioSource('system')}
                         className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${audioSource === 'system' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          <span className="text-2xl">🔊</span>
                          <span className="text-[10px] font-black">{t.systemAudio}</span>
                       </button>
                    </div>
                 </div>
              </div>
              
              {isLive && (
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-pulse">
                   <p className="text-[9px] font-black text-indigo-700 text-center leading-relaxed">
                      {t.streamingNow}
                   </p>
                </div>
              )}
           </div>

           {/* Walkie-Talkie Section */}
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 flex flex-col items-center justify-center space-y-12 relative overflow-hidden group">
              <div className="text-center space-y-3 relative z-10">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner border border-indigo-100 mb-6">📻</div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{t.walkieTalkie}</h3>
              </div>
              <div className="flex items-center justify-center gap-1.5 h-32 w-full px-4 relative z-10">
                 {[...Array(30)].map((_, i) => (
                   <div 
                     key={i} 
                     className={`w-1.5 rounded-full transition-all duration-75 ${isTalking ? 'bg-indigo-600' : 'bg-slate-200'}`} 
                     style={{ height: isTalking ? `${Math.random() * 80 + 20}%` : '20%', opacity: isTalking ? 1 : 0.4 }}
                   ></div>
                 ))}
              </div>
              <div className="relative z-10">
                 <button 
                   onMouseDown={() => setIsTalking(true)} onMouseUp={() => setIsTalking(false)}
                   onTouchStart={() => setIsTalking(true)} onTouchEnd={() => setIsTalking(false)}
                   className={`w-52 h-52 rounded-full border-[10px] transition-all active:scale-90 shadow-2xl flex flex-col items-center justify-center gap-4 ${isTalking ? 'bg-indigo-600 border-indigo-400 text-white scale-105' : 'bg-slate-50 border-white text-slate-300'}`}
                 >
                    <div className={isTalking ? 'animate-bounce' : ''}><ICONS.WalkieTalkie /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{isTalking ? t.talking : t.pushToTalk}</span>
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitorView;
