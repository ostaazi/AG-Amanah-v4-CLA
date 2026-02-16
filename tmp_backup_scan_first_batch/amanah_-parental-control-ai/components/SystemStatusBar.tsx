
import React, { useState, useEffect } from 'react';

interface SystemStatusBarProps {
  hasCriticalAlert: boolean;
  alertCount: number;
}

const SystemStatusBar: React.FC<SystemStatusBarProps> = ({ hasCriticalAlert, alertCount }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-7 bg-slate-900/10 backdrop-blur-md z-[110] flex items-center justify-between px-4 text-[11px] font-bold text-slate-800 pointer-events-none select-none">
      {/* Left side: Icons & Notifications */}
      <div className="flex items-center gap-2">
        <span>Amanah AI</span>
        {alertCount > 0 && (
          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
            <div className={`w-1.5 h-1.5 rounded-full ${hasCriticalAlert ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}></div>
            {hasCriticalAlert && (
              <svg className="w-3 h-3 text-red-600 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
            {!hasCriticalAlert && (
              <svg className="w-3 h-3 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Center: System Clock */}
      <div className="absolute left-1/2 -translate-x-1/2">
        {time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
      </div>

      {/* Right side: Phone Status */}
      <div className="flex items-center gap-2">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
        <span>5G</span>
        <div className="flex items-center gap-0.5 border border-slate-400 rounded-sm px-0.5 h-3">
          <div className="w-3 h-1.5 bg-slate-800 rounded-sm"></div>
        </div>
        <span>85%</span>
      </div>
    </div>
  );
};

export default SystemStatusBar;
