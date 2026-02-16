
import React, { useState, useEffect } from 'react';
import { PlatformMetric, ParentAccount } from '../types';
import { ICONS, AmanahShield } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PlatformSOCView: React.FC<{ currentUser: ParentAccount }> = ({ currentUser }) => {
  const [metrics, setMetrics] = useState<PlatformMetric>({
    apiLatency: '42ms',
    wafDrops: 1420,
    activeSessions: 89,
    dbIsolationStatus: 'SECURE',
    rateLimitHits: 450,
    bruteForceBlocked: 12
  });

  const [graphData] = useState(Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    threats: Math.floor(Math.random() * 50) + 10,
    latency: Math.floor(Math.random() * 20) + 30
  })));

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      
      {/* SOC Header */}
      <div className="bg-[#020617] rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-20 h-20 bg-indigo-600/20 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-indigo-500/30">📊</div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">Platform Operations Center</h2>
                  <p className="text-indigo-400 font-bold opacity-80 text-lg uppercase tracking-widest">Sovereign Security Monitoring • Read-Only Content</p>
               </div>
            </div>
            <div className="flex gap-4">
               <div className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-3">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                  GLOBAL WAF STATUS: ACTIVE
               </div>
            </div>
         </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <SOCStatCard label="API Latency" value={metrics.apiLatency} icon="🚀" color="text-indigo-400" />
         <SOCStatCard label="WAF Drops (24h)" value={metrics.wafDrops} icon="🛡️" color="text-red-400" />
         <SOCStatCard label="Active Sessions" value={metrics.activeSessions} icon="👥" color="text-emerald-400" />
         <SOCStatCard label="Rate Limit Hits" value={metrics.rateLimitHits} icon="🛑" color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 space-y-8">
            <div className="flex justify-between items-center px-4">
               <h3 className="text-2xl font-black text-slate-800">تحليل تدفق التهديدات (Global Threats)</h3>
               <span className="bg-slate-100 px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-500">REAL-TIME DATA STREAM</span>
            </div>
            <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={graphData}>
                     <defs>
                        <linearGradient id="threatGrad" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="time" hide />
                     <YAxis hide />
                     <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                     <Area type="monotone" dataKey="threats" stroke="#ef4444" strokeWidth={3} fill="url(#threatGrad)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl space-y-8 h-full">
               <h3 className="text-2xl font-black tracking-tight border-b border-white/10 pb-6">إجراءات الحماية النشطة</h3>
               <div className="space-y-6">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex justify-between items-center">
                     <div>
                        <p className="text-xs font-black text-indigo-300">Tenant Isolation</p>
                        <p className="text-[10px] text-slate-400">RLS Enforcement ON</p>
                     </div>
                     <span className="bg-emerald-600/20 text-emerald-400 px-4 py-1.5 rounded-xl text-[10px] font-black">SECURE</span>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex justify-between items-center">
                     <div>
                        <p className="text-xs font-black text-red-300">Penalty Box</p>
                        <p className="text-[10px] text-slate-400">Blocked IPs: 12</p>
                     </div>
                     <span className="bg-red-600/20 text-red-400 px-4 py-1.5 rounded-xl text-[10px] font-black">ACTIVE</span>
                  </div>
               </div>
               <div className="bg-indigo-600/10 p-6 rounded-3xl border border-indigo-500/20">
                  <p className="text-[11px] font-bold leading-relaxed text-indigo-200">
                     "نظام التدقيق (Audit) يسجل كافة طلبات الوصول للمسؤولين. يمنع برمجياً عرض محتوى الأدلة لغير أصحاب العائلة."
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

const SOCStatCard = ({ label, value, icon, color }: any) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2 group hover:scale-105 transition-all">
     <div className="text-3xl mb-2">{icon}</div>
     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
     <p className={`text-3xl font-black tracking-tighter ${color}`}>{value}</p>
  </div>
);

export default PlatformSOCView;
