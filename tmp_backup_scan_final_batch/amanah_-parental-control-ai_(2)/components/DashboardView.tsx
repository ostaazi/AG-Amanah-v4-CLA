
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Child, MonitoringAlert, AlertSeverity, Category } from '../types';
import { translations } from '../translations';

interface DashboardViewProps {
  children: Child[];
  alerts: MonitoringAlert[];
  onTriggerDemo: () => void;
  lang: 'ar' | 'en';
}

const DashboardView: React.FC<DashboardViewProps> = ({ children, alerts, onTriggerDemo, lang }) => {
  const navigate = useNavigate();
  const criticalAlerts = alerts.filter(a => a.severity === AlertSeverity.CRITICAL || a.severity === AlertSeverity.HIGH);
  const recentAlerts = alerts.slice(0, 4);
  const t = translations[lang];

  const appUsageData = children[0]?.appUsage.map(app => ({
    name: app.appName,
    value: app.minutesUsed
  })) || [];

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const getPulseColor = (anxiety: number) => {
    if (anxiety > 70) return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
    if (anxiety > 40) return 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]';
    return 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column: Alerts & Apps */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat label={t.todaysAlerts} value={alerts.length} color="red" />
            <QuickStat label={t.screenHours} value="4.2" sub={t.hour} color="indigo" />
            <QuickStat label={t.blockedSites} value="12" color="amber" />
            <QuickStat label={t.linkStatus} value={t.secure} color="green" />
          </div>

          {/* Recent Alerts Card */}
          <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[4rem] border border-white shadow-xl">
            <div className="flex justify-between items-center mb-8 px-4">
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{t.recentActivity}</h3>
              <Link to="/alerts" className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline">{t.fullLog}</Link>
            </div>
            
            <div className="space-y-3">
              {recentAlerts.length > 0 ? recentAlerts.map(alert => (
                <div key={alert.id} className="flex items-center gap-4 p-4 rounded-[2rem] bg-slate-50/50 border border-white hover:bg-white hover:shadow-md transition-all group">
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

          {/* Screen Time Analytics */}
          <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[4rem] border border-white shadow-xl">
            <h3 className="text-2xl font-black text-slate-800 mb-8 px-4 tracking-tighter">{t.screenTimeDist}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={appUsageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {appUsageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-800">100%</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.monitored}</span>
                </div>
              </div>
              <div className="space-y-4">
                {appUsageData.map((app, idx) => (
                  <div key={app.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-sm font-black text-slate-700">{app.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{app.value} {t.minute}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pulse & Controls */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* Emotional Pulse */}
          <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl text-white relative overflow-hidden group">
            <h3 className="text-2xl font-black mb-8 relative z-10 tracking-tighter">{t.psychPulse}</h3>
            {children.map(child => (
              <div key={child.id} className="space-y-6 relative z-10">
                <div className="flex items-center gap-4">
                  <img src={child.avatar} className="w-16 h-16 rounded-[1.5rem] border-2 border-white/20 shadow-xl" />
                  <div>
                    <p className="font-black text-xl">{child.name}</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{t.lastAnalysis}: 10:30 AM</p>
                  </div>
                </div>
                {child.psychProfile && (
                  <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-indigo-300 uppercase">{t.anxietyIndex}</span>
                      <span className="text-xs font-bold">{child.psychProfile.dominantEmotion}</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${getPulseColor(child.psychProfile.anxietyLevel)}`} style={{ width: `${child.psychProfile.anxietyLevel}%` }}></div>
                    </div>
                  </div>
                )}
                <button onClick={() => navigate('/pulse')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-xs font-black transition-all shadow-xl">{t.detailedReport}</button>
              </div>
            ))}
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-4">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest px-2">{t.quickActions}</h4>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction icon="🔒" label={t.lockDevices} onClick={() => {}} color="bg-slate-900" />
              <QuickAction icon="📍" label={t.requestLocation} onClick={() => navigate('/map')} color="bg-indigo-600" />
              <QuickAction icon="📶" label={t.cutInternet} onClick={() => {}} color="bg-red-600" />
              <QuickAction icon="🌙" label={t.sleepMode} onClick={() => navigate('/modes')} color="bg-amber-600" />
            </div>
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

const QuickAction: React.FC<{ icon: string, label: string, onClick: () => void, color: string }> = ({ icon, label, onClick, color }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center p-5 rounded-[2rem] text-white shadow-lg active:scale-90 transition-all ${color}`}>
    <span className="text-2xl mb-1">{icon}</span>
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default DashboardView;
