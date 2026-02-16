
import React, { useState } from 'react';
import { CustomMode, Child } from '../types';
import { ICONS } from '../constants';

interface ModesViewProps {
  modes: CustomMode[];
  childList: Child[];
  onUpdateModes: (modes: CustomMode[]) => void;
  onApplyMode: (childId: string, modeId?: string) => void;
}

const ModesView: React.FC<ModesViewProps> = ({ modes = [], childList = [], onUpdateModes, onApplyMode }) => {
  const [editingMode, setEditingMode] = useState<Partial<CustomMode> | null>(null);

  const daysAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const handleSaveMode = () => {
    if (!editingMode?.name) return;
    const newMode: CustomMode = {
      id: editingMode.id || 'mode-' + Date.now(),
      name: editingMode.name,
      color: editingMode.color || 'bg-indigo-600',
      icon: editingMode.icon || '🛡️',
      allowedApps: editingMode.allowedApps || [],
      cameraEnabled: editingMode.cameraEnabled ?? true,
      micEnabled: editingMode.micEnabled ?? true,
      isInternetCut: editingMode.isInternetCut ?? false,
      isDeviceLocked: editingMode.isDeviceLocked ?? false,
      internetStartTime: editingMode.internetStartTime || '08:00',
      internetEndTime: editingMode.internetEndTime || '21:00',
      activeDays: editingMode.activeDays || [0, 1, 2, 3, 4, 5, 6]
    };
    onUpdateModes(modes.find(m => m.id === newMode.id) ? modes.map(m => m.id === newMode.id ? newMode : m) : [...modes, newMode]);
    setEditingMode(null);
  };

  const toggleDay = (dayIndex: number) => {
    const current = editingMode?.activeDays || [];
    const next = current.includes(dayIndex) ? current.filter(d => d !== dayIndex) : [...current, dayIndex];
    setEditingMode({ ...editingMode, activeDays: next });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">إدارة ملامح الاستخدام (Profiles)</h2>
          <p className="text-slate-500 font-bold mt-1">جدولة القواعد والقيود الزمنية للوصول الرقمي.</p>
        </div>
        <button 
          onClick={() => setEditingMode({ name: '', icon: '⚡', color: 'bg-indigo-600', activeDays: [0,1,2,3,4,5,6] })}
          className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-4 active:scale-95"
        >
          <ICONS.Plus />
          إنشاء ملف جدولة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {modes?.map(mode => (
          <div key={mode.id} className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-10 space-y-8 hover:shadow-2xl transition-all group relative overflow-hidden text-right">
            <div className="flex justify-between items-start">
              <button onClick={() => setEditingMode(mode)} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all border border-transparent hover:border-indigo-100"><ICONS.Settings /></button>
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{mode.name}</h3>
                  <div className="flex gap-2 justify-end mt-2">
                     <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tighter shadow-inner">
                       {mode.internetStartTime} - {mode.internetEndTime}
                     </span>
                  </div>
                </div>
                <div className={`w-20 h-20 ${mode.color} rounded-[2rem] flex items-center justify-center text-4xl shadow-xl text-white group-hover:scale-110 transition-transform`}>{mode.icon}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-y border-slate-50 py-6">
               <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">الإنترنت</p>
                  <p className={`font-bold text-xs ${mode.isInternetCut ? 'text-red-500' : 'text-emerald-500'}`}>{mode.isInternetCut ? 'مقطوع' : 'مسموح'}</p>
               </div>
               <div className="text-center border-x border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">الكاميرا</p>
                  <p className={`font-bold text-xs ${!mode.cameraEnabled ? 'text-red-500' : 'text-emerald-500'}`}>{!mode.cameraEnabled ? 'محجوبة' : 'ففعله'}</p>
               </div>
               <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">قفل الجهاز</p>
                  <p className={`font-bold text-xs ${mode.isDeviceLocked ? 'text-red-500' : 'text-emerald-500'}`}>{mode.isDeviceLocked ? 'مغلق' : 'مفتوح'}</p>
               </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تطبيق سريع:</p>
              <div className="flex flex-wrap gap-3 justify-end">
                {childList?.map(child => (
                  <button key={child.id} onClick={() => onApplyMode(child.id, mode.id)} className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all active:scale-90 group/btn shadow-sm">
                    <span className="text-[10px] font-black">{child.name}</span>
                    <img src={child.avatar} className="w-6 h-6 rounded-lg object-cover grayscale group-hover/btn:grayscale-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingMode && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-4 border-white text-right">
            <div className={`p-10 text-white flex justify-between items-center ${editingMode.color || 'bg-indigo-600'}`}>
              <button onClick={() => setEditingMode(null)} className="p-4 hover:bg-white/20 rounded-full transition-all"><ICONS.Close /></button>
              <div>
                 <h3 className="text-3xl font-black">{editingMode.id ? 'تحرير ملف الجدولة' : 'ملف جدولة جديد'}</h3>
                 <p className="text-xs font-bold opacity-70 mt-1">تكوين النطاق الزمني والقيود السيادية.</p>
              </div>
            </div>
            
            <div className="p-12 space-y-12 overflow-y-auto custom-scrollbar flex-1 pb-20">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                     <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest">اسم الملف (مثلاً: وقت النوم)</label>
                     <input value={editingMode.name} onChange={e => setEditingMode({...editingMode, name: e.target.value})} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-xl shadow-inner focus:border-indigo-600 transition-all text-right" />
                  </div>
                  <div className="space-y-4">
                     <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest">أيقونة الملف</label>
                     <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {['📚', '🌙', '🎮', '🚗', '🎓', '🏖️'].map(ico => (
                          <button key={ico} onClick={() => setEditingMode({...editingMode, icon: ico})} className={`p-5 rounded-2xl transition-all border-2 ${editingMode.icon === ico ? 'bg-indigo-50 border-indigo-600' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>{ico}</button>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">أيام التفعيل</label>
                  <div className="flex flex-wrap gap-3">
                     {daysAr?.map((d, i) => (
                       <button 
                         key={i} onClick={() => toggleDay(i)}
                         className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all border-2 ${editingMode.activeDays?.includes(i) ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105' : 'bg-slate-50 border-transparent text-slate-400'}`}
                       >
                         {d}
                       </button>
                     ))}
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-4">
                     <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest block">وقت بدء القيود</label>
                     <input type="time" value={editingMode.internetStartTime} onChange={e => setEditingMode({...editingMode, internetStartTime: e.target.value})} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-center text-2xl shadow-inner" />
                  </div>
                  <div className="space-y-4">
                     <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest block">وقت انتهاء القيود</label>
                     <input type="time" value={editingMode.internetEndTime} onChange={e => setEditingMode({...editingMode, internetEndTime: e.target.value})} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-center text-2xl shadow-inner" />
                  </div>
               </div>

               <div className="space-y-6">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">خيارات التحكم السيادي بالعتاد</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ConfigBtn label="تعطيل الكاميرا" active={!editingMode.cameraEnabled} onToggle={() => setEditingMode({...editingMode, cameraEnabled: !editingMode.cameraEnabled})} icon="📷" />
                    <ConfigBtn label="قطع الإنترنت" active={editingMode.isInternetCut || false} onToggle={() => setEditingMode({...editingMode, isInternetCut: !editingMode.isInternetCut})} icon="📡" />
                    <ConfigBtn label="قفل الهاتف" active={editingMode.isDeviceLocked || false} onToggle={() => setEditingMode({...editingMode, isDeviceLocked: !editingMode.isDeviceLocked})} icon="🔒" />
                    <ConfigBtn label="حجب التطبيقات" active={true} onToggle={() => {}} icon="📲" disabled />
                  </div>
               </div>
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4 pb-14 md:pb-10">
              <button onClick={handleSaveMode} className="flex-1 bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all">حفظ وإرسال الملف للأجهزة</button>
              <button onClick={() => setEditingMode(null)} className="px-12 bg-white text-slate-400 py-6 rounded-3xl font-black text-xl border-2 border-slate-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ConfigBtn = ({ label, active, onToggle, icon, disabled }: any) => (
  <button 
    onClick={onToggle} disabled={disabled}
    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${disabled ? 'opacity-30 cursor-not-allowed' : active ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}
  >
     <span className="text-2xl">{icon}</span>
     <span className="text-[10px] font-black whitespace-nowrap">{label}</span>
  </button>
);

export default ModesView;
