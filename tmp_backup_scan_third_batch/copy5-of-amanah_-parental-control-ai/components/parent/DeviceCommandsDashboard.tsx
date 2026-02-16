
'use client';

import React, { useEffect, useState } from 'react';
import { ICONS, AmanahShield } from '../../constants';

export default function DeviceCommandsDashboard({ familyId, deviceId }: { familyId: string, deviceId: string }) {
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommands = async () => {
    try {
      const res = await fetch(`/api/families/${familyId}/devices/${deviceId}/commands/list`);
      const data = await res.json();
      if (data.ok) setCommands(data.commands);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchCommands();
    const interval = setInterval(fetchCommands, 4000);
    return () => clearInterval(interval);
  }, [deviceId]);

  const getStatusColor = (s: string) => {
    switch(s) {
      case 'acked': return 'bg-emerald-500 shadow-emerald-200';
      case 'timed_out': return 'bg-red-600 shadow-red-200';
      case 'sent': return 'bg-amber-400 animate-pulse shadow-amber-100';
      default: return 'bg-indigo-600';
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-[#020617] p-8 rounded-[3.5rem] border border-white/10 shadow-2xl flex justify-between items-center relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
         <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl border border-white/10 shadow-inner">📡</div>
            <div>
               <h3 className="text-2xl font-black text-white tracking-tighter">محرك الدفع الفوري (FCM Hub)</h3>
               <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Push Channel: Optimized</p>
               </div>
            </div>
         </div>
         <button onClick={fetchCommands} className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 transition-all">
            <ICONS.Dashboard className="w-6 h-6 text-white/40" />
         </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-20 text-center animate-pulse text-slate-300 font-black">جاري مزامنة حالة الأوامر السيادية...</div>
        ) : commands.length === 0 ? (
          <div className="p-20 text-center text-slate-200 font-black border-2 border-dashed border-slate-100 rounded-[3rem]">لا توجد تعليمات نشطة حالياً.</div>
        ) : (
          commands.map((cmd) => (
            <div key={cmd.command_id} className={`bg-white p-8 rounded-[3rem] border-2 transition-all group overflow-hidden relative ${cmd.status === 'timed_out' ? 'border-red-100 opacity-80' : 'border-slate-50 shadow-sm'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg text-white ${getStatusColor(cmd.status)}`}>
                       {cmd.command_key === 'LOCK_SCREEN' ? '🔒' : cmd.command_key === 'CUT_INTERNET' ? '🚫' : '⚡'}
                    </div>
                    <div className="text-right space-y-1">
                       <h4 className="text-xl font-black text-slate-800">{cmd.command_key}</h4>
                       <div className="flex items-center gap-3">
                          <span className="text-[9px] font-mono font-bold text-slate-400"># {cmd.command_id.slice(0, 12)}</span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                          <span className="text-[9px] font-black text-indigo-400 uppercase">Tries: {cmd.retry_count || 0}</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    <div className="text-left md:text-right px-4 border-r border-slate-100">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">وقت الصدور</p>
                       <p className="text-xs font-black text-slate-600">{new Date(cmd.requested_at).toLocaleTimeString()}</p>
                    </div>
                    <div className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${cmd.status === 'acked' ? 'bg-emerald-50 text-emerald-600' : cmd.status === 'timed_out' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                       {cmd.status === 'acked' ? 'Executed ✓' : cmd.status}
                    </div>
                 </div>
              </div>

              {cmd.status === 'timed_out' && cmd.ai_analysis && (
                <div className="mt-6 p-6 bg-red-50/50 rounded-2xl border border-red-100 italic text-xs font-bold text-red-700 leading-relaxed">
                   "تحليل الفشل: {cmd.ai_analysis.predictedCause}"
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
