
import React, { useEffect, useState } from 'react';
import { MonitoringAlert, AlertSeverity } from '../types';

interface NotificationToastProps {
  alert: MonitoringAlert;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ alert, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500); // Wait for exit animation
    }, 5000);
    return () => clearTimeout(timer);
  }, [alert, onClose]);

  return (
    <div className={`fixed top-8 left-0 right-0 z-[120] px-4 transition-all duration-500 ease-out transform ${visible ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'}`}>
      <div className="max-w-md mx-auto bg-white/95 backdrop-blur-xl rounded-[1.5rem] shadow-2xl border border-slate-200 overflow-hidden flex items-center p-4 gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amanah AI • الآن</p>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>
          </div>
          <h4 className="text-sm font-black text-slate-900 truncate">تنبيه أمني لـ {alert.childName}</h4>
          <p className="text-xs text-slate-600 truncate font-medium">{alert.aiAnalysis.substring(0, 60)}...</p>
        </div>
        <button onClick={() => setVisible(false)} className="text-slate-300 hover:text-slate-600">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
