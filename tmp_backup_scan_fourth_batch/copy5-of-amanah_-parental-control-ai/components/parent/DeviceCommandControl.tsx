
import React, { useState } from 'react';
import { ICONS } from '../../constants';

export default function DeviceCommandControl({ deviceId }: { deviceId: string }) {
  const [pendingCmds, setPendingCmds] = useState<any[]>([]);

  const sendCmd = async (type: string, label: string) => {
    const reason = prompt(`يرجى إدخال سبب لإصدار أمر (${label}):`);
    if (!reason) return;

    const newCmd = { 
      id: Math.random().toString(36).substr(2, 9), 
      type, 
      label, 
      status: 'queued', 
      time: new Date().toLocaleTimeString() 
    };
    setPendingCmds([newCmd, ...pendingCmds]);

    // محاكاة دورة حياة الأمر (Queued -> Sent -> Acked)
    setTimeout(() => {
      setPendingCmds(prev => prev.map(c => c.id === newCmd.id ? { ...c, status: 'sent' } : c));
      setTimeout(() => {
        setPendingCmds(prev => prev.map(c => c.id === newCmd.id ? { ...c, status: 'acked' } : c));
      }, 2000);
    }, 1500);
  };

  return (
    <div className="space-y-8" dir="rtl">
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CommandBtn icon="🌑" label="تعتيم الشاشة" onClick={() => sendCmd('LOCK_OVERLAY', 'تعتيم الشاشة')} color="bg-slate-900" />
          <CommandBtn icon="📡" label="حجر الشبكة" onClick={() => sendCmd('CUT_INTERNET', 'حجر الشبكة')} color="bg-indigo-600" />
          <CommandBtn icon="📸" label="لقطة شاشة" onClick={() => sendCmd('CAPTURE_SCREENSHOT', 'لقطة شاشة')} color="bg-[#8A1538]" />
          <CommandBtn icon="🎤" label="فتح المايك" onClick={() => sendCmd('CAPTURE_AUDIO', 'فتح المايك')} color="bg-emerald-600" />
       </div>

       {pendingCmds.length > 0 && (
         <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
            <h4 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
               سجل الأوامر النشطة
               <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
            </h4>
            <div className="space-y-4">
               {pendingCmds.slice(0, 3).map(cmd => (
                 <div key={cmd.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                       <span className="text-xl">⚡</span>
                       <div>
                          <p className="font-black text-sm text-slate-800">{cmd.label}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{cmd.time} • ID: {cmd.id}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                         cmd.status === 'acked' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 animate-pulse'
                       }`}>
                          {cmd.status === 'acked' ? 'Executed ✓' : 'Processing...'}
                       </span>
                       {cmd.status === 'acked' && <span className="text-emerald-500 text-lg">✓</span>}
                    </div>
                 </div>
               ))}
            </div>
         </div>
       )}
    </div>
  );
}

const CommandBtn = ({ icon, label, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className={`${color} p-6 rounded-[2.5rem] text-white flex flex-col items-center justify-center gap-3 shadow-xl active:scale-90 transition-all hover:scale-105 group relative overflow-hidden`}
  >
     <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
     <span className="text-3xl relative z-10">{icon}</span>
     <span className="font-black text-[10px] uppercase tracking-tighter relative z-10">{label}</span>
  </button>
);
