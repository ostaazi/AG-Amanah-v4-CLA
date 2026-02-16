
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import DeveloperResolutionHub from './components/DeveloperResolutionHub';
import { ICONS, AmanahLogo, AdminShieldBadge, AmanahGlobalDefs, AmanahShield } from './constants';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { 
    syncParentProfile,
    updateMemberInDB,
    subscribeToChildren,
    subscribeToAlerts,
    subscribeToSystemPatches
} from './services/firestoreService';
import { updateCloudSecurityState } from './services/cryptoService';
import { setAuditCache } from './services/auditService';
import { translations } from './translations';
import { MY_DESIGNED_ASSETS, FALLBACK_ASSETS } from './assets';

const NavLinkMemo = React.memo(({ to, icon, label, isActive }: { to: string, icon: React.ReactNode, label: string, isActive: boolean }) => (
  <Link 
    to={to} 
    className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 p-2 min-w-[72px] transition-all duration-200 transform-gpu ${isActive ? 'text-[#8A1538] scale-105' : 'text-slate-400 active:scale-90 opacity-60'}`}
    style={{ contain: 'layout style' }}
  >
    <div className={`w-6 h-6 flex items-center justify-center ${isActive ? 'drop-shadow-md' : ''}`}>
      {icon}
    </div>
    <span className="text-[8px] font-black uppercase tracking-tighter text-center whitespace-nowrap">
      {label}
    </span>
    {isActive && <div className="w-1.5 h-1.5 bg-[#8A1538] rounded-full mt-0.5 shadow-sm animate-in zoom-in"></div>}
  </Link>
));

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang] = useState<'ar' | 'en'>('ar');
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
    { path: '/dev-hub', label: 'مركز المطور', icon: <div className="text-xl">🛠️</div> },
    { path: '/alerts', label: t.alerts, icon: <ICONS.Shield /> },
    { path: '/defense', label: 'الحارس', icon: <ICONS.Shield /> },
    { path: '/modes', label: t.modes, icon: <ICONS.Pulse /> },
    { path: '/vault', label: t.vault, icon: <ICONS.Vault /> },
    { path: '/pulse', label: t.pulse, icon: <ICONS.Pulse /> },
    { path: '/security-report', label: 'التقرير الأمني', icon: <span className="text-sm">🛡️</span> },
    { path: '/live', label: t.live, icon: <ICONS.LiveCamera /> },
    { path: '/map', label: t.map, icon: <ICONS.Location /> },
    { path: '/benchmark', label: 'الأداء', icon: <ICONS.Rocket /> },
    { path: '/devices', label: t.devices, icon: <ICONS.Devices /> },
    { path: '/simulator', label: 'المحاكي', icon: <ICONS.Rocket /> },
    { path: '/settings', label: t.settings, icon: <ICONS.Settings /> },
  ], [t]);

  const handleUpdateMember = useCallback(async (id: string, role: UserRole, updates: any) => {
    try {
      await updateMemberInDB(id, role, updates);
    } catch (e) { console.error(e); }
  }, []);

  const handleUpdateDefense = useCallback(async (childId: string, config: ProactiveDefenseConfig) => {
    await handleUpdateMember(childId, 'CHILD', { defenseConfig: config });
    setActiveToast({ 
      id: 'def-' + Date.now(), childName: 'أمانة', platform: 'Amanah', content: 'Defense Updated', 
      category: Category.SAFE, severity: AlertSeverity.LOW, timestamp: new Date(), aiAnalysis: "تم تحديث بروتوكولات الحماية الاستباقية بنجاح." 
    } as any);
  }, [handleUpdateMember]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setIsAuthChecking(true);
      if (user) {
        try {
            const { profile } = await syncParentProfile(user.uid, user.email, currentUser);
            setCurrentUser(profile);
            setIsAuthenticated(true);
            
            // الاشتراك في حالة الأمان السحابية فور تسجيل الدخول
            subscribeToSystemPatches(user.uid, (patchedIds) => {
                updateCloudSecurityState(patchedIds);
                setAuditCache(patchedIds);
                console.log("[App Kernel] Security Patches Synced from Cloud:", patchedIds);
            });

        } catch (e) { console.error(e); }
      } else { 
          setIsAuthenticated(false); 
          setChildren([]); 
          setAlerts([]);
          processedAlertIds.current.clear();
          initialLoadDone.current = false;
      }
      setTimeout(() => setIsAuthChecking(false), 600); 
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#8A1538]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-700">
        <div className="w-40 mb-10">
           <AmanahShield className="w-full h-auto animate-shield-breathing" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter brand-font">أمانة • Amanah AI</h1>
      </div>
    </div>
  );
  
  if (!isAuthenticated) return <AuthView onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo'] relative overflow-x-hidden selection:bg-[#8A1538] selection:text-white" dir="rtl">
      <AmanahGlobalDefs />
      <SystemStatusBar hasCriticalAlert={alerts.some(a => a.severity === AlertSeverity.CRITICAL)} alertCount={alerts.length} />
      
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} lang={lang} menuItems={menuItems} />

      <header className="fixed top-7 left-0 right-0 h-20 px-6 flex items-center justify-between z-[150] bg-white/90 backdrop-blur-3xl border-b border-slate-100 shadow-sm transition-all duration-300 transform-gpu">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/settings')}>
             <div className="relative transform-gpu transition-transform active:scale-95">
                <img src={currentUser.avatar} className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover" loading="lazy" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6"><AdminShieldBadge /></div>
             </div>
             <div className="hidden md:block text-right">
                <p className="text-[10px] font-black text-slate-800 leading-none">{currentUser.name}</p>
             </div>
        </div>
        <div className="w-20 cursor-pointer transform transition-transform hover:scale-105 duration-300" onClick={() => navigate('/')}>
           <AmanahLogo />
        </div>
        <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-slate-950 text-white rounded-2xl shadow-xl active:scale-90 hover:bg-[#8A1538] transition-all transform-gpu">
          <ICONS.Menu className="w-6 h-6" />
        </button>
      </header>

      <main className="pt-32 px-4 pb-44 max-w-7xl mx-auto min-h-screen relative z-10" style={{ contain: 'layout' }}>
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} lang={lang} parentId={currentUser.id} />} />
          <Route path="/dev-hub" element={<DeveloperResolutionHub currentUser={currentUser} onShowToast={(m, t) => setActiveToast({ id: 'dev-'+Date.now(), childName: 'النظام', aiAnalysis: m, category: t === 'SUCCESS' ? Category.SAFE : Category.VIOLENCE } as any)} />} />
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

      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-100 shadow-[0_-15px_40px_rgba(0,0,0,0.04)] z-[1000] pb-8 pt-3 no-print transform-gpu">
           <div className="flex overflow-x-auto no-scrollbar gap-1 px-4 items-center justify-start sm:justify-center min-w-full">
              {menuItems.map((item) => (
                <NavLinkMemo 
                  key={item.path} 
                  to={item.path} 
                  icon={item.icon} 
                  label={item.label} 
                  isActive={location.pathname === item.path} 
                />
              ))}
           </div>
      </nav>

      {emergencyAlert && <EmergencyOverlay alert={emergencyAlert} onClose={() => setEmergencyAlert(null)} onAction={() => navigate('/vault')} />}
      {activeToast && <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />}
    </div>
  );
};

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void, lang: 'ar' | 'en', menuItems: any[] }> = ({ isOpen, onClose, lang, menuItems }) => {
  const navigate = useNavigate();
  return (
    <>
      <div className={`fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[1200] transition-opacity duration-300 transform-gpu ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-72 bg-white z-[1210] shadow-2xl transition-transform duration-300 transform transform-gpu ${isOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')} flex flex-col p-8`} dir="rtl">
        <div className="flex justify-between items-center mb-8">
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-all"><ICONS.Close /></button>
          <div className="w-20"><AmanahLogo /></div>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar" style={{ contain: 'layout' }}>
          {menuItems.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 text-slate-600 hover:text-[#8A1538] transition-all text-right font-black group transform-gpu">
              <span className="opacity-40 group-hover:opacity-100">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="pt-6 border-t border-slate-100 mt-4">
           <button onClick={() => { logoutUser(); onClose(); }} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 font-black hover:bg-red-100 transition-all transform-gpu">
              <span>🚪</span>
              <span className="text-xs">خروج آمن</span>
           </button>
        </div>
      </div>
    </>
  );
};

export default App;
