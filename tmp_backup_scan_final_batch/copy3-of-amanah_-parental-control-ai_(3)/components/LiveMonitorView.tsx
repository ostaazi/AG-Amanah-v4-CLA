
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
  
  const [videoSource, setVideoSource] = useState<'camera' | 'screen'>('camera');
  const [audioSource, setAudioSource] = useState<'mic' | 'system'>('mic');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const [transcripts, setTranscripts] = useState<{text: string, isDanger: boolean, timestamp: Date}[]>([]);
  const visionIntervalRef = useRef<any>(null);
  const [visionThreat, setVisionThreat] = useState<{label: string, prob: number} | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [sentiment, setSentiment] = useState<'CALM' | 'AGITATED' | 'AGGRESSIVE'>('CALM');

  useEffect(() => {
    loadVisualSentinelModel();
    return () => stopAllServices();
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

  const startVisionGuard = () => {
    if (!videoRef.current) return;
    visionIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
        const canvas = document.createElement('canvas');
        canvas.width = 224;
        canvas.height = 224;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const img = new Image();
            img.src = canvas.toDataURL('image/jpeg');
            img.onload = async () => {
                const result = await scanImageLocally(img);
                if (result.isDanger) {
                    setVisionThreat({ label: result.label, prob: result.probability });
                    if (result.severity === AlertSeverity.CRITICAL) setIsLockdown(true);
                } else setVisionThreat(null);
            };
        }
    }, 1500);
  };

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
    setTranscripts(prev => [{ text, isDanger: check.isDanger, timestamp: new Date() }, ...prev].slice(0, 5));
    if (check.isDanger && check.severity === AlertSeverity.CRITICAL) setIsLockdown(true);
  };

  const startAudioAnalysis = (stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) return;
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256; 
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      const analyze = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) sum += dataArrayRef.current[i];
        const vol = Math.min(100, (sum / dataArrayRef.current.length / 255) * 250); 
        setVolumeLevel(vol);
        if (vol > 65) setSentiment('AGGRESSIVE');
        else if (vol > 30) setSentiment('AGITATED');
        else setSentiment('CALM');
        animationFrameRef.current = requestAnimationFrame(analyze);
      };
      analyze();
    } catch (e) { console.error(e); }
  };

  const toggleLive = async () => {
    if (!isLive) {
      try {
        const stream = videoSource === 'screen' 
            ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: audioSource === 'system' })
            : await navigator.mediaDevices.getUserMedia({ video: true, audio: audioSource === 'mic' });
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (stream.getAudioTracks().length > 0) {
           startAudioAnalysis(stream);
           startSpeechRecognition();
        }
        startVisionGuard();
        setIsLive(true);
      } catch (err: any) { alert(`Error: ${err.name}`); }
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
      case 'AGGRESSIVE': return 'bg-red-500 text-white shadow-red-500/50';
      case 'AGITATED': return 'bg-amber-400 text-white shadow-amber-400/50';
      default: return 'bg-emerald-500 text-white shadow-emerald-500/50';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
         {children.map(c => (
           <button key={c.id} onClick={() => { setSelectedChildId(c.id); setIsLive(false); }} className={`flex items-center gap-3 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white border-slate-100 text-slate-500'}`}>
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
           <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-2xl animate-pulse">
              <ICONS.LiveCamera />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{t.liveControl}</h2>
              <p className="text-slate-500 font-bold text-lg mt-1">{t.liveStreamFor} <span className="text-indigo-600 font-black">{child.name}</span></p>
           </div>
        </div>
        <div className="flex flex-wrap justify-center gap-5">
           <button onClick={() => setIsLockdown(!isLockdown)} className={`px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 ${isLockdown ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>{isLockdown ? `🔓 ${t.undimScreen}` : `🌑 ${t.dimScreen}`}</button>
           <button onClick={toggleLive} className={`px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 ${isLive ? 'bg-indigo-950 text-white' : 'bg-indigo-600 text-white'}`}>{isLive ? `🔴 ${t.endStream}` : `📡 ${t.startStream}`}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 space-y-10">
          <div className="relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl aspect-video border-[12px] border-slate-900">
            {isLockdown && (
              <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white text-center p-10">
                 <div className="text-7xl mb-6">🛡️</div>
                 <h4 className="text-4xl font-black tracking-tighter mb-4 uppercase text-red-500">{t.activeLock}</h4>
              </div>
            )}
            {!isLive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-8 bg-slate-900">
                <div className="w-32 h-32 bg-white/5 rounded-3xl flex items-center justify-center border-2 border-white/10 text-5xl opacity-40"><ICONS.LiveCamera /></div>
                <div className="text-center"><p className="font-black tracking-[0.4em] uppercase text-xs mb-2">{t.waitingSignal}</p></div>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-8 right-8 z-20">
                   <div className="bg-red-600 text-white text-[10px] font-black px-8 py-3 rounded-full flex items-center gap-3">
                     <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></span>
                     LIVE • {videoSource.toUpperCase()}
                   </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* حاشية سفلية للعنصر الجانبي pb-16 لتجنب التداخل مع شريط التنقل المستطيل */}
        <div className="xl:col-span-4 space-y-10 pb-16 md:pb-0">
           <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-xl space-y-8">
              <h3 className="text-xl font-black text-slate-800 border-b pb-4 flex items-center gap-3">{t.configStream}</h3>
              <div className="space-y-6">
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t.videoSource}</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => !isLive && setVideoSource('camera')} className={`p-5 rounded-2xl border-2 transition-all ${videoSource === 'camera' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400'}`}>الكاميرا</button>
                       <button onClick={() => !isLive && setVideoSource('screen')} className={`p-5 rounded-2xl border-2 transition-all ${videoSource === 'screen' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400'}`}>الشاشة</button>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 flex flex-col items-center justify-center space-y-12">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner border border-indigo-100 mb-6">📻</div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{t.walkieTalkie}</h3>
              </div>
              <div className="relative">
                 <button onMouseDown={() => setIsTalking(true)} onMouseUp={() => setIsTalking(false)} onTouchStart={() => setIsTalking(true)} onTouchEnd={() => setIsTalking(false)} className={`w-52 h-52 rounded-full border-[10px] transition-all active:scale-90 shadow-2xl flex flex-col items-center justify-center gap-4 ${isTalking ? 'bg-indigo-600 border-indigo-400 text-white scale-105' : 'bg-slate-50 border-white text-slate-300'}`}>
                    <ICONS.WalkieTalkie />
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
