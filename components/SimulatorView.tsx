import React, { useState, useRef, useEffect } from 'react';
import { localSentinelCheck } from '../services/securitySentinel';
import { analyzeContent } from '../services/geminiService';
import { loadVisualSentinelModel, scanImageLocally } from '../services/visualSentinel';
import { saveAlertToDB } from '../services/firestoreService';
import { formatTimeDefault } from '../services/dateTimeFormat';
import { Child, MonitoringAlert, Category, AlertSeverity, EvidenceRecord } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';

const AR_SCENARIOS = [
  {
    id: 'blackmail',
    label: 'ابتزاز مالي',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'لدي صورك الخاصة، أرسل المال الآن وإلا سأنشرها علنًا.',
  },
  {
    id: 'bullying',
    label: 'تنمر وإساءة سامة',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'أنت بلا قيمة والجميع يكرهك. لا أحد يريدك.',
  },
  {
    id: 'grooming',
    label: 'استدراج مفترس',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'افتح الكاميرا واذهب وحدك، وابقِ هذا الأمر سرًا بيننا.',
  },
];

const EN_SCENARIOS = [
  {
    id: 'blackmail',
    label: 'Financial Blackmail',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: "Listen kid, I have the photos you sent yesterday. If you don't send me a $100 gift card right now, I will post them in the school group and send them to your dad. You have one hour!",
  },
  {
    id: 'bullying',
    label: 'Bullying and Toxic Abuse',
    color: 'bg-slate-800 hover:bg-slate-900',
    text: 'You are a loser and everyone hates you. Why are you even alive? Kill yourself and save the world.',
  },
  {
    id: 'grooming',
    label: 'Predator Grooming',
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
  const t = translations[lang];
  const engineLabelMap: Record<'IDLE' | 'SCANNING' | 'STRUCK' | 'SAFE', string> =
    lang === 'ar'
      ? {
          IDLE: 'جاهز',
          SCANNING: 'فحص',
          STRUCK: 'إنذار',
          SAFE: 'آمن',
        }
      : {
          IDLE: 'IDLE',
          SCANNING: 'SCAN',
          STRUCK: 'ALERT',
          SAFE: 'SAFE',
        };

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
    const child = children[0] || { name: 'Child' };
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
          `[Turbo Text V19] Local text fingerprint trigger: ${localTextCheck.skeleton}`,
          'Immediate safety lock and parent escalation'
        );
        setLoading(false);
        return;
      }

      if (displayImage && hiddenImgRef.current) {
        const visualCheck = await scanImageLocally(hiddenImgRef.current);
        if (visualCheck.isDanger) {
          await finalizeAlert(
            child,
            text || '[suspicious image]',
            visualCheck.category,
            visualCheck.severity,
            visualCheck.latency,
            `[Visual Sentinel] Local visual trigger (${visualCheck.label}) at ${(visualCheck.probability * 100).toFixed(1)}%`,
            'Image blocked locally and device isolated'
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
          aiResult.aiAnalysis || 'Detected via deep Gemini Vision analysis.',
          aiResult.actionTaken || 'Protective intervention applied.',
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
      childName: String(child?.name || 'Child'),
      platform: 'Instagram',
      content: String(content || '[image content]'),
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
                time: formatTimeDefault(new Date(), { includeSeconds: true }),
                isSuspect: true,
              },
              {
                sender: 'AMANAH_AI',
                text: String(analysis || 'Content evidence captured and analyzed automatically.'),
                time: formatTimeDefault(new Date(), { includeSeconds: true }),
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
          {engineLabelMap[engineStatus]}
        </div>
        <h2 className="text-4xl font-black tracking-tighter mb-2 relative z-10">
          Turbo Vision V2.1
        </h2>
        <div className="flex items-center justify-center gap-4 opacity-60 relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">
            {t.hybridEngine}
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
              <span className="text-4xl opacity-50 block">IMG</span>
              <p className="text-xs font-black text-slate-400">{t.uploadZone}</p>
            </div>
          )}
        </div>

        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.textInputPlaceholder}
          className={`w-full p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold ${lang === 'ar' ? 'text-right' : 'text-left'}`}
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
          {loading ? t.analyzing : t.runSim}
        </button>
      </div>
    </div>
  );
};

export default SimulatorView;


