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
  const [suggestedPlan, setSuggestedPlan] = useState<Partial<CustomMode> | null>(null);

  // التحقق من وجود وضع مقترح قادم من صفحة النبض النفسي عبر الـ state
  useEffect(() => {
    if (location.state && (location.state as any).suggestedMode) {
      const plan = (location.state as any).suggestedMode;
      setSuggestedPlan(plan);
      setEditingMode(plan); // فتح واجهة التعديل فوراً للخطة المقترحة
    }
  }, [location.state]);

  const handleSaveMode = () => {
    if (!editingMode?.name) return;

    const modeToSave: CustomMode = {
      id: editingMode.id || 'mode-' + Date.now(),
      name: editingMode.name,
      color: editingMode.color || 'bg-indigo-600',
      icon: editingMode.icon || '🛡️',
      allowedApps: editingMode.allowedApps || [],
      allowedUrls: editingMode.allowedUrls || [],
      blacklistedUrls: editingMode.blacklistedUrls || [],
      cameraEnabled: editingMode.cameraEnabled ?? true,
      micEnabled: editingMode.micEnabled ?? true,
      isInternetCut: editingMode.isInternetCut ?? false,
      isScreenDimmed: editingMode.isScreenDimmed ?? false,
      isDeviceLocked: editingMode.isDeviceLocked ?? false,
      internetStartTime: editingMode.internetStartTime || '08:00',
      internetEndTime: editingMode.internetEndTime || '21:00',
      activeDays: editingMode.activeDays || [0, 1, 2, 3, 4, 5, 6],
      preferredVideoSource: editingMode.preferredVideoSource || 'screen',
      preferredAudioSource: editingMode.preferredAudioSource || 'mic',
      autoStartLiveStream: editingMode.autoStartLiveStream ?? false,
      autoTakeScreenshot: editingMode.autoTakeScreenshot ?? false,
      blackoutOnApply: editingMode.blackoutOnApply ?? false,
      blackoutMessage: editingMode.blackoutMessage || '',
      enableWalkieTalkieOnApply: editingMode.enableWalkieTalkieOnApply ?? false,
    };

    // تحديث قائمة الأوضاع (إضافة أو تعديل)
    onUpdateModes(
      modes.find((m) => m.id === modeToSave.id)
        ? modes.map((m) => (m.id === modeToSave.id ? modeToSave : m))
        : [...modes, modeToSave]
    );

    setEditingMode(null);
    setSuggestedPlan(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      {/* عرض تنبيه الخطة المقترحة من التحليل النفسي */}
      {suggestedPlan && (
        <div className="bg-red-600 p-8 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border-b-8 border-red-800 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-6 text-right">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-red-600 text-3xl shadow-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-2xl font-black">اقتراح ذكاء اصطناعي لـ {suggestedPlan.name}</h3>
              <p className="text-sm font-bold opacity-80">
                تم إنشاء هذا الوضع بناءً على التغيرات الأخيرة في نبض الطفل النفسي.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleSaveMode}
              className="bg-white text-red-600 px-8 py-4 rounded-2xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              اعتماد الوضع
            </button>
            <button
              onClick={() => setSuggestedPlan(null)}
              className="bg-red-700 text-white px-8 py-4 rounded-2xl font-black text-sm border border-red-500"
            >
              تجاهل
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-right">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
            الأوضاع الذكية (Modes)
          </h2>
          <p className="text-slate-500 font-bold mt-1">
            القواعد المقررة لتطبيقات طفلك، الكاميرا، والإنترنت.
          </p>
        </div>
        <button
          onClick={() => setEditingMode({ name: '', icon: '⚡', color: 'bg-indigo-600' })}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95"
        >
          <ICONS.Plus />
          إنشاء وضع مخصص
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {modes.map((mode) => (
          <div
            key={mode.id}
            className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-8 space-y-8 hover:shadow-2xl transition-all group relative overflow-hidden text-right border-b-4 border-indigo-100"
          >
            <div className="flex justify-between items-start">
              <button
                onClick={() => setEditingMode(mode)}
                className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all border border-transparent hover:border-indigo-100 shadow-sm"
              >
                <ICONS.Settings />
              </button>
              <div className="flex items-center gap-5">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{mode.name}</h3>
                  <div className="flex gap-2 justify-end mt-1">
                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">
                      {mode.internetStartTime} - {mode.internetEndTime}
                    </span>
                  </div>
                </div>
                <div
                  className={`w-16 h-16 ${mode.color} rounded-3xl flex items-center justify-center text-4xl shadow-lg text-white`}
                >
                  {mode.icon}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div
                className={`p-4 rounded-2xl text-center ${mode.cameraEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
              >
                <p className="text-[10px] font-black mb-1 uppercase tracking-tighter">الكاميرا</p>
                <p className="font-bold text-xs">{mode.cameraEnabled ? 'مفعلة' : 'محجوبة'}</p>
              </div>
              <div
                className={`p-4 rounded-2xl text-center ${!mode.isInternetCut ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
              >
                <p className="text-[10px] font-black mb-1 uppercase tracking-tighter">الإنترنت</p>
                <p className="font-bold text-xs">{!mode.isInternetCut ? 'متصل' : 'مقطوع'}</p>
              </div>
              <div
                className={`p-4 rounded-2xl text-center ${!mode.isDeviceLocked ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
              >
                <p className="text-[10px] font-black mb-1 uppercase tracking-tighter">الجهاز</p>
                <p className="font-bold text-xs">{!mode.isDeviceLocked ? 'مفتوح' : 'مغلق'}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">
                التطبيق السريع على الأطفال:
              </p>
              <div className="flex flex-wrap gap-3 justify-end">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onApplyMode(child.id, mode.id)}
                    className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-indigo-50 rounded-full border border-slate-100 transition-all active:scale-90 shadow-sm group"
                  >
                    <span className="text-[11px] font-black text-slate-700 group-hover:text-indigo-600">
                      {child.name}
                    </span>
                    <img
                      src={child.avatar}
                      className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* نافذة التعديل والإنشاء */}
      {editingMode && (
        <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-t-[4rem] sm:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border-x-4 border-t-4 border-white text-right">
            <div
              className={`p-10 text-white flex justify-between items-center ${editingMode.color || 'bg-indigo-600'} transition-colors duration-500`}
            >
              <button
                onClick={() => {
                  setEditingMode(null);
                  setSuggestedPlan(null);
                }}
                className="p-4 hover:bg-white/20 rounded-full transition-all border border-white/20"
              >
                <ICONS.Close />
              </button>
              <div>
                <h3 className="text-3xl font-black">
                  {editingMode.id ? 'تعديل النمط' : 'إنشاء نمط جديد'}
                </h3>
                <p className="text-xs font-bold opacity-70">
                  خصص القواعد والقيود التقنية لهذا الوضع.
                </p>
              </div>
            </div>

            <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar flex-1 pb-16">
              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest">
                  اسم النمط
                </label>
                <input
                  value={editingMode.name}
                  onChange={(e) => setEditingMode({ ...editingMode, name: e.target.value })}
                  placeholder="مثلاً: وقت المذاكرة"
                  className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] outline-none font-black text-2xl shadow-inner text-right focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest block">
                    نهاية الإنترنت
                  </label>
                  <input
                    type="time"
                    value={editingMode.internetEndTime}
                    onChange={(e) =>
                      setEditingMode({ ...editingMode, internetEndTime: e.target.value })
                    }
                    className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl font-black text-center text-xl"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest block">
                    بداية الإنترنت
                  </label>
                  <input
                    type="time"
                    value={editingMode.internetStartTime}
                    onChange={(e) =>
                      setEditingMode({ ...editingMode, internetStartTime: e.target.value })
                    }
                    className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl font-black text-center text-xl"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest block">
                  خيارات التحكم بالعتاد
                </label>
                <div className="grid grid-cols-2 gap-6">
                  <button
                    onClick={() =>
                      setEditingMode({ ...editingMode, cameraEnabled: !editingMode.cameraEnabled })
                    }
                    className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between ${editingMode.cameraEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                  >
                    <span className="text-2xl">{editingMode.cameraEnabled ? '📷' : '🚫'}</span>
                    <span className="font-black text-xs">
                      الكاميرا: {editingMode.cameraEnabled ? 'مفعلة' : 'محجوبة'}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingMode({ ...editingMode, isInternetCut: !editingMode.isInternetCut })
                    }
                    className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between ${!editingMode.isInternetCut ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                  >
                    <span className="text-2xl">{!editingMode.isInternetCut ? '📡' : '✂️'}</span>
                    <span className="font-black text-xs">
                      الإنترنت: {!editingMode.isInternetCut ? 'نشط' : 'مقطوع'}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingMode({
                        ...editingMode,
                        isDeviceLocked: !editingMode.isDeviceLocked,
                      })
                    }
                    className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between ${!editingMode.isDeviceLocked ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                  >
                    <span className="text-2xl">{!editingMode.isDeviceLocked ? '📱' : '🔒'}</span>
                    <span className="font-black text-xs">
                      الجهاز: {!editingMode.isDeviceLocked ? 'مفتوح' : 'مقفل'}
                    </span>
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest block">
                  إعدادات البث التلقائي
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-[11px] font-black text-slate-500 px-1">مصدر الصورة المفضل</p>
                    <select
                      value={editingMode.preferredVideoSource || 'screen'}
                      onChange={(e) =>
                        setEditingMode({
                          ...editingMode,
                          preferredVideoSource: e.target.value as 'camera_front' | 'camera_back' | 'screen',
                        })
                      }
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm"
                    >
                      <option value="camera_front">الكاميرا الأمامية</option>
                      <option value="camera_back">الكاميرا الخلفية</option>
                      <option value="screen">شاشة الجهاز</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] font-black text-slate-500 px-1">مصدر الصوت المفضل</p>
                    <select
                      value={editingMode.preferredAudioSource || 'mic'}
                      onChange={(e) =>
                        setEditingMode({
                          ...editingMode,
                          preferredAudioSource: e.target.value as 'mic' | 'system',
                        })
                      }
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm"
                    >
                      <option value="mic">الميكروفون</option>
                      <option value="system">صوت النظام</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() =>
                      setEditingMode({
                        ...editingMode,
                        autoStartLiveStream: !editingMode.autoStartLiveStream,
                      })
                    }
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      editingMode.autoStartLiveStream
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xl">{editingMode.autoStartLiveStream ? 'ON' : 'OFF'}</span>
                    <span className="font-black text-xs">تشغيل البث تلقائيًا عند تطبيق الوضع</span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingMode({
                        ...editingMode,
                        autoTakeScreenshot: !editingMode.autoTakeScreenshot,
                      })
                    }
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      editingMode.autoTakeScreenshot
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xl">{editingMode.autoTakeScreenshot ? 'ON' : 'OFF'}</span>
                    <span className="font-black text-xs">التقاط لقطة شاشة تلقائيًا</span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingMode({
                        ...editingMode,
                        blackoutOnApply: !editingMode.blackoutOnApply,
                      })
                    }
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      editingMode.blackoutOnApply
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xl">{editingMode.blackoutOnApply ? 'ON' : 'OFF'}</span>
                    <span className="font-black text-xs">تفعيل شاشة سوداء برسالة حماية</span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingMode({
                        ...editingMode,
                        enableWalkieTalkieOnApply: !editingMode.enableWalkieTalkieOnApply,
                      })
                    }
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      editingMode.enableWalkieTalkieOnApply
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xl">{editingMode.enableWalkieTalkieOnApply ? 'ON' : 'OFF'}</span>
                    <span className="font-black text-xs">تفعيل Walkie-Talkie تلقائيًا</span>
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] font-black text-slate-500 px-1">رسالة شاشة الحجب الوقائي</p>
                  <input
                    value={editingMode.blackoutMessage || ''}
                    onChange={(e) =>
                      setEditingMode({
                        ...editingMode,
                        blackoutMessage: e.target.value,
                      })
                    }
                    placeholder="تم قفل الجهاز لدواعي الأمان. يرجى التواصل مع الوالدين."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4 pb-14 sm:pb-10">
              <button
                onClick={handleSaveMode}
                className="flex-1 bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all"
              >
                {suggestedPlan ? 'اعتماد وحفظ خطة الذكاء الاصطناعي' : 'حفظ التغييرات'}
              </button>
              <button
                onClick={() => {
                  setEditingMode(null);
                  setSuggestedPlan(null);
                }}
                className="px-10 bg-white text-slate-400 py-6 rounded-[2.5rem] font-black text-xl border border-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModesView;
