import React from 'react';
import { MonitoringAlert } from '../types';
import { ICONS } from '../constants';

interface EmergencyOverlayProps {
  alert: MonitoringAlert;
  onClose: () => void;
  onAction: () => void;
  onMinimize?: () => void; // New prop to handle minimizing to notification
}

const EmergencyOverlay: React.FC<EmergencyOverlayProps> = ({
  alert,
  onClose,
  onAction,
  onMinimize,
}) => {
  const deviceName = 'iPhone 15 Pro';
  const displayPlatform =
    alert.platform === 'Discord' || alert.platform.includes('V19') ? 'Discord' : alert.platform;
  const displaySuspectId = alert.suspectId ? `@${alert.suspectId.replace('@', '')}` : 'مجهول';

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center p-0 md:p-4 overflow-hidden">
      <div className="absolute inset-0 bg-red-950/40 backdrop-blur-2xl"></div>

      <div className="relative w-full max-w-2xl h-full md:h-auto md:max-h-[96vh] bg-white rounded-none md:rounded-[3.5rem] shadow-[0_0_150px_rgba(220,38,38,0.4)] overflow-y-auto custom-scrollbar flex flex-col border-0 md:border-4 border-white animate-in zoom-in-95 duration-300">
        {/* Header Section */}
        <div className="bg-red-600 p-8 md:p-10 text-white relative flex-shrink-0">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border-2 border-white/30 animate-pulse text-3xl">
                ⚠️
              </div>
              <div className="text-right">
                <h2 className="text-4xl font-black tracking-tighter leading-none mb-1 text-white">
                  تنبيه طوارئ حرج
                </h2>
                <p className="text-red-100 text-sm font-bold opacity-80">
                  رصد محاولة استدراج أو تهديد مباشر
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {onMinimize && (
                <button
                  onClick={onMinimize}
                  className="p-3 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
                  title="تصغير الإشعار"
                >
                  <span className="text-lg">🤏</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-3 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
              >
                <ICONS.Close />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 mb-6">
            <span className="bg-white/20 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
              الطفل المستهدف: {alert.childName}
            </span>
            <span className="bg-slate-900/40 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
              جهاز الطفل: {deviceName}
            </span>
          </div>

          <div className="w-full bg-slate-950/60 px-6 py-4 rounded-2xl text-[11px] font-mono font-black uppercase tracking-widest border border-white/5 flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-indigo-400 font-black">المنصة:</span>
              <span className="text-white">{displayPlatform}</span>
            </div>
            <span className="w-px h-4 bg-white/20"></span>
            <div className="flex items-center gap-3">
              <span className="text-red-400 font-black">المشتبه به :</span>
              <span className="text-white">{displaySuspectId}</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 md:p-12 space-y-12 bg-slate-50">
          <div className="text-center space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
              المحتوى المرصود
            </p>
            <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm relative">
              <p className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                "{alert.content}"
              </p>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-6 py-1.5 rounded-full shadow-lg">
                إشارة عالية الخطورة
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm space-y-10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-2 h-8 bg-red-600 rounded-full"></div>
              <h4 className="text-red-600 font-black text-xl">تحليل الذكاء الاصطناعي:</h4>
            </div>

            <div className="space-y-8 border-b border-slate-100 pb-10">
              <div className="space-y-4">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-right px-4">
                  المحرك الرقمي:
                </p>
                <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-[2rem] flex items-center justify-between">
                  <span className="text-sm font-mono font-black text-indigo-700 flex-1 text-right">
                    V19.0 Turbo Spectrum
                  </span>
                  <span className="text-2xl mr-4">⚙️</span>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-right px-4">
                  زمن الرصد (LATENCY):
                </p>
                <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-[2rem] flex items-center justify-between">
                  <span className="text-sm font-mono font-black text-emerald-700 flex-1 text-right">
                    {alert.latency || '0.1000ms'}
                  </span>
                  <span className="text-2xl mr-4">⚡</span>
                </div>
              </div>
            </div>

            <p className="text-lg text-slate-700 font-bold leading-relaxed pr-2">
              تم اكتشاف محاولة استدراج صريحة لتبادل صور خاصة.{' '}
              <span className="text-red-600 font-black">
                تم تفعيل بروتوكول العزل الجنائي فوراً.
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 md:p-12 bg-white border-t border-slate-100 flex-shrink-0 pb-32 md:pb-12 space-y-4">
          <button
            onClick={onAction}
            className="w-full h-24 bg-slate-900 text-white rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-8 shadow-2xl active:scale-95 transition-all"
          >
            <div className="bg-indigo-600 p-4 rounded-2xl">
              <ICONS.Vault />
            </div>
            <div className="text-right">
              <p className="leading-none mb-2 text-white">فتح تفاصيل الدليل الجنائي</p>
              <p className="text-xs font-bold text-slate-400 font-mono tracking-widest uppercase">
                Secure_Vault_Access
              </p>
            </div>
          </button>

          {onMinimize && (
            <button
              onClick={onMinimize}
              className="w-full h-14 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all active:scale-95"
            >
              <span>🔔</span>
              تبسيط التنبيه لإشعار علوي فقط
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyOverlay;
