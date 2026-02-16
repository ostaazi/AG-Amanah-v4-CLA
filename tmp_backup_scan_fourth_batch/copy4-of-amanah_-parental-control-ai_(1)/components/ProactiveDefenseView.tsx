
import React, { useState, useRef } from 'react';
import { Child, ProactiveDefenseConfig, AlertSeverity, Category } from '../types';
import { ICONS, AmanahShield } from '../constants';

interface ProactiveDefenseViewProps {
  children: Child[];
  onUpdateDefense: (childId: string, config: ProactiveDefenseConfig) => void;
  lang: 'ar' | 'en';
}

const ProactiveDefenseView: React.FC<ProactiveDefenseViewProps> = ({ children, onUpdateDefense, lang }) => {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find(c => c.id === selectedChildId) || children[0];
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'IDLE' | 'RECORDING' | 'DONE'>('IDLE');

  const defaultConfig: ProactiveDefenseConfig = {
    isEnabled: true,
    onTextThreat: { lockDevice: true, blockApp: true, sendWarning: true, triggerSiren: false },
    onVisualThreat: { blockCamera: true, lockDevice: true, triggerSiren: true, blockMic: true },
    autoMessage: "تحذير: تم رصد محتوى يخالف قواعد السلامة. تم تقييد الوصول مؤقتاً لحمايتك، يرجى التواصل مع الوالدين فوراً.",
    sirenType: 'DEFAULT'
  };

  const config = child?.defenseConfig || defaultConfig;

  const updateConfig = (updates: Partial<ProactiveDefenseConfig>) => {
    onUpdateDefense(child.id, { ...config, ...updates });
  };

  const toggleMasterSwitch = () => {
    updateConfig({ isEnabled: !config.isEnabled });
  };

  const handleRecordVoice = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingStatus('RECORDING');
      // محاكاة بدء التسجيل
      setTimeout(() => {
        setIsRecording(false);
        setRecordingStatus('DONE');
        updateConfig({ sirenType: 'VOICE_RECORD', voiceRecordUrl: 'mock_voice_url' });
      }, 3000);
    }
  };

  if (!child) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-4">
       <div className="text-6xl grayscale opacity-20">📡</div>
       <p className="font-black">يرجى ربط جهاز طفل لتفعيل بروتوكولات الدفاع.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-40 animate-in fade-in" dir="rtl">
      
      {/* Hero Master Shield Card */}
      <div className="bg-[#0f172a] rounded-[3rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden border-b-[12px] border-[#8A1538]">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(138,21,56,0.15)_0%,transparent_60%)]"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-4xl shadow-2xl transition-all duration-700 ${config.isEnabled ? 'bg-[#8A1538] animate-pulse' : 'bg-slate-700 grayscale'}`}>
                  <AmanahShield className="w-16 h-16" animate={config.isEnabled} />
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-2">بروتوكول الحارس الشخصي</h2>
                  <p className="text-indigo-200 font-bold opacity-80 text-lg">التحكم في الاستجابة الآلية الفورية عند رصد أي خطر.</p>
               </div>
            </div>
            
            <button 
              onClick={toggleMasterSwitch}
              className={`group relative px-12 py-6 rounded-3xl font-black text-xl transition-all shadow-2xl flex items-center gap-6 overflow-hidden ${config.isEnabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-800 text-slate-500'}`}
            >
               <span className="relative z-10">{config.isEnabled ? '🛡️ النظام نشط' : '⚪ النظام معطل'}</span>
               <div className={`w-14 h-7 rounded-full p-1 bg-black/30 relative transition-all ${config.isEnabled ? 'bg-emerald-400' : ''}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${config.isEnabled ? '-translate-x-7' : 'translate-x-0'}`}></div>
               </div>
            </button>
         </div>
      </div>

      {/* Child Tab Selector */}
      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar px-2">
         {children.map(c => (
           <button key={c.id} onClick={() => setSelectedChildId(c.id)} className={`flex items-center gap-4 px-8 py-4 rounded-2xl border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-white border-[#8A1538] text-[#8A1538] shadow-xl' : 'bg-slate-50 border-transparent text-slate-400'}`}>
              <img src={c.avatar} className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
              <div className="text-right">
                <p className="font-black text-sm block leading-none">{c.name}</p>
                <span className="text-[8px] font-bold uppercase opacity-60">تعديل البروتوكول</span>
              </div>
           </button>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         
         {/* Protocol Card: Text Threats */}
         <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8 flex flex-col">
            <div className="flex items-center gap-5 border-b border-slate-50 pb-8">
               <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-amber-100">⌨️</div>
               <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">بروتوكول التهديد النصي</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">عند رصد كلمات بذيئة أو استدراج</p>
               </div>
            </div>
            
            <div className="space-y-4 flex-1">
               <ProtocolToggle 
                 label="قفل الجهاز فوراً" 
                 desc="منع الطفل من استخدام الهاتف وعرض شاشة القفل."
                 active={config.onTextThreat.lockDevice} 
                 onToggle={() => updateConfig({ onTextThreat: { ...config.onTextThreat, lockDevice: !config.onTextThreat.lockDevice } })} 
               />
               <ProtocolToggle 
                 label="حظر التطبيق المفتوح" 
                 desc="سيتم إغلاق التطبيق الذي تمت فيه المخالفة فقط."
                 active={config.onTextThreat.blockApp} 
                 onToggle={() => updateConfig({ onTextThreat: { ...config.onTextThreat, blockApp: !config.onTextThreat.blockApp } })} 
               />
               <ProtocolToggle 
                 label="دفع رسالة التحذير" 
                 desc="إظهار الرسالة الآلية فوق كافة النوافذ."
                 active={config.onTextThreat.sendWarning} 
                 onToggle={() => updateConfig({ onTextThreat: { ...config.onTextThreat, sendWarning: !config.onTextThreat.sendWarning } })} 
               />
               <ProtocolToggle 
                 label="تفعيل صوت التنبيه" 
                 active={config.onTextThreat.triggerSiren} 
                 onToggle={() => updateConfig({ onTextThreat: { ...config.onTextThreat, triggerSiren: !config.onTextThreat.triggerSiren } })} 
               />
            </div>
         </div>

         {/* Protocol Card: Visual Threats */}
         <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8 flex flex-col">
            <div className="flex items-center gap-5 border-b border-slate-50 pb-8">
               <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-red-100">👁️</div>
               <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">بروتوكول التهديد البصري</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">عند رصد صور غير لائقة أو طلب كاميرا</p>
               </div>
            </div>

            <div className="space-y-4 flex-1">
               <ProtocolToggle 
                 label="حظر الكاميرا والميكروفون" 
                 desc="تعطيل العتاد برمجياً فور رصد محاولة استدراج."
                 active={config.onVisualThreat.blockCamera} 
                 onToggle={() => updateConfig({ onVisualThreat: { ...config.onVisualThreat, blockCamera: !config.onVisualThreat.blockCamera, blockMic: !config.onVisualThreat.blockMic } })} 
               />
               <ProtocolToggle 
                 label="قفل الهاتف بالكامل" 
                 desc="أقصى درجات الحماية عند وجود تهديد جنائي."
                 active={config.onVisualThreat.lockDevice} 
                 onToggle={() => updateConfig({ onVisualThreat: { ...config.onVisualThreat, lockDevice: !config.onVisualThreat.lockDevice } })} 
               />
               <ProtocolToggle 
                 label="صافرة الإنذار القصوى" 
                 active={config.onVisualThreat.triggerSiren} 
                 onToggle={() => updateConfig({ onVisualThreat: { ...config.onVisualThreat, triggerSiren: !config.onVisualThreat.triggerSiren } })} 
               />
               <ProtocolToggle 
                 label="تتبع الموقع الجغرافي الحي" 
                 desc="تحديث الإحداثيات كل ثانية فور رصد التهديد."
                 active={true} 
                 onToggle={() => {}} 
                 disabled={true}
               />
            </div>
         </div>
      </div>

      {/* Auto Messaging System */}
      <div className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 space-y-10">
         <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-indigo-100">💬</div>
            <div>
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">نظام رسالة الردع الاستباقية</h3>
               <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">تظهر هذه الرسالة آلياً للطفل عند رصد أي خطر</p>
            </div>
         </div>
         
         <div className="relative group">
            <textarea 
               value={config.autoMessage}
               onChange={(e) => updateConfig({ autoMessage: e.target.value })}
               className="w-full p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold text-xl shadow-inner text-right min-h-[180px] focus:border-indigo-500 focus:bg-white transition-all resize-none"
               placeholder="اكتب هنا الرسالة التي تريد أن يراها طفلك..."
            />
            <div className="absolute bottom-6 left-6 flex items-center gap-2">
               <span className="bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full shadow-lg">سيتم دفعها للجهاز فوراً</span>
            </div>
         </div>
      </div>

      {/* Audio Deterrence & Voice Vault */}
      <div className="bg-slate-900 rounded-[4rem] p-10 md:p-12 text-white shadow-2xl flex flex-col lg:flex-row items-center gap-12 border-b-8 border-indigo-600">
         <div className="flex-1 space-y-8">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-white/10">📢</div>
               <div>
                  <h3 className="text-3xl font-black tracking-tight">نظام الردع الصوتي</h3>
                  <p className="text-indigo-300 font-bold text-sm opacity-80">اختر صوت التنبيه أو سجل صوتك الشخصي لدفعه للجهاز.</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <button 
                 onClick={() => updateConfig({ sirenType: 'DEFAULT' })}
                 className={`p-6 rounded-[1.8rem] border-2 transition-all flex items-center justify-between group ${config.sirenType === 'DEFAULT' ? 'bg-indigo-600 border-indigo-400 shadow-xl' : 'bg-white/5 border-white/10 text-slate-500'}`}
               >
                  <div className="text-right">
                     <p className={`font-black ${config.sirenType === 'DEFAULT' ? 'text-white' : ''}`}>صافرة إنذار رسمية</p>
                     <p className="text-[10px] opacity-60">صوت عالي جداً لا يمكن كتمه</p>
                  </div>
                  <span className="text-2xl group-hover:scale-125 transition-transform">🚨</span>
               </button>

               <button 
                 onClick={() => updateConfig({ sirenType: 'VOICE_RECORD' })}
                 className={`p-6 rounded-[1.8rem] border-2 transition-all flex items-center justify-between group ${config.sirenType === 'VOICE_RECORD' ? 'bg-[#8A1538] border-[#B83A60] shadow-xl' : 'bg-white/5 border-white/10 text-slate-500'}`}
               >
                  <div className="text-right">
                     <p className={`font-black ${config.sirenType === 'VOICE_RECORD' ? 'text-white' : ''}`}>بصمة صوت الوالد</p>
                     <p className="text-[10px] opacity-60">دفع تسجيل صوتي مخصص</p>
                  </div>
                  <span className="text-2xl group-hover:scale-125 transition-transform">🎤</span>
               </button>
            </div>
         </div>

         {/* Recording Hub */}
         <div className="w-full lg:w-80 bg-white/5 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 flex flex-col items-center justify-center space-y-8 shadow-2xl relative overflow-hidden group/rec">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.1)_0%,transparent_70%)] opacity-0 group-hover/rec:opacity-100 transition-opacity"></div>
            
            <button 
              onMouseDown={handleRecordVoice}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative z-10 ${isRecording ? 'bg-red-600 scale-110 shadow-red-500/50' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
               <div className={`text-4xl ${isRecording ? 'animate-pulse' : ''}`}>{isRecording ? '⏺️' : '🎤'}</div>
               {isRecording && <div className="absolute inset-0 border-4 border-white/20 rounded-full animate-ping"></div>}
            </button>

            <div className="text-center relative z-10">
               <p className={`text-[11px] font-black uppercase tracking-widest ${isRecording ? 'text-red-500' : 'text-slate-400'}`}>
                  {isRecording ? 'جاري تسجيل صوتك...' : recordingStatus === 'DONE' ? 'تم الحفظ والمزامنة ✓' : 'اضغط مطولاً للتسجيل والدفع'}
               </p>
               {recordingStatus === 'DONE' && <p className="text-[8px] font-bold text-emerald-500 mt-2">Voice_Shield_V2.0_Loaded</p>}
            </div>
         </div>
      </div>

      <div className="flex justify-center pt-10">
         <button 
           onClick={() => alert("تم تعميم كافة بروتوكولات الدفاع الاستباقي على أجهزة الأطفال بنجاح.")}
           className="px-20 py-7 bg-slate-900 text-white rounded-[2.5rem] font-black text-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-6 border-b-4 border-black"
         >
            <span>💾</span>
            حفظ وتعميم البروتوكول
         </button>
      </div>

    </div>
  );
};

const ProtocolToggle: React.FC<{ label: string, desc?: string, active: boolean, onToggle: () => void, disabled?: boolean }> = ({ label, desc, active, onToggle, disabled }) => (
  <div 
    onClick={() => !disabled && onToggle()} 
    className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between group ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${active ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 'bg-slate-50/50 border-transparent hover:bg-slate-50'}`}
  >
     <div className="flex-1 text-right">
        <p className={`font-black text-lg ${active ? 'text-indigo-900' : 'text-slate-700'}`}>{label}</p>
        {desc && <p className="text-[10px] font-bold text-slate-400 mt-1 leading-none">{desc}</p>}
     </div>
     <div className={`w-14 h-8 rounded-full p-1 transition-all ${active ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-300'}`}>
        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${active ? '-translate-x-6' : 'translate-x-0'}`}></div>
     </div>
  </div>
);

export default ProactiveDefenseView;
