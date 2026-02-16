
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const t = translations[lang];

  // توليد مفتاح الربط للعرض السريع
  const pairingKey = useMemo(() => {
    if (!parentId || parentId === 'guest') return '----';
    const raw = parentId.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return `${raw.substring(0, 4)}-${raw.substring(raw.length - 4)}`;
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
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      
      {/* 🔑 بطاقة الربط السريع */}
      {children.length === 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-[#8A1538] rounded-[3rem] p-10 text-white shadow-2xl border-b-8 border-amber-500/50 flex flex-col md:flex-row items-center justify-between gap-8 animate-bounce-subtle">
           <div className="text-right flex-1">
              <h3 className="text-3xl font-black mb-2">بانتظار ربط هاتفك الأول 📡</h3>
              <p className="text-slate-300 font-bold text-sm">أدخل هذا الرمز في تطبيق طفلك لتبدأ الرقابة الحقيقية فوراً.</p>
           </div>
           <div className="bg-black/40 p-6 rounded-3xl border border-white/20 flex flex-col items-center gap-2">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pairing Key</span>
              <code className="text-4xl font-mono font-black tracking-widest">{pairingKey}</code>
           </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-slate-900 rounded-[3.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl border-b-4 border-[#8A1538]">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10 text-center lg:text-right">
          <div>
            <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">{t.systemActive}</h2>
            <p className="text-indigo-200 text-lg font-bold opacity-80 max-w-xl">{t.monitoringMsg}</p>
          </div>
          <div className="flex flex-col gap-2">
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
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">نسخة مستقرة v1.0 GOLD</p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-20 -translate-y-20"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat label={t.todaysAlerts} value={alerts.length} color="red" />
            <QuickStat label={t.screenHours} value={children.length > 0 ? "4.2" : "0"} sub={t.hour} color="indigo" />
            <QuickStat label={t.blockedSites} value={children.length > 0 ? "12" : "0"} color="amber" />
            <QuickStat label={t.linkStatus} value={children.length > 0 ? t.secure : "غير مربوط"} color="green" />
          </div>

          {/* Recent Activity Section */}
          <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[4rem] border border-white shadow-xl min-h-[400px]">
            <div className="flex justify-between items-center mb-8 px-4">
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{t.recentActivity}</h3>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] font-black uppercase">Live Sync</span>
                 </div>
                 <Link to="/alerts" className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline">{t.fullLog}</Link>
              </div>
            </div>
            
            <div className="space-y-3">
              {alerts.length > 0 ? alerts.slice(0, 5).map(alert => (
                <div 
                  key={alert.id} 
                  onClick={() => handleAlertClick(alert.id)}
                  className="flex items-center gap-4 p-5 rounded-[2.5rem] bg-slate-50/50 border border-white hover:bg-white hover:shadow-md cursor-pointer transition-all group active:scale-[0.98] border-r-8 border-indigo-100"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    <span className="text-2xl">{alert.severity === AlertSeverity.CRITICAL ? '🚨' : '🛡️'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{alert.category || 'تنبيه أمني'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                      {alert.platform || 'نظام أمان'} • {alert.childName || 'جهاز طفلك'}
                    </p>
                  </div>
                  <div className="text-left flex flex-col items-end">
                     <div className={`px-4 py-1.5 rounded-full text-[9px] font-black mb-1 ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {alert.severity || 'LOW'}
                     </div>
                     <p className="text-[8px] font-black text-slate-300 font-mono">
                        {alert.timestamp ? (typeof alert.timestamp === 'string' ? new Date(alert.timestamp).toLocaleTimeString() : (alert.timestamp as any).toLocaleTimeString()) : 'الآن'}
                     </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-24 flex flex-col items-center gap-6 opacity-40">
                  <div className="text-8xl">📡</div>
                  <div className="space-y-2">
                    <p className="font-black text-xl text-slate-600">لا توجد أنشطة مرصودة بعد</p>
                    <p className="font-bold text-slate-400 text-sm max-w-xs mx-auto">تأكد من ربط تطبيق الطفل وتفعيل صلاحيات "Accessibility" للبدء بالرصد.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-10">
          <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl text-white relative overflow-hidden group min-h-[500px] border-b-8 border-[#D1A23D]">
            <h3 className="text-2xl font-black mb-8 relative z-10 tracking-tighter">{t.psychPulse}</h3>
            {children.length > 0 ? children.map(child => (
              <div key={child.id} className="space-y-6 relative z-10 mb-10 last:mb-0">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <img src={child.avatar} className="w-16 h-16 rounded-full object-cover shadow-lg border-2 border-white/20" />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-slate-900 ${child.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                  </div>
                  <div>
                    <p className="font-black text-xl tracking-tight leading-none mb-1">{child.name}</p>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">البطارية: {child.batteryLevel}%</p>
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
            )) : (
              <div className="text-center py-20 flex flex-col items-center gap-6 opacity-40">
                 <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-5xl border border-white/10 shadow-inner">🔒</div>
                 <p className="font-bold text-xs text-indigo-200 leading-relaxed">بانتظار ربط هاتف طفلك لتحليل النبض النفسي وحالة الاستقرار.</p>
              </div>
            )}
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
    <div className={`p-6 rounded-[2.5rem] border ${colors[color]} shadow-sm transition-all hover:shadow-md hover:scale-[1.02]`}>
      <p className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-70">{label}</p>
      <p className="text-2xl font-black tracking-tighter">{value} <span className="text-[10px]">{sub}</span></p>
    </div>
  );
};

export default DashboardView;
