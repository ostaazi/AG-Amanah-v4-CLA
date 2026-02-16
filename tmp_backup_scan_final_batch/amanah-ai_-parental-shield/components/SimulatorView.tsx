
import React, { useState, useRef, useEffect } from 'react';
import { localSentinelCheck } from '../services/securitySentinel';
import { analyzeContent } from '../services/geminiService';
import { loadVisualSentinelModel, scanImageLocally } from '../services/visualSentinel'; 
import { Child, MonitoringAlert, Category, AlertSeverity } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';

const AR_SCENARIOS = [
  { id: 'blackmail', label: 'ابتزاز مالي', color: 'bg-slate-800 border-slate-700', text: 'امتلك بيانات وصور خاصة بك. إذا لم يتم التحويل فوراً سيتم النشر للعامة. لديك مهلة قصيرة.' },
  { id: 'bullying', label: 'تنمر إلكتروني', color: 'bg-slate-800 border-slate-700', text: 'أنت غير مرغوب بك والجميع يكرهك. لا تظهر في المدرسة غداً وإلا تعرضت للأذى.' },
  { id: 'grooming', label: 'محاولة استدراج', color: 'bg-slate-800 border-slate-700', text: 'هل يمكنك تفعيل الكاميرا الآن؟ أريد التحدث إليك بخصوص موضوع سري لا تخبر أحداً به.' },
];

const EN_SCENARIOS = [
  { id: 'blackmail', label: 'Financial Threat', color: 'bg-slate-800 border-slate-700', text: 'I have your private data. Pay immediately or everything goes public. You have one hour.' },
  { id: 'bullying', label: 'Cyber Bullying', color: 'bg-slate-800 border-slate-700', text: 'No one likes you. Stay away from school or you will regret it.' },
  { id: 'grooming', label: 'Predatory Content', color: 'bg-slate-800 border-slate-700', text: 'Can we open the camera? I want to show you something secret, dont tell anyone.' },
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

  const handleSimulate = async () => {
    if ((!text.trim() && !displayImage) || loading) return;
    setEngineStatus('SCANNING');
    setLoading(true);
    const child = children[0];
    const startTime = performance.now();

    try {
        let localCheck = text.trim() ? localSentinelCheck(text) : { isDanger: false, category: Category.SAFE, severity: AlertSeverity.LOW, skeleton: "", latency: "0ms" };
        if (localCheck.isDanger) {
             finalizeAlert(child, text, localCheck.category, localCheck.severity, localCheck.latency, "رصد محلي فوري للهيكل اللغوي.", "قفل الجهاز التلقائي");
             setLoading(false);
             return; 
        }

        if (displayImage && hiddenImgRef.current) {
            const visual = await scanImageLocally(hiddenImgRef.current);
            if (visual.isDanger) {
                finalizeAlert(child, text || '[محتوى بصري]', visual.category, visual.severity, visual.latency, "رصد محلي فوري للأنماط البصرية.", "حجب المحتوى");
                setLoading(false);
                return; 
            }
        }

        const aiResult = await analyzeContent(text, child.name, 'Direct Message', compressedImage || undefined);
        const duration = (performance.now() - startTime).toFixed(0) + 'ms';
        setLatency(duration);

        if (aiResult.category !== Category.SAFE) {
            finalizeAlert(child, text, aiResult.category as Category, aiResult.severity as AlertSeverity, duration, aiResult.aiAnalysis || 'تحليل سحابي متقدم.', aiResult.actionTaken || 'تدخل وقائي');
        } else {
            setEngineStatus('SAFE');
        }
    } catch (e) {
      setEngineStatus('IDLE');
    } finally {
      setLoading(false);
    }
  };

  const finalizeAlert = (child: Child, content: string, cat: Category, sev: AlertSeverity, lat: string, analysis: string, action: string) => {
      setLatency(lat); 
      setEngineStatus('STRUCK');
      setTimeout(() => {
          onNewAlert({
            id: 'SIM-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
            childName: child?.name || 'User',
            platform: 'Simulator', content, imageData: displayImage || undefined,
            category: cat, severity: sev, timestamp: new Date(), latency: lat,
            aiAnalysis: analysis, actionTaken: action
          }, { immediateLockdown: true });
      }, 500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-40 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {displayImage && <img ref={hiddenImgRef} src={displayImage} className="hidden" crossOrigin="anonymous" />}

      <div className={`text-center p-12 rounded-[4rem] border-4 transition-all duration-500 shadow-2xl relative overflow-hidden ${
        engineStatus === 'STRUCK' ? 'bg-red-600 border-red-400 text-white' : 
        engineStatus === 'SAFE' ? 'bg-emerald-600 border-emerald-400 text-white' :
        'bg-[#020617] border-white/10 text-white'
      }`}>
        <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-white/10 rounded-2xl"><ICONS.Shield /></div>
        <h2 className="text-4xl font-black tracking-tighter mb-2">Technical Test Lab</h2>
        <div className="flex items-center justify-center gap-4 opacity-60">
           <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Diagnostics</span>
           {latency && <span className="bg-white/20 px-3 py-1 rounded-full text-[9px] font-mono font-black">{latency}</span>}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-6">
        <div onClick={() => fileInputRef.current?.click()} className={`relative w-full h-48 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${displayImage ? 'border-indigo-500 bg-slate-900' : 'border-slate-300 bg-slate-50'}`}>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                 const reader = new FileReader();
                 reader.onload = (re) => setDisplayImage(re.target?.result as string);
                 reader.readAsDataURL(file);
                 setEngineStatus('IDLE');
              }
            }} />
            {displayImage ? (
                <img src={displayImage} className={`w-full h-full object-cover ${engineStatus === 'SAFE' ? 'opacity-100' : 'blur-xl opacity-60'}`} />
            ) : (
                <div className="text-center p-4">
                    <div className="w-10 h-10 mx-auto mb-2 opacity-20"><ICONS.LiveCamera /></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">تحميل عينة بصرية</p>
                </div>
            )}
        </div>

        <div className="space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase px-4 tracking-widest">إدخال نص يدوي</label>
           <textarea 
            rows={2} value={text} onChange={(e) => { setText(e.target.value); setEngineStatus('IDLE'); }}
            className={`w-full p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none text-lg font-bold text-right`}
          ></textarea>
        </div>

        <div className="space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase px-4 tracking-widest block">نماذج اختبار سريعة</label>
           <div className="grid grid-cols-3 gap-2">
              {scenarios.map((s) => (
                 <button key={s.id} onClick={() => setText(s.text)} className={`py-4 px-2 rounded-xl text-white text-[10px] font-black shadow-md border-b-4 transition-all active:scale-95 active:border-b-0 ${s.color}`}>
                    {s.label}
                 </button>
              ))}
           </div>
        </div>
        
        <button onClick={handleSimulate} disabled={loading} className={`w-full py-6 rounded-[2.5rem] font-black text-lg text-white shadow-xl flex items-center justify-center gap-3 ${loading ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
          {loading ? 'جاري التحليل...' : <><ICONS.Rocket /> تشغيل الاختبار</>}
        </button>
      </div>
    </div>
  );
};

export default SimulatorView;
