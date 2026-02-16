
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { Child, MonitoringAlert, ParentAccount, AlertSeverity, Category, UserRole, CustomMode, ProactiveDefenseConfig } from './types';
import DashboardView from './components/DashboardView';
import DevicesView from './components/DevicesView';
import AlertsView from './components/AlertsView';
import SimulatorView from './components/SimulatorView';
import VisualBenchmarkView from './components/VisualBenchmarkView';
import SystemSecurityReportView from './components/SystemSecurityReportView';
import SettingsView from './components/SettingsView';
import LiveMonitorView from './components/LiveMonitorView';
import EvidenceVaultView from './components/EvidenceVaultView';
import PsychologicalInsightView from './components/PsychologicalInsightView';
import MapView from './components/MapView';
import ModesView from './components/ModesView';
import ProactiveDefenseView from './components/ProactiveDefenseView';
import SystemStatusBar from './components/SystemStatusBar';
import NotificationToast from './components/NotificationToast';
import EmergencyOverlay from './components/EmergencyOverlay';
import AuthView from './components/AuthView';
import { ICONS, AmanahLogo, AdminShieldBadge, AmanahGlobalDefs, AmanahShield } from './constants';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { 
    syncParentProfile,
    updateMemberInDB,
    subscribeToChildren,
    subscribeToAlerts
} from './services/firestoreService';
import { translations } from './translations';
import { MY_DESIGNED_ASSETS, FALLBACK_ASSETS } from './assets';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<MonitoringAlert | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<MonitoringAlert | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  const processedAlertIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const [currentUser, setCurrentUser] = useState<ParentAccount>({
    id: 'guest', name: 'الوالد', role: 'ADMIN', avatar: MY_DESIGNED_ASSETS.ADMIN_AVATAR || FALLBACK_ASSETS.ADMIN
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [modes, setModes] = useState<CustomMode[]>([
    { id: 'm1', name: 'وقت المذاكرة', icon: '📚', color: 'bg-indigo-600', allowedApps: ['Educational'], allowedUrls: [], blacklistedUrls: ['tiktok.com'], cameraEnabled: false, micEnabled: true, isInternetCut: false, isScreenDimmed: false, isDeviceLocked: false, internetStartTime: '08:00', internetEndTime: '14:00', activeDays: [0, 1, 2, 3, 4] },
    { id: 'm2', name: 'وقت النوم', icon: '🌙', color: 'bg-slate-900', allowedApps: [], allowedUrls: [], blacklistedUrls: [], cameraEnabled: false, micEnabled: false, isInternetCut: true, isScreenDimmed: true, isDeviceLocked: true, internetStartTime: '21:00', internetEndTime: '07:00', activeDays: [0, 1, 2, 3, 4, 5, 6] }
  ]);

  const t = translations[lang];

  const menuItems = useMemo(() => [
    { path: '/', label: t.dashboard, icon: <ICONS.Dashboard /> },
    { path: '/alerts', label: t.alerts, icon: <ICONS.Shield /> },
    { path: '/defense', label: 'الحارس الشخصي', icon: <ICONS.Shield /> },
    { path: '/modes', label: t.modes, icon: <ICONS.Pulse /> },
    { path: '/vault', label: t.vault, icon: <ICONS.Vault /> },
    { path: '/pulse', label: t.pulse, icon: <ICONS.Pulse /> },
    { path: '/security-report', label: 'تقرير الأمان والأداء', icon: <div className="text-emerald-500 scale-125">🛡️</div> },
    { path: '/live', label: t.live, icon: <ICONS.LiveCamera /> },
    { path: '/map', label: t.map, icon: <ICONS.Location /> },
    { path: '/benchmark', label: 'مختبر الأداء', icon: <ICONS.Rocket /> },
    { path: '/devices', label: t.devices, icon: <ICONS.Devices /> },
    { path: '/simulator', label: t.simulator, icon: <ICONS.Rocket /> },
    { path: '/settings', label: t.settings, icon: <ICONS.Settings /> },
  ], [t]);

  const handleUpdateMember = async (id: string, role: UserRole, updates: any) => {
    try {
      await updateMemberInDB(id, role, updates);
    } catch (e) { console.error(e); }
  };

  const handleUpdateDefense = async (childId: string, config: ProactiveDefenseConfig) => {
    await handleUpdateMember(childId, 'CHILD', { defenseConfig: config });
    setActiveToast({ 
      id: 'def-' + Date.now(), childName: 'أمانة', platform: 'Amanah', content: 'Defense Updated', 
      category: Category.SAFE, severity: AlertSeverity.LOW, timestamp: new Date(), aiAnalysis: "تم تحديث بروتوكولات الحماية الاستباقية بنجاح." 
    } as any);
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setIsAuthChecking(true);
      if (user) {
        try {
            const { profile } = await syncParentProfile(user.uid, user.email, currentUser);
            setCurrentUser(profile);
            setIsAuthenticated(true);
        } catch (e) { console.error(e); }
      } else { 
          setIsAuthenticated(false); 
          setChildren([]); 
          setAlerts([]);
          processedAlertIds.current.clear();
          initialLoadDone.current = false;
      }
      setTimeout(() => setIsAuthChecking(false), 2000); 
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'guest') return;
    
    const unsubChildren = subscribeToChildren(currentUser.id, (data) => setChildren(data));
    const unsubAlerts = subscribeToAlerts(currentUser.id, (data) => {
      if (!initialLoadDone.current) {
        data.forEach(a => processedAlertIds.current.add(a.id));
        initialLoadDone.current = true;
        setAlerts(data);
        return;
      }
      const newAlertsFound = data.filter(a => !processedAlertIds.current.has(a.id));
      if (newAlertsFound.length > 0) {
        const latest = newAlertsFound[0];
        processedAlertIds.current.add(latest.id);
        if (latest.severity === AlertSeverity.CRITICAL) setEmergencyAlert(latest);
        else setActiveToast(latest);
      }
      setAlerts(data);
    });
    return () => { unsubChildren(); unsubAlerts(); };
  }, [isAuthenticated, currentUser.id]);

  if (isAuthChecking) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden" dir="rtl">
      <AmanahGlobalDefs />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#8A1538]/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="relative z-10 flex flex-col items-center animate-in fade-in duration-1000 scale-110">
        <div className="w-48 mb-12">
           <AmanahShield className="w-full h-auto" animate={true} />
        </div>
        <div className="text-center space-y-4">
           <h1 className="text-4xl font-black text-white tracking-tighter brand-font">أمانة • Amanah AI</h1>
           <div className="flex items-center gap-3 px-6 py-2.5 bg-white/5 rounded-full border border-white/10 shadow-2xl">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
              <p className="text-[11px] font-black text-indigo-300 uppercase tracking-[0.3em]">Establishing Secure Core...</p>
           </div>
        </div>
      </div>
    </div>
  );
  
  if (!isAuthenticated) return <AuthView onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo'] relative overflow-x-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <AmanahGlobalDefs />
      <SystemStatusBar hasCriticalAlert={alerts.some(a => a.severity === AlertSeverity.CRITICAL)} alertCount={alerts.length} />
      
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} lang={lang} menuItems={menuItems} />

      <header className="fixed top-7 left-0 right-0 h-20 px-6 flex items-center justify-between z-[150] bg-white/80 backdrop-blur-2xl border-b border-slate-100 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/settings')}>
             <div className="relative">
                <img src={currentUser.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-md object-cover transition-transform group-hover:scale-110" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6"><AdminShieldBadge /></div>
             </div>
             <div className="hidden sm:block text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Master Admin</p>
                <p className="text-xs font-black text-slate-800">{currentUser.name}</p>
             </div>
        </div>
        
        <div className="w-24 cursor-pointer transform hover:scale-105 transition-all duration-500" onClick={() => navigate('/')}>
           <AmanahLogo />
        </div>

        <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-slate-950 text-white rounded-2xl shadow-xl active:scale-90 hover:bg-[#8A1538] transition-all">
          <ICONS.Menu className="w-6 h-6" />
        </button>
      </header>

      <main className="pt-32 px-4 pb-48 max-w-7xl mx-auto min-h-screen relative z-10">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} lang={lang} parentId={currentUser.id} />} />
          <Route path="/defense" element={<ProactiveDefenseView children={children} lang={lang} onUpdateDefense={handleUpdateDefense} />} />
          <Route path="/devices" element={<DevicesView children={children} lang={lang} onUpdateDevice={(id, u) => handleUpdateMember(id, 'CHILD', u)} onToggleAppBlock={() => {}} />} />
          <Route path="/alerts" element={<AlertsView alerts={alerts} theme="light" lang={lang} />} />
          <Route path="/benchmark" element={<VisualBenchmarkView lang={lang} />} />
          <Route path="/security-report" element={<SystemSecurityReportView />} />
          <Route path="/modes" element={<ModesView modes={modes} children={children} onUpdateModes={setModes} onApplyMode={(c, m) => {}} />} />
          <Route path="/simulator" element={<SimulatorView children={children} parentId={currentUser.id} lang={lang} />} />
          <Route path="/live" element={<LiveMonitorView children={children} lang={lang} />} />
          <Route path="/vault" element={<EvidenceVaultView records={alerts as any} currentUser={currentUser} onRequestToast={(a) => setActiveToast(a)} />} />
          <Route path="/pulse" element={<PsychologicalInsightView theme="light" child={children[0]} onAcceptPlan={() => {}} />} />
          <Route path="/map" element={<MapView children={children} />} />
          <Route path="/settings" element={<SettingsView 
            currentUser={currentUser} children={children} lang={lang} 
            onUpdateMember={handleUpdateMember} onDeleteMember={() => Promise.resolve()} onAddChild={() => Promise.resolve()} 
            onAddSupervisor={() => Promise.resolve({} as any)} showSuccessToast={(m) => {}} 
          />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-100 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] z-[1000] pb-8 pt-3 flex justify-center gap-2 px-6 no-print">
           {menuItems.slice(0, 5).map((item) => (
             <NavLink key={item.path} to={item.path} icon={item.icon} label={item.label} />
           ))}
      </nav>

      {emergencyAlert && <EmergencyOverlay alert={emergencyAlert} onClose={() => setEmergencyAlert(null)} onAction={() => navigate('/vault')} />}
      {activeToast && <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />}
    </div>
  );
};

const NavLink: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all ${isActive ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-indigo-400'}`}>
      <div className={`w-6 h-6 ${isActive ? 'animate-bounce-subtle' : ''}`}>{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest text-center">{label}</span>
      {isActive && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1"></div>}
    </Link>
  );
};

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void, lang: 'ar' | 'en', menuItems: any[] }> = ({ isOpen, onClose, lang, menuItems }) => {
  const navigate = useNavigate();
  return (
    <>
      <div className={`fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[1200] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-85 bg-white z-[1210] shadow-2xl transition-transform duration-500 transform ${isOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')} flex flex-col p-8`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex justify-between items-center mb-10">
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-red-500 transition-all"><ICONS.Close /></button>
          <div className="w-24"><AmanahLogo /></div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); onClose(); }} className="w-full flex items-center gap-5 p-5 rounded-3xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all text-right font-black group">
              <span className="opacity-50 group-hover:opacity-100 transition-opacity">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="pt-8 border-t border-slate-100 mt-6">
           <button onClick={() => { logoutUser(); onClose(); }} className="w-full flex items-center gap-4 p-5 rounded-3xl bg-red-50 text-red-600 font-black hover:bg-red-100 transition-all">
              <span>🚪</span>
              <span className="text-sm">تسجيل الخروج</span>
           </button>
        </div>
      </div>
    </>
  );
};

export default App;
