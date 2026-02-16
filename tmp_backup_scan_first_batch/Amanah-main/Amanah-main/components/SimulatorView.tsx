
import React, { useState, useRef, useEffect } from 'react';
import { localSentinelCheck } from '../services/securitySentinel';
import { analyzeContent } from '../services/geminiService';
import { loadVisualSentinelModel, scanImageLocally } from '../services/visualSentinel'; 
import { Child, MonitoringAlert, Category, AlertSeverity } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';

const AR_SCENARIOS = [
  { 
    id: 'blackmail', 
    label: '🕵️‍♂️ ابتزاز مالي', 
    color: 'bg-slate-800 hover:bg-slate-900 border-slate-700',
    text: 'اسمع يا حلو، عندي صورك اللي أرسلتها أمس. إذا ما حولت لي رصيد شحن بـ 500 ريال الحين، راح أنشرها في قروب المدرسة وأرسلها لأبوك. معاك ساعة وحدة بس!' 
  },
  { 
    id: 'bullying', 
    label: '🤬 تنمر وتوكسيك', 
    color: 'bg-slate-800 hover:bg-slate-900 border-slate-700',
    text: 'أنت إنسان فاشل والكل يكرهك. ليش عايش أصلاً؟ لو منك أنتحر وأريح العالم. لا تجي المدرسة بكرة لأننا بنضربك.' 
  },
  { 
    id: 'grooming', 
    label: '🐺 استدراج', 
    color: 'bg-slate-800 hover:bg-slate-900 border-slate-700',
    text: 'ممكن نفتح كاميرا؟ أبي أشوفك. تعال غرفتك وقفل الباب عشان أوريك السكن الجديد. لا تعلم أحد، هذا سر بيننا.' 
  },
];

const EN_SCENARIOS = [
  { 
    id: 'blackmail', 
    label: '🕵️‍♂️ Financial Blackmail', 
    color: 'bg-slate-800 hover:bg-slate-900 border-slate-700',
    text: 'Listen kid, I have the photos you sent yesterday. If you don\'t send me a $100 gift card right now, I will post them in the school group and send them to your dad. You have one hour!' 
  },
  { 
    id: 'bullying', 
    label: '🤬 Bullying & Toxic', 
    color: 'bg-slate-800 hover:bg-slate-900 border-slate-700',
    text: 'You are a loser and everyone hates you. Why are you even alive? Kill yourself and save the world. Don\'t come to school tomorrow because we will beat you up.' 
  },
  { 
    id: 'grooming', 
    label: '🐺 Predator / Grooming', 
    color: 'bg-slate-800 hover:bg-slate-900 border-slate-700',
    text: 'Can we open camera? I want to see you. Go to your room and lock the door so I can show you the new skin. Don\'t tell anyone, it\'s our secret.' 
  },
];

interface SimulatorViewProps {
  children: Child[];
  onNewAlert: (a: MonitoringAlert, extra: any) => void;
  lang: 'ar' | 'en';
}

const SimulatorView: React.FC<SimulatorViewProps> = ({ children, onNewAlert, lang }) => {
  const [text, setText] = useState('');
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [compressedImage, setCompressedImage] = useState<string | null>(null);
  const t = translations[lang];
  const scenarios = lang === 'ar' ? AR_SCENARIOS : EN_SCENARIOS;
  
  const [loading, setLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<'IDLE' | 'SCANNING' | 'STRUCK' | 'SAFE'>('IDLE');
  const [debugSkeleton, setDebugSkeleton] = useState('');
  const [latency, setLatency] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenImgRef = useRef<HTMLImageElement>(null); 

  useEffect(() => {
    loadVisualSentinelModel();
  }, []);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 320; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.5)); 
            };
        };
    });
  };

  const processImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setDisplayImage(e.target?.result as string);
    reader.readAsDataURL(file);
    const compressed = await compressImage(file);
    setCompressedImage(compressed);
    setEngineStatus('IDLE'); 
  };

  const injectScenario = (scenarioText: string) => {
      setText(scenarioText);
      setEngineStatus('IDLE');
      setLatency('');
      setDebugSkeleton('');
  };

  const handleSimulate = async () => {
    if ((!text.trim() && !displayImage) || loading) return;
    
    setEngineStatus('SCANNING');
    setLoading(true);
    const child = children[0];
    const startTime = performance.now();

    try {
        // 1-A: فحص النص محلياً
        let localTextCheck = { isDanger: false, category: Category.SAFE, severity: AlertSeverity.LOW, skeleton: "", latency: "0ms" };
        if (text.trim()) {
            localTextCheck = localSentinelCheck(text);
            setDebugSkeleton(localTextCheck.skeleton);
        }

        if (localTextCheck.isDanger) {
             finalizeAlert(child, text, localTextCheck.category, localTextCheck.severity, localTextCheck.latency, 
                `[Turbo Text V19] ${lang === 'ar' ? 'تم الرصد المحلي الفوري' : 'Instant Local Detection'}. ${lang === 'ar' ? 'البصمة النصية' : 'Text Vector'}: ${localTextCheck.skeleton}`, 
                `قفل فوري للجهاز وإبلاغ المشرف`);
             setLoading(false);
             return; 
        }

        // 1-B: فحص الصورة محلياً (Visual Sentinel)
        if (displayImage && hiddenImgRef.current) {
            const visualCheck = await scanImageLocally(hiddenImgRef.current);
            
            if (visualCheck.isDanger) {
                finalizeAlert(child, text || '[صورة مشبوهة]', visualCheck.category, visualCheck.severity, visualCheck.latency,
                    `[Visual Sentinel] ${lang === 'ar' ? 'رصد محلي فوري للمحتوى البصري' : 'Instant Visual Content Detection'} (${visualCheck.label}). ${lang === 'ar' ? 'الاحتمالية' : 'Probability'}: ${(visualCheck.probability * 100).toFixed(1)}%`,
                    `حجب الصورة محلياً وعزل الجهاز`
                );
                setLoading(false);
                return; 
            }
        }

        // 2: الفحص السحابي (Gemini Fallback)
        const aiResult = await analyzeContent(text, child.name, 'Instagram/Direct', compressedImage || undefined);
        const endTime = performance.now();
        const cloudLatency = (endTime - startTime).toFixed(0) + 'ms';
        setLatency(cloudLatency);

        if (aiResult.category !== Category.SAFE) {
            finalizeAlert(child, text, aiResult.category as Category, aiResult.severity as AlertSeverity, cloudLatency, 
                aiResult.aiAnalysis || 'تم الرصد عبر تحليل Gemini Vision العميق.', 
                aiResult.actionTaken || 'تدخل وقائي', 
                aiResult.suspectUsername);
        } else {
            setEngineStatus('SAFE');
        }

    } catch (e) {
      console.error(e);
      setEngineStatus('IDLE');
    } finally {
      setLoading(false);
    }
  };

  const finalizeAlert = (child: Child, content: string, category: Category, severity: AlertSeverity, lat: string, analysis: string, action: string, suspect?: string) => {
      setLatency(lat); 
      setEngineStatus('STRUCK');
      const suspectId = suspect || 'SUSPECT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      
      setTimeout(() => {
          onNewAlert({
            id: 'DETECT-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
            childName: child?.name || 'أحمد',
            platform: 'Instagram', 
            content: content || '[محتوى صورة ملغوم]',
            imageData: displayImage || undefined,
            category: category,
            severity: severity,
            timestamp: new Date(),
            latency: lat,
            suspectId: suspectId,
            aiAnalysis: analysis,
            actionTaken: action
          }, { immediateLockdown: true, suspectUsername: suspectId });
      }, 500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-40 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {displayImage && (
          <img ref={hiddenImgRef} src={displayImage} className="hidden" crossOrigin="anonymous" alt="analysis target" />
      )}

      {/* Engine Status Card */}
      <div className={`text-center p-12 rounded-[4rem] border-4 transition-all duration-500 shadow-2xl relative overflow-hidden ${
        engineStatus === 'STRUCK' ? 'bg-red-600 border-red-400 text-white shadow-red-200' : 
        engineStatus === 'SAFE' ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-200' :
        'bg-[#020617] border-indigo-500/20 text-white'
      }`}>
        {engineStatus === 'SCANNING' && (
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent w-full h-full animate-[scan_1.5s_linear_infinite]"></div>
        )}
        
        <div className="text-7xl mb-6 drop-shadow-lg relative z-10">
          {engineStatus === 'SCANNING' ? '👁️' : engineStatus === 'STRUCK' ? '⚡' : engineStatus === 'SAFE' ? '✅' : '🛡️'}
        </div>
        <h2 className="text-4xl font-black tracking-tighter mb-2 relative z-10">
            {engineStatus === 'STRUCK' && latency.includes('ms') && parseInt(latency) < 500 ? 'Visual Sentinel' : 'Turbo Vision V2.1'}
        </h2>
        <div className="flex items-center justify-center gap-4 opacity-60 relative z-10">
           <span className="text-[10px] font-black uppercase tracking-[0.3em]">
               {displayImage ? 'Hybrid Edge/Cloud Engine' : 'Text Vector Engine'}
           </span>
           {latency && <span className={`px-3 py-1 rounded-full text-[9px] font-mono font-black ${parseInt(latency) < 300 ? 'bg-emerald-400 text-black' : 'bg-white/20'}`}>
               {latency}
           </span>}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-6">
        
        {/* Image Upload Zone */}
        <div 
            onClick={() => fileInputRef.current?.click()}
            className={`relative w-full h-48 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group ${displayImage ? 'border-indigo-500 bg-slate-900' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
        >
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])} />
            
            {displayImage ? (
                <>
                    <img 
                        src={displayImage} 
                        className={`w-full h-full object-cover transition-all duration-700 ${engineStatus === 'SAFE' ? 'blur-0 opacity-100' : 'blur-xl opacity-60'}`} 
                    />
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                         {engineStatus === 'SAFE' ? (
                             <span className="bg-emerald-500/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-black border border-white/20 shadow-xl animate-in zoom-in">
                                 {t.safe} ✅
                             </span>
                         ) : engineStatus === 'SCANNING' ? (
                             <span className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-black border border-white/20 shadow-xl animate-pulse">
                                 {t.scanning}
                             </span>
                         ) : engineStatus === 'STRUCK' ? (
                             <span className="bg-red-600/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-black border border-white/20 shadow-xl">
                                 {t.danger} 🚫
                             </span>
                         ) : (
                             <span className="bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-black border border-white/20">
                                 Change Image
                             </span>
                         )}
                    </div>
                </>
            ) : (
                <div className="text-center space-y-2 p-4">
                    <span className="text-4xl opacity-50 block group-hover:scale-110 transition-transform">🖼️</span>
                    <p className="text-xs font-black text-slate-400">{t.uploadZone}</p>
                    <p className="text-[9px] font-bold text-slate-300">{t.localScanSupport}</p>
                </div>
            )}
        </div>

        {/* Text Input */}
        <div className="space-y-2">
           <div className="flex justify-between items-center px-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.manualTest}</label>
              {text && <button onClick={() => {setText(''); setEngineStatus('IDLE');}} className="text-[9px] text-red-500 font-black">{t.clear}</button>}
           </div>
           <textarea 
            rows={2}
            value={text}
            onChange={(e) => { setText(e.target.value); setEngineStatus('IDLE'); }}
            placeholder={t.textInputPlaceholder}
            className={`w-full p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none text-lg font-bold transition-all resize-none ${lang === 'ar' ? 'text-right' : 'text-left'}`}
          ></textarea>
        </div>

        {/* Quick Test Scenarios */}
        <div className="space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 block">{t.quickScenarios}</label>
           <div className="grid grid-cols-3 gap-2">
              {scenarios.map((scenario) => (
                 <button
                    key={scenario.id}
                    onClick={() => injectScenario(scenario.text)}
                    className={`py-3 px-2 rounded-xl text-white text-[10px] font-black shadow-md border-b-4 transition-all active:scale-95 active:border-b-0 ${scenario.color}`}
                 >
                    {scenario.label}
                 </button>
              ))}
           </div>
        </div>
        
        <button 
          onClick={handleSimulate}
          disabled={loading || (!text.trim() && !displayImage)}
          className={`w-full py-6 rounded-[2.5rem] font-black text-lg text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
            loading ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {loading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{t.hybridEngine}</span>
              </>
          ) : (
              <>
                 <ICONS.Rocket />
                 <span>{t.runSim} {displayImage ? t.visualSim : ''}</span>
              </>
          )}
        </button>
      </div>

      {debugSkeleton && (
        <div className="bg-slate-900 text-indigo-400 p-8 rounded-[3rem] font-mono text-[10px] space-y-3 shadow-xl border-l-8 border-indigo-500 animate-in slide-in-from-bottom-5">
           <div className="flex justify-between items-center">
              <span className="font-black text-white/40 uppercase">Hybrid Log:</span>
              <span className="text-emerald-400 font-black">Latency: {latency}</span>
           </div>
           <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
              <span>Text Vector:</span>
              <span className="text-amber-400 font-bold">[{debugSkeleton}]</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default SimulatorView;
