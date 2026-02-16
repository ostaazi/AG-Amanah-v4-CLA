
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Child, MonitoringAlert, AlertSeverity, ActivityLog, Category } from '../types';
import { translations } from '../translations';
import { subscribeToActivities } from '../services/firestoreService';
import { ICONS, AmanahShield } from '../constants';

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
  const t = translations[lang];

  const pairingKey = useMemo(() => {
    if (!parentId || parentId === 'guest') return '----';
    const raw = parentId.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return `${raw.substring(0, 4)}-${raw.substring(Math.max(0, raw.length - 4))}`;
  }, [parentId]);

  useEffect(() => {
    if (!parentId || parentId === 'guest') return;
    const unsub = subscribeToActivities(parentId, (data) => {
        setActivities(data);
    });
    return () => unsub();
  }, [parentId]);

  const handleAlertClick = (id: string) => {
    navigate('/vault', { state: { openAlertId: id } });
  };

  return (
    <div className="space-y-12 pb-24 animate-in fade-in duration-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* 🔑 Pairing Card */}
      {children.length === 0 && (
        <div className="bg-gradient-to-r from-slate-950 via-[#8A1538] to-slate-900 rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D]/50 animate-pulse-subtle">
           <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[80px] -translate-y-20"></div>
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="text-right flex-1">
                 <div className="inline-block bg-[#D1A23D] text-black text-[10px] font-black px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest">Awaiting First Device</div>
                 <h3 className="text-4xl font-black mb-3 tracking-tighter leading-tight">جاهز لبدء حماية طفلك؟ 📡</h3>
                 <p className="text-indigo-100 font-bold text-lg opacity-80">أدخل الرمز أدناه في تطبيق الطفل لتبدأ الرقابة الفورية.</p>
              </div>
              <div className="bg-black/60 p-10 rounded-[3rem] border-4 border-white/10 flex flex-col items-center gap-3 shadow-inner backdrop-blur-md scale-110">
                 <span className="text-[11px] font-black text-[#D1A23D] uppercase tracking-[0.4em]">PAIRING TOKEN</span>
                 <code className="text-5xl font-mono font-black tracking-widest text-white">{pairingKey}</code>
              </div>
           </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-slate-950 rounded-[4rem] p-10 md:p-14 text-white relative overflow-hidden shadow-2xl border-b-[12px] border-[#8A1538]">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12 text-center lg:text-right">
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter brand-font">{t.systemActive}</h2>
            <p className="text-indigo-200 text-xl font-bold opacity-80 max-w-2xl">{t.monitoringMsg}</p>
          </div>
          <div className="flex flex-col items-center gap-4">
             <button 
                onClick={onTriggerDemo}
                className="bg-red-600 hover:bg-red-700 text-white px-12 py-6 rounded-[2.5rem] flex items-center gap-5 transition-all active:scale-95 group shadow-[0_25px_50px_rgba(220,38,38,0.4)] border-b-4 border-red-900"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl group-hover:animate-bounce">⚡</div>
                <span className="text-lg font-black tracking-tighter uppercase">{t.penetrationTest}</span>
              </button>
              <div className="flex items-center gap-2 px-5 py-2 bg-white/5 rounded-full border border-white/10">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">v1.0.8 GOLD STABLE</p>
              </div>
          </div>
        </div>
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-2">
        <div className="lg:col-span-8 space-y-12">
          {/* 📊 Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <QuickStat label={t.todaysAlerts} value={alerts.length} icon="🚨" color="red" />
            <QuickStat label={t.screenHours} value={children.length > 0 ? "4.2" : "0"} sub={t.hour} icon="📱" color="indigo" />
            <QuickStat label={t.blockedSites} value={children.length > 0 ? "12" : "0"} icon="🚫" color="amber" />
            <QuickStat label={t.linkStatus} value={children.length > 0 ? t.secure : "OFFLINE"} icon="📡" color="green" />
          </div>

          {/* 📜 Recent Activity */}
          <div className="bg-white rounded-[4rem] p-10 border border-slate-100 shadow-2xl min-h-[500px] relative overflow-hidden">
            <div className="flex justify-between items-center mb-12 relative z-10 px-2">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">السجل الأمني الحي</h3>
                <p className="text-sm font-bold text-slate-400">رصد وتحليل فوري لكافة النشاطات الرقمية.</p>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Active Stream</span>
                 </div>
              </div>
            </div>
            
            <div className="space-y-4 relative z-10">
              {alerts.length > 0 ? alerts.slice(0, 6).map(alert => (
                <div 
                  key={alert.id} 
                  onClick={() => handleAlertClick(alert.id)}
                  className="flex items-center gap-6 p-6 rounded-[3rem] bg-slate-50/50 border border-white hover:bg-white hover:shadow-2xl cursor-pointer transition-all group active:scale-[0.98] border-r-[10px] border-indigo-100 hover:border-indigo-600"
                >
                  <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center text-3xl shadow-lg transition-transform group-hover:scale-110 ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {alert.severity === AlertSeverity.CRITICAL ? '🚨' : '🛡️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-black text-slate-800 truncate leading-tight mb-1">{alert.category || 'تنبيه أمني'}</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                       <span className="text-indigo-600">{alert.platform}</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                       <span>{alert.childName}</span>
                    </p>
                  </div>
                  <div className="text-left flex flex-col items-end gap-2">
                     <div className={`px-5 py-2 rounded-full text-[10px] font-black shadow-sm ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border border-slate-100'}`}>
                        {alert.severity}
                     </div>
                     <p className="text-[9px] font-black text-slate-300 font-mono tracking-tighter">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'الآن'}
                     </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-32 flex flex-col items-center gap-8 opacity-30">
                  <div className="w-32 h-32 bg-slate-100 rounded-[3rem] flex items-center justify-center text-7xl shadow-inner animate-bounce-subtle">📡</div>
                  <div className="space-y-3">
                    <p className="font-black text-2xl text-slate-700">بانتظار رصد النشاط الأول</p>
                    <p className="font-bold text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">بمجرد ربط الأجهزة، ستظهر هنا كافة التنبيهات الأمنية والرسائل المشبوهة التي يتم حجبها.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 🧠 Psychological Pulse Sidebar */}
        <div className="lg:col-span-4 space-y-10">
          <div className="bg-slate-950 rounded-[4rem] p-10 shadow-2xl text-white relative overflow-hidden group min-h-[600px] border-b-[10px] border-[#D1A23D] sticky top-32">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(209,162,61,0.08)_0%,transparent_60%)]"></div>
            
            <div className="flex items-center gap-5 mb-10 relative z-10">
               <div className="w-14 h-14 bg-[#D1A23D]/10 rounded-2xl flex items-center justify-center text-3xl border border-[#D1A23D]/20 shadow-lg shadow-[#D1A23D]/5">🧠</div>
               <h3 className="text-3xl font-black tracking-tighter leading-none">نبض الأطفال</h3>
            </div>

            {children.length > 0 ? children.map(child => (
              <div key={child.id} className="space-y-8 relative z-10 mb-12 last:mb-0 bg-white/5 p-8 rounded-[3rem] border border-white/5 transition-all hover:bg-white/10 hover:border-white/10">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <img src={child.avatar} className="w-20 h-20 rounded-[2rem] object-cover shadow-2xl border-2 border-[#D1A23D]/40 p-1" />
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-slate-950 ${child.status === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-600'}`}></div>
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-2xl tracking-tight leading-none mb-2">{child.name}</p>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black text-[#D1A23D] uppercase tracking-widest">{child.deviceNickname || 'Sync Device'}</span>
                       <span className="text-white/20">|</span>
                       <span className="text-[10px] font-black text-white/50">{child.batteryLevel}% 🔋</span>
                    </div>
                  </div>
                </div>
                
                {child.psychProfile ? (
                  <div className="space-y-5">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[11px] font-black text-indigo-300 uppercase tracking-[0.2em]">{t.anxietyIndex}</span>
                      <span className="bg-indigo-600/30 text-indigo-300 px-3 py-1 rounded-lg text-[10px] font-black">{child.psychProfile.dominantEmotion}</span>
                    </div>
                    <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden p-1 border border-white/5 shadow-inner">
                      <div className={`h-full rounded-full transition-all duration-1000 ${child.psychProfile.anxietyLevel > 70 ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-indigo-500 shadow-[0_0_15px_#6366f1]'}`} style={{ width: `${child.psychProfile.anxietyLevel}%` }}></div>
                    </div>
                  </div>
                ) : (
                   <div className="py-4 text-center opacity-30 text-xs font-bold italic">جاري جمع البيانات النفسية...</div>
                )}
                
                <button 
                  onClick={() => navigate('/pulse')} 
                  className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
                >
                  {t.detailedReport}
                </button>
              </div>
            )) : (
              <div className="text-center py-24 flex flex-col items-center gap-8 opacity-40">
                 <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-6xl border border-white/10 shadow-inner">🔒</div>
                 <p className="font-bold text-sm text-indigo-100 leading-relaxed px-10">بانتظار ربط هاتف طفلك لتحليل النبض النفسي وحالة الاستقرار.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickStat: React.FC<{ label: string, value: any, sub?: string, icon: string, color: string }> = ({ label, value, sub, icon, color }) => {
  const colors: any = {
    red: 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
  };
  return (
    <div className={`p-8 rounded-[3rem] border-2 ${colors[color]} shadow-xl transition-all hover:scale-[1.05] flex flex-col items-center text-center gap-4 group cursor-default`}>
      <span className="text-4xl group-hover:scale-125 transition-transform duration-500">{icon}</span>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70 leading-none">{label}</p>
        <p className="text-3xl font-black tracking-tighter leading-none">{value} <span className="text-sm">{sub}</span></p>
      </div>
    </div>
  );
};

export default DashboardView;
