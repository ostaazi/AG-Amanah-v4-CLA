import React, { useState, useRef, useEffect } from 'react';
import { localSentinelCheck } from '../services/securitySentinel';
import { analyzeContent } from '../services/geminiService';
import { loadVisualSentinelModel, scanImageLocally } from '../services/visualSentinel';
import { saveAlertToDB } from '../services/firestoreService';
import { Child, MonitoringAlert, Category, AlertSeverity, EvidenceRecord } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';

const AR_SCENARIOS = [
  {
    id: 'blackmail',
    label: '🕵️‍♂️ ابتزاز مالي',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'اسمع يا حلو، عندي صورك اللي أرسلتها أمس. إذا ما حولت لي رصيد شحن بـ 500 ريال الحين، راح أنشرها في قروب المدرسة وأرسلها لأبوك. معاك ساعة وحدة بس!',
  },
  {
    id: 'bullying',
    label: '🤬 تنمر وتوكسيك',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'أنت إنسان فاشل والكل يكرهك. ليش عايش أصلاً؟ لو منك أنتحر وأريح العالم. لا تجي المدرسة بكرة لأننا بنضربك.',
  },
  {
    id: 'grooming',
    label: '🐺 استدراج',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'ممكن نفتح كاميرا؟ أبي أشوفك. تعال غرفتك وقفل الباب عشان أوريك السكن الجديد. لا تعلم أحد، هذا سر بيننا.',
  },
];

const EN_SCENARIOS = [
  {
    id: 'blackmail',
    label: '🕵️‍♂️ Financial Blackmail',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: "Listen kid, I have the photos you sent yesterday. If you don't send me a $100 gift card right now, I will post them in the school group and send them to your dad. You have one hour!",
  },
  {
    id: 'bullying',
    label: '🤬 Bullying & Toxic',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'You are a loser and everyone hates you. Why are you even alive? Kill yourself and save the world.',
  },
  {
    id: 'grooming',
    label: '🐺 Predator / Grooming',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'Can we open camera? I want to see you. Go to your room and lock the door so I can show you the new skin.',
  },
];

interface SimulatorViewProps {
  children: Child[];
  parentId: string;
  lang: 'ar' | 'en';
}

const SimulatorView: React.FC<SimulatorViewProps> = ({ children, parentId, lang }) => {
  const [text, setText] = useState('');
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [compressedImage, setCompressedImage] = useState<string | null>(null);
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

  const handleSimulate = async () => {
    if ((!text.trim() && !displayImage) || loading) return;
    setEngineStatus('SCANNING');
    setLoading(true);
    const child = children[0] || { name: 'أحمد' };
    const startTime = performance.now();

    try {
      let localTextCheck = {
        isDanger: false,
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
        skeleton: '',
        latency: '0ms',
      };
      if (text.trim()) {
        localTextCheck = localSentinelCheck(text);
        setDebugSkeleton(localTextCheck.skeleton);
      }

      if (localTextCheck.isDanger) {
        await finalizeAlert(
          child,
          text,
          localTextCheck.category,
          localTextCheck.severity,
          localTextCheck.latency,
          `[Turbo Text V19] رصد محلي فوري للبصمة النصية: ${localTextCheck.skeleton}`,
          `قفل فوري للجهاز وإبلاغ المشرف`
        );
        setLoading(false);
        return;
      }

      if (displayImage && hiddenImgRef.current) {
        const visualCheck = await scanImageLocally(hiddenImgRef.current);
        if (visualCheck.isDanger) {
          await finalizeAlert(
            child,
            text || '[صورة مشبوهة]',
            visualCheck.category,
            visualCheck.severity,
            visualCheck.latency,
            `[Visual Sentinel] رصد بصري محلي (${visualCheck.label}) بنسبة ${(visualCheck.probability * 100).toFixed(1)}%`,
            `حجب الصورة محلياً وعزل الجهاز`
          );
          setLoading(false);
          return;
        }
      }

      const aiResult = await analyzeContent(
        text,
        child.name,
        'Instagram/Direct',
        compressedImage || undefined
      );
      const endTime = performance.now();
      const cloudLatency = (endTime - startTime).toFixed(0) + 'ms';
      setLatency(cloudLatency);

      if (aiResult.category !== Category.SAFE) {
        await finalizeAlert(
          child,
          text,
          aiResult.category as Category,
          aiResult.severity as AlertSeverity,
          cloudLatency,
          aiResult.aiAnalysis || 'تم الرصد عبر تحليل Gemini Vision العميق.',
          aiResult.actionTaken || 'تدخل وقائي',
          aiResult.suspectUsername,
          aiResult.conversationLog
        );
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

  const finalizeAlert = async (
    child: any,
    content: string,
    category: Category,
    severity: AlertSeverity,
    lat: string,
    analysis: string,
    action: string,
    suspect?: string,
    log?: any[]
  ) => {
    setLatency(String(lat));
    setEngineStatus('STRUCK');
    const suspectId = String(
      suspect || 'SUSPECT-' + Math.random().toString(36).substr(2, 6).toUpperCase()
    );

    const alertData: any = {
      childName: String(child?.name || 'أحمد'),
      platform: 'Instagram',
      content: String(content || '[محتوى صورة]'),
      imageData: displayImage ? String(displayImage) : undefined,
      category: String(category) as Category,
      severity: String(severity) as AlertSeverity,
      latency: String(lat),
      suspectId: suspectId,
      suspectUsername: suspectId,
      aiAnalysis: String(analysis),
      actionTaken: String(action),
      conversationLog:
        log && Array.isArray(log)
          ? log.map((m) => ({
              sender: String(m.sender),
              text: String(m.text),
              time: String(m.time),
              isSuspect: !!m.isSuspect,
            }))
          : [
              {
                sender: suspectId,
                text: String(content),
                time: new Date().toLocaleTimeString(),
                isSuspect: true,
              },
              {
                sender: String(child?.name || 'الهدف'),
                text: 'لا أعرفك!',
                time: new Date().toLocaleTimeString(),
                isSuspect: false,
              },
            ],
    };

    await saveAlertToDB(parentId, alertData);
  };

  return (
    <div
      className="max-w-xl mx-auto space-y-8 pb-40 animate-in fade-in"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {displayImage && (
        <img
          ref={hiddenImgRef}
          src={displayImage}
          className="hidden"
          crossOrigin="anonymous"
          alt="target"
        />
      )}

      <div
        className={`text-center p-12 rounded-[4rem] border-4 transition-all duration-500 shadow-2xl relative overflow-hidden ${
          engineStatus === 'STRUCK'
            ? 'bg-red-600 border-red-400 text-white shadow-red-200'
            : engineStatus === 'SAFE'
              ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-200'
              : 'bg-[#020617] border-indigo-500/20 text-white'
        }`}
      >
        <div className="text-7xl mb-6 drop-shadow-lg relative z-10">
          {engineStatus === 'SCANNING'
            ? '👁️'
            : engineStatus === 'STRUCK'
              ? '⚡'
              : engineStatus === 'SAFE'
                ? '✅'
                : '🛡️'}
        </div>
        <h2 className="text-4xl font-black tracking-tighter mb-2 relative z-10">
          Turbo Vision V2.1
        </h2>
        <div className="flex items-center justify-center gap-4 opacity-60 relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">
            Hybrid Edge/Cloud Engine
          </span>
          {latency && (
            <span className="px-3 py-1 rounded-full text-[9px] font-mono font-black bg-white/20">
              {latency}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-6">
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative w-full h-48 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${displayImage ? 'border-indigo-500 bg-slate-900' : 'border-slate-300 bg-slate-50'}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            hidden
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])}
          />
          {displayImage ? (
            <img
              src={displayImage}
              className="w-full h-full object-cover opacity-60"
              alt="preview"
            />
          ) : (
            <div className="text-center">
              <span className="text-4xl opacity-50 block">🖼️</span>
              <p className="text-xs font-black text-slate-400">ارفع صورة مشبوهة</p>
            </div>
          )}
        </div>

        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="نص الرسالة..."
          className="w-full p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold text-right"
        />

        <div className="grid grid-cols-3 gap-2">
          {(lang === 'ar' ? AR_SCENARIOS : EN_SCENARIOS).map((s) => (
            <button
              key={s.id}
              onClick={() => setText(s.text)}
              className={`py-3 px-2 rounded-xl text-white text-[10px] font-black shadow-md ${s.color}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSimulate}
          disabled={loading || (!text.trim() && !displayImage)}
          className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-lg active:scale-95 shadow-xl"
        >
          {loading ? 'جاري التحليل...' : 'تشغيل المحاكاة الهجينة'}
        </button>
      </div>
    </div>
  );
};

export default SimulatorView;
