import React, { useState } from 'react';
import { AmanahShield } from '../constants';
import { translations } from '../translations';

interface ChildAppViewProps {
  childName: string;
  lang: 'ar' | 'en';
}

const ChildAppView: React.FC<ChildAppViewProps> = ({ childName, lang }) => {
  const t = translations[lang];
  const [isLocked, setIsLocked] = useState(false);

  return (
    <div
      className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-8 text-center text-white"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Background Animated Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0%,transparent_70%)] animate-pulse"></div>
      </div>

      <div className="relative z-10 space-y-12 animate-in fade-in duration-1000">
        <div className="flex flex-col items-center gap-6">
          <div className="w-32 h-32 bg-white/10 rounded-[3rem] backdrop-blur-xl border-4 border-indigo-500/50 flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.3)]">
            <AmanahShield className="w-20 h-20" />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tighter">{t.childModeTitle}</h2>
            <p className="text-indigo-300 font-bold text-lg">{t.childStatusSafe}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 w-full max-w-sm mx-auto">
          <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                حالة الاتصال
              </span>
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            </div>
            <p className="text-xl font-bold">مرحباً {childName}، جهازي مؤمن</p>
          </div>

          {/* محاكاة للتطبيقات المسموحة */}
          <div className="grid grid-cols-4 gap-4">
            {['📚', '🎓', '📝', '📞'].map((icon, idx) => (
              <div
                key={idx}
                className="w-full aspect-square bg-indigo-900/40 rounded-2xl flex items-center justify-center text-3xl border border-indigo-500/20 shadow-lg"
              >
                {icon}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-10">
          <div className="flex items-center justify-center gap-3 text-white/40">
            <div className="w-2 h-2 bg-white/20 rounded-full"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">
              Amanah Protocol v1.0.4
            </span>
            <div className="w-2 h-2 bg-white/20 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildAppView;
