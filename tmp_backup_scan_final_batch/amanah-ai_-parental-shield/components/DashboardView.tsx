
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Child, MonitoringAlert, AlertSeverity } from '../types';
import { translations } from '../translations';
import { ICONS } from '../constants';

interface DashboardViewProps {
  children: Child[];
  alerts: MonitoringAlert[];
  onTriggerDemo: () => void;
  lang: 'ar' | 'en';
}

const DashboardView: React.FC<DashboardViewProps> = ({ children, alerts, onTriggerDemo, lang }) => {
  const navigate = useNavigate();
  const t = translations[lang];
  const recentAlerts = alerts.slice(0, 5);

  const calculateSafetyScore = () => {
    if (alerts.length === 0) return 100;
    const critical = alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length;
    const high = alerts.filter(a => a.severity === AlertSeverity.HIGH).length;
    let score = 100 - (critical * 20) - (high * 10);
    return Math.max(0, score);
  };

  const score = calculateSafetyScore();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      
      {/* Safety Score - Professional Style */}
      <div className="bg-slate-950 rounded-[3.5rem] p-10 text-white relative overflow-hidden shadow-2xl group border border-white/5">
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
           <div className="absolute top-[-50%] right-[-20%] w-[100%] h-[200%] bg-[radial-gradient(circle,rgba(79,70,229,0.2)_0%,transparent_70%)] animate-pulse"></div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="relative w-44 h-44 flex-shrink-0">
             <div className="absolute inset-0 rounded-full border-[12px] border-white/5"></div>
             <div className={`absolute inset-0 rounded-full border-[12px] transition-all duration-1000 ${score > 70 ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : score > 40 ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]'}`} 
                  style={{ clipPath: `conic-gradient(black ${score}%, transparent 0)` }}></div>
             
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black">{score}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">System Index</span>
             </div>
          </div>

          <div className="text-center md:text-right flex-1 space-y-4">
             <div>
                <h2 className="text-4xl font-black tracking-tighter mb-2">{t.systemActive}</h2>
                <p className="text-slate-400 font-bold text-sm max-w-lg leading-relaxed">
                   {lang === 'ar' 
                     ? `تم تحليل ${alerts.length} واقعة رقمية خلال الـ 24 ساعة الماضية. النظام يعمل بكامل طاقته التشغيلية.`
                     : `Analyzed ${alerts.length} digital events in the last 24 hours. The system is operating at full functional capacity.`}
                </p>
             </div>
             
             <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <button onClick={() => navigate('/advisor')} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xl shadow-indigo-900/20">
                   <ICONS.Chat /> {t.advisor}
                </button>
                <button onClick={onTriggerDemo} className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2">
                   <ICONS.Rocket /> {t.penetrationTest}
                </button>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Stats Area */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickStat label={t.todaysAlerts} value={alerts.length} color="red" icon={<ICONS.Alert />} />
            <QuickStat label={t.screenHours} value="3.5" sub={t.hour} color="indigo" icon={<ICONS.Clock />} />
            <QuickStat label={t.blockedSites} value="8" color="amber" icon={<ICONS.Block />} />
            <QuickStat label={t.linkStatus} value={t.secure} color="green" icon={<ICONS.Shield />} />
          </div>

          <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-8 px-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{t.recentActivity}</h3>
              <Link to="/alerts" className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline">{t.fullLog}</Link>
            </div>
            
            <div className="space-y-4">
              {recentAlerts.length > 0 ? recentAlerts.map(alert => (
                <div key={alert.id} className="flex items-center gap-5 p-5 rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all group cursor-pointer shadow-sm hover:shadow-md">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl shadow-inner ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {alert.severity === AlertSeverity.CRITICAL ? <ICONS.Alert /> : <ICONS.Shield />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-slate-800 truncate">{alert.category}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                       <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{alert.platform}</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                       <span className="text-[10px] text-indigo-50 font-black bg-indigo-500 px-2 rounded-md">{alert.childName}</span>
                    </div>
                  </div>
                  <div className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-white border border-slate-200 text-slate-600'}`}>
                    {alert.severity}
                  </div>
                </div>
              )) : (
                <div className="text-center py-20">
                   <div className="text-5xl mb-4 opacity-20 flex justify-center"><ICONS.Shield /></div>
                   <p className="text-slate-400 font-bold italic">{t.noAlerts}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Child Pulse Card */}
        <div className="lg:col-span-4 h-full">
          <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl text-white h-full flex flex-col justify-between border border-white/5">
            <div className="space-y-10">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-indigo-900/40"><ICONS.Activity /></div>
                 <div>
                    <h3 className="text-2xl font-black tracking-tighter">{t.psychPulse}</h3>
                    <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Behavioral Intelligence</p>
                 </div>
              </div>

              {children.map(child => (
                <div key={child.id} className="space-y-8 animate-in fade-in slide-in-from-right-4">
                  <div className="flex items-center gap-5">
                    <img src={child.avatar} className="w-20 h-20 rounded-[2rem] border-4 border-white/10 shadow-2xl object-cover" />
                    <div>
                      <p className="font-black text-2xl">{child.name}</p>
                      <div className="flex items-center gap-2 text-emerald-400 mt-1">
                         <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                         <p className="text-[10px] font-black uppercase tracking-widest">{child.status}</p>
                      </div>
                    </div>
                  </div>

                  {child.psychProfile && (
                    <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 space-y-6">
                      <div className="flex justify-between items-end">
                        <div>
                           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">{t.anxietyIndex}</span>
                           <span className="text-xl font-black text-white">{child.psychProfile.dominantEmotion || 'Stable'}</span>
                        </div>
                        <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Normal Range</span>
                      </div>
                      <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5">
                        <div className={`h-full rounded-full transition-all duration-[2s] ease-out ${child.psychProfile.anxietyLevel > 60 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`} 
                             style={{ width: `${child.psychProfile.anxietyLevel}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/pulse')} className="w-full mt-10 py-6 bg-white text-slate-900 hover:bg-indigo-50 rounded-[2rem] font-black text-sm transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3">
               <ICONS.Activity /> {t.detailedReport}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickStat: React.FC<{ label: string, value: any, sub?: string, color: string, icon: React.ReactNode }> = ({ label, value, sub, color, icon }) => {
  const colors: any = {
    red: 'bg-red-50 text-red-600 border-red-100 shadow-red-100/50',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100/50',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/50',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50',
  };
  return (
    <div className={`p-6 rounded-[2.5rem] border ${colors[color]} shadow-xl flex flex-col items-center justify-center text-center group hover:scale-105 transition-all cursor-default`}>
      <span className="w-6 h-6 mb-2 opacity-60 group-hover:opacity-100 transition-all">{icon}</span>
      <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 opacity-70">{label}</p>
      <p className="text-2xl font-black tracking-tighter">{value} <span className="text-[10px] font-bold">{sub}</span></p>
    </div>
  );
};

export default DashboardView;
