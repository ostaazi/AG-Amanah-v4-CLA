
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Child, MonitoringAlert, AlertSeverity, ActivityLog } from '../types';
import { translations } from '../translations';
import { subscribeToActivities } from '../services/firestoreService';

interface DashboardViewProps {
  children: Child[];
  alerts: MonitoringAlert[];
  onTriggerDemo: () => void;
  lang: 'ar' | 'en';
  parentId: string;
}

const DashboardView: React.FC<DashboardViewProps> = ({ children, alerts, onTriggerDemo, lang, parentId }) => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const criticalAlerts = alerts.filter(a => a.severity === AlertSeverity.CRITICAL || a.severity === AlertSeverity.HIGH);
  const recentAlerts = alerts.slice(0, 4);
  const t = translations[lang];

  useEffect(() => {
    if (!parentId) return;
    const unsub = subscribeToActivities(parentId, (data) => {
        setActivities(data);
    });
    return () => unsub();
  }, [parentId]);

  const getActivityIcon = (type: string) => {
    switch (type) {
        case 'SUCCESS': return '✅';
        case 'DANGER': return '🗑️';
        case 'WARNING': return '⚠️';
        default: return 'ℹ️';
    }
  };

  const handleAlertClick = (id: string) => {
    navigate('/vault', { state: { openAlertId: id } });
  };

  return (
    <div className="space-y-10 pb-10 animate-in fade-in duration-700">
      {/* Hero Section */}
      <div className="bg-slate-900 rounded-[3.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl border-b-4 border-indigo-600">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10 text-center lg:text-right">
          <div>
            <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">{t.systemActive}</h2>
            <p className="text-indigo-200 text-lg font-bold opacity-80 max-w-xl">{t.monitoringMsg}</p>
          </div>
          <button 
            onClick={onTriggerDemo}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-5 rounded-[2.5rem] flex items-center gap-4 transition-all active:scale-95 group shadow-[0_15px_30px_rgba(220,38,38,0.3)] border border-red-500/50"
          >
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
            </span>
            <span className="text-sm font-black tracking-tighter uppercase">{t.penetrationTest}</span>
          </button>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-20 -translate-y-20"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat label={t.todaysAlerts} value={alerts.length} color="red" />
            <QuickStat label={t.screenHours} value="4.2" sub={t.hour} color="indigo" />
            <QuickStat label={t.blockedSites} value="12" color="amber" />
            <QuickStat label={t.linkStatus} value={t.secure} color="green" />
          </div>

          <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[4rem] border border-white shadow-xl">
            <div className="flex justify-between items-center mb-8 px-4">
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{t.recentActivity}</h3>
              <Link to="/alerts" className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline">{t.fullLog}</Link>
            </div>
            
            <div className="space-y-3">
              {recentAlerts.length > 0 ? recentAlerts.map(alert => (
                <div 
                  key={alert.id} 
                  onClick={() => handleAlertClick(alert.id)}
                  className="flex items-center gap-4 p-4 rounded-[2rem] bg-slate-50/50 border border-white hover:bg-white hover:shadow-md cursor-pointer transition-all group active:scale-[0.98]"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    <span className="text-xl">⚠️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{alert.category}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{alert.platform} • {alert.childName}</p>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {alert.severity}
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-slate-400 font-bold italic">{t.noAlerts}</div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-[3.5rem] p-8 md:p-10 shadow-2xl text-white relative overflow-hidden group">
             <div className="flex justify-between items-center mb-8 relative z-10">
                <h3 className="text-2xl font-black tracking-tighter">سجل عمليات النظام (Audit)</h3>
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">مراقب بالذكاء الاصطناعي</span>
             </div>
             <div className="space-y-4 relative z-10 max-h-80 overflow-y-auto custom-scrollbar">
                {activities.map((log) => (
                    <div key={log.id} className="flex gap-4 items-start p-4 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-lg">
                           {getActivityIcon(log.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-black text-white">{log.action}</p>
                              <span className="text-[9px] text-indigo-300 font-mono font-bold" dir="ltr">{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{log.details}</p>
                        </div>
                    </div>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl text-white relative overflow-hidden group">
            <h3 className="text-2xl font-black mb-8 relative z-10 tracking-tighter">{t.psychPulse}</h3>
            {children.map(child => (
              <div key={child.id} className="space-y-6 relative z-10 mb-10 last:mb-0">
                <div className="flex items-center gap-6">
                  {/* جعل صورة الطفل شفافة بالكامل بدون خلفية أو حدود */}
                  <img src={child.avatar} className="w-20 h-20 rounded-full object-cover bg-transparent" />
                  <div>
                    <p className="font-black text-2xl tracking-tight">{child.name}</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{t.lastAnalysis}: 10:30 AM</p>
                  </div>
                </div>
                {child.psychProfile && (
                  <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-indigo-300 uppercase">{t.anxietyIndex}</span>
                      <span className="text-xs font-bold">{child.psychProfile.dominantEmotion}</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className={`h-full bg-indigo-500`} style={{ width: `${child.psychProfile.anxietyLevel}%` }}></div>
                    </div>
                  </div>
                )}
                <button onClick={() => navigate('/pulse')} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-sm font-black transition-all shadow-xl">{t.detailedReport}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickStat: React.FC<{ label: string, value: any, sub?: string, color: string }> = ({ label, value, sub, color }) => {
  const colors: any = {
    red: 'bg-red-50 text-red-600 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <div className={`p-6 rounded-[2rem] border ${colors[color]} shadow-sm`}>
      <p className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-70">{label}</p>
      <p className="text-2xl font-black">{value} <span className="text-[10px]">{sub}</span></p>
    </div>
  );
};

export default DashboardView;
