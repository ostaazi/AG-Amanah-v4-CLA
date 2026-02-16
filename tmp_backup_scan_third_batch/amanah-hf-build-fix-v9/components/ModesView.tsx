
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CustomMode, Child } from '../types';
import { ICONS } from '../constants';

interface ModesViewProps {
  modes: CustomMode[];
  children: Child[];
  onUpdateModes: (modes: CustomMode[]) => void;
  onApplyMode: (childId: string, modeId?: string) => void;
}

const ModesView: React.FC<ModesViewProps> = ({ modes, children, onUpdateModes, onApplyMode }) => {
  const location = useLocation();
  const [editingMode, setEditingMode] = useState<Partial<CustomMode> | null>(null);
  const [suggestedMode, setSuggestedMode] = useState<Partial<CustomMode> | null>(null);

  // التحقق من وجود وضع مقترح من صفحة التحليل النفسي
  useEffect(() => {
    if (location.state && (location.state as any).suggestedMode) {
      const sug = (location.state as any).suggestedMode;
      setSuggestedMode(sug);
      setEditingMode(sug); // فتح واجهة الحفظ تلقائياً للوضع المقترح
    }
  }, [location]);

  const handleSaveMode = () => {
    if (!editingMode?.name) return;
    const modeToSave: CustomMode = {
      id: editingMode.id || 'mode-' + Date.now(),
      name: editingMode.name,
      color: editingMode.color || 'bg-indigo-600',
      icon: editingMode.icon || '🛠️',
      allowedApps: editingMode.allowedApps || [],
      allowedUrls: editingMode.allowedUrls || [],
      blacklistedUrls: editingMode.blacklistedUrls || [],
      cameraEnabled: editingMode.cameraEnabled ?? true,
      micEnabled: editingMode.micEnabled ?? true,
      isInternetCut: editingMode.isInternetCut ?? false,
      isScreenDimmed: editingMode.isScreenDimmed ?? false,
      isDeviceLocked: editingMode.isDeviceLocked ?? false,
      internetStartTime: editingMode.internetStartTime || '08:00',
      internetEndTime: editingMode.internetEndTime || '22:00',
      activeDays: editingMode.activeDays || [0, 1, 2, 3, 4, 5, 6]
    };
    
    onUpdateModes(modes.find(m => m.id === modeToSave.id) 
      ? modes.map(m => m.id === modeToSave.id ? modeToSave : m)
      : [...modes, modeToSave]
    );

    // إذا كان وضعاً مقترحاً للطوارئ، نطبقه فوراً على الطفل
    if (suggestedMode) {
      onApplyMode(children[0].id, modeToSave.id);
    }

    setEditingMode(null);
    setSuggestedMode(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      
      {/* تنبيه بالوضع المقترح */}
      {suggestedMode && (
        <div className="bg-red-600 p-8 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border-b-8 border-red-800 animate-bounce">
           <div className="flex items-center gap-6">
              <span className="text-5xl">⚠️</span>
              <div className="text-right">
                 <h3 className="text-2xl font-black">تحذير: خطة تدخل عاجلة جاهزة</h3>
                 <p className="text-sm font-bold opacity-80">تم ضبط الإعدادات بناءً على آخر تحليل جنائي ونفسي لـ {children[0].name}.</p>
              </div>
           </div>
           <button 
             onClick={handleSaveMode}
             className="bg-white text-red-600 px-10 py-5 rounded-[2rem] font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
           >
             حفظ وتطبيق الخطة الآن
           </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">إدارة الأوضاع الذكية</h2>
          <p className="text-slate-500 font-bold mt-1">جدولة آلية، قيود عتاد، وحماية فورية.</p>
        </div>
        <button 
          onClick={() => setEditingMode({ name: '', allowedApps: [], allowedUrls: [], blacklistedUrls: [] })}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95"
        >
          <ICONS.Plus />
          إنشاء وضع مخصص
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {modes.map(mode => (
          <div key={mode.id} className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-10 space-y-8 hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 ${mode.color} rounded-3xl flex items-center justify-center text-4xl shadow-lg text-white`}>
                  {mode.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{mode.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mode.internetStartTime} - {mode.internetEndTime}</p>
                </div>
              </div>
              <button onClick={() => setEditingMode(mode)} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all border border-transparent hover:border-indigo-100">
                <ICONS.Settings />
              </button>
            </div>

            <div className="pt-6 border-t border-slate-50 relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">التطبيق السريع على الأبناء:</p>
              <div className="flex flex-wrap gap-3">
                {children.map(child => (
                  <button key={child.id} onClick={() => onApplyMode(child.id, mode.id)} className="flex items-center gap-3 px-6 py-3 bg-slate-50 hover:bg-indigo-50 rounded-full border border-slate-100 transition-all active:scale-90">
                    <img src={child.avatar} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                    <span className="text-[11px] font-black text-slate-700">{child.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingMode && (
        <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-t-[4rem] sm:rounded-[4rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 flex flex-col max-h-[95vh] border-x-4 border-t-4 border-white">
            <div className={`p-10 text-white flex justify-between items-center ${editingMode.color || 'bg-indigo-600'}`}>
              <div>
                 <h3 className="text-3xl font-black">إعدادات وضع الحماية</h3>
                 <p className="text-xs font-bold opacity-70">خصص قواعد هذا الوضع واحفظه للرجوع إليه لاحقاً.</p>
              </div>
              <button onClick={() => { setEditingMode(null); setSuggestedMode(null); }} className="p-4 hover:bg-white/20 rounded-full transition-all border border-white/20">
                <ICONS.Close />
              </button>
            </div>
            
            <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar flex-1 pb-16 text-right">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-4 tracking-widest">اسم النمط</label>
                  <input value={editingMode.name} onChange={e => setEditingMode({...editingMode, name: e.target.value})} placeholder="مثلاً: وقت المذاكرة المكثف" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none font-black text-xl shadow-inner focus:ring-4 focus:ring-indigo-100 transition-all text-right" />
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase px-4 tracking-widest text-right block">بداية الإنترنت</label>
                     <input type="time" value={editingMode.internetStartTime} onChange={e => setEditingMode({...editingMode, internetStartTime: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-right" />
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase px-4 tracking-widest text-right block">نهاية الإنترنت</label>
                     <input type="time" value={editingMode.internetEndTime} onChange={e => setEditingMode({...editingMode, internetEndTime: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-right" />
                  </div>
               </div>

               <div className="space-y-6">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-4 tracking-widest text-right block">المواقع المحظورة (Blacklist)</label>
                  <div className="flex flex-wrap gap-2 justify-start">
                    {editingMode.blacklistedUrls?.map(u => (
                      <div key={u} className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-[10px] font-black border border-red-100 flex items-center gap-2">
                         <span>{u}</span>
                         <button className="text-red-300">✕</button>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4 pb-14 sm:pb-10">
              <button onClick={handleSaveMode} className="flex-1 bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all">
                 {suggestedMode ? 'حفظ وتطبيق الخطة المقترحة' : 'حفظ الوضع الجديد'}
              </button>
              <button onClick={() => { setEditingMode(null); setSuggestedMode(null); }} className="px-8 bg-white text-slate-400 py-6 rounded-[2rem] font-black text-xl border border-slate-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModesView;
