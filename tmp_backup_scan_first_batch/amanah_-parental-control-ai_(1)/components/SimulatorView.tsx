
import React, { useState } from 'react';
import { localSentinelCheck } from '../services/securitySentinel';
import { analyzeContent } from '../services/geminiService';
import { Child, MonitoringAlert, Category, AlertSeverity } from '../types';

const SimulatorView: React.FC<{ children: Child[], onNewAlert: (a: MonitoringAlert, extra: any) => void }> = ({ children, onNewAlert }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<'IDLE' | 'SCANNING' | 'STRUCK' | 'SAFE'>('IDLE');
  const [debugSkeleton, setDebugSkeleton] = useState('');
  const [latency, setLatency] = useState('');

  const handleSimulate = async () => {
    const input = text.trim();
    if (!input || loading) return;
    
    setEngineStatus('SCANNING');
    const child = children[0];

    // الفحص المحلي الفائق V19 (Turbo Spectrum)
    const localCheck = localSentinelCheck(input);
    setDebugSkeleton(localCheck.skeleton);
    setLatency(localCheck.latency);

    if (localCheck.isDanger) {
      setEngineStatus('STRUCK');
      const suspectId = 'SUSPECT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      
      onNewAlert({
        id: 'TURBO-V19-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        childName: child?.name || 'أحمد',
        platform: 'Discord', // تحديث المنصة إلى اسم واقعي
        content: input,
        category: localCheck.category as Category,
        severity: localCheck.severity as AlertSeverity,
        timestamp: new Date(),
        latency: localCheck.latency,
        suspectId: suspectId,
        aiAnalysis: `[Turbo V19] تم الرصد المحلي الفوري بنجاح. المحرك قام بتفكيك التمويه البصري (البصمة: ${localCheck.skeleton}). حماية 0-Latency نشطة.`,
        actionTaken: `قفل فوري للجهاز وإبلاغ المشرف`
      }, { immediateLockdown: true, suspectUsername: suspectId });
      return;
    }

    // إذا فشل الفحص المحلي، نلجأ للذكاء الاصطناعي السحابي للتحليل اللغوي
    setLoading(true);
    try {
      const aiResult = await analyzeContent(input, child.name, 'Cloud/Amanah-Deep');
      if (aiResult.category !== Category.SAFE) {
        setEngineStatus('STRUCK');
        onNewAlert({
          id: 'CLOUD-V9-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
          childName: child.name,
          platform: 'Instagram', // منصة افتراضية للتحليل السحابي
          content: input,
          category: aiResult.category as Category,
          severity: aiResult.severity as AlertSeverity,
          timestamp: new Date(),
          latency: '1.2s', 
          suspectId: aiResult.suspectUsername,
          aiAnalysis: aiResult.aiAnalysis || 'تم الرصد عبر التحليل السحابي العميق.',
          actionTaken: aiResult.actionTaken
        }, aiResult);
      } else {
        setEngineStatus('SAFE');
      }
    } catch (e) {
      console.error(e);
      setEngineStatus('IDLE');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-40 animate-in fade-in" dir="rtl">
      {/* Engine Status Card */}
      <div className={`text-center p-12 rounded-[4rem] border-4 transition-all duration-500 shadow-2xl relative overflow-hidden ${
        engineStatus === 'STRUCK' ? 'bg-red-600 border-red-400 text-white shadow-red-200' : 
        engineStatus === 'SAFE' ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-200' :
        'bg-[#020617] border-indigo-500/20 text-white'
      }`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-white/20 animate-[scan_2s_linear_infinite]"></div>
        
        <div className="text-7xl mb-6 drop-shadow-lg">
          {engineStatus === 'SCANNING' ? '📡' : engineStatus === 'STRUCK' ? '⚡' : engineStatus === 'SAFE' ? '✅' : '🛡️'}
        </div>
        <h2 className="text-4xl font-black tracking-tighter mb-2">Turbo Spectrum V19</h2>
        <div className="flex items-center justify-center gap-4 opacity-60">
           <span className="text-[10px] font-black uppercase tracking-[0.3em]">Zero Latency Engine</span>
           {latency && <span className="bg-white/20 px-3 py-1 rounded-full text-[9px] font-mono font-black">{latency}</span>}
        </div>
      </div>

      <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl space-y-8">
        <div className="space-y-4">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">أدخل نص الاختبار:</label>
           <textarea 
            rows={3}
            value={text}
            onChange={(e) => { setText(e.target.value); setEngineStatus('IDLE'); }}
            placeholder='جرب: "ص @ ر ه"'
            className="w-full p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none text-2xl font-black transition-all text-right"
          ></textarea>
        </div>
        
        <button 
          onClick={handleSimulate}
          disabled={loading || !text.trim()}
          className={`w-full py-8 rounded-[2.5rem] font-black text-xl text-white shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${
            loading ? 'bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {loading ? 'تحليل سحابي...' : 'بدء فحص V19 الخاطف'}
        </button>
      </div>

      {debugSkeleton && (
        <div className="bg-slate-900 text-indigo-400 p-8 rounded-[3rem] font-mono text-[10px] space-y-3 shadow-xl border-l-8 border-indigo-500">
           <div className="flex justify-between items-center">
              <span className="font-black text-white/40 uppercase">V19 Debug Log:</span>
              <span className="text-emerald-400 font-black">Speed: {latency}</span>
           </div>
           <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
              <span>Skeleton:</span>
              <span className="text-amber-400 font-bold">[{debugSkeleton}]</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default SimulatorView;
