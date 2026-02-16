
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Child, MonitoringAlert, ParentAccount, AlertSeverity, Category, UserRole, FamilyMember, CustomMode } from './types';
import DashboardView from './components/DashboardView';
import DevicesView from './components/DevicesView';
import AlertsView from './components/AlertsView';
import SimulatorView from './components/SimulatorView';
import SettingsView from './components/SettingsView';
import LiveMonitorView from './components/LiveMonitorView';
import EvidenceVaultView from './components/EvidenceVaultView';
import PsychologicalInsightView from './components/PsychologicalInsightView';
import MapView from './components/MapView';
import ModesView from './components/ModesView';
import SystemStatusBar from './components/SystemStatusBar';
import NotificationToast from './components/NotificationToast';
import EmergencyOverlay from './components/EmergencyOverlay';
import AuthView from './components/AuthView';
import { ICONS, AmanahLogo, AdminShieldBadge, AmanahGlobalDefs } from './constants';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { 
    syncParentProfile,
    updateMemberInDB,
    deleteMemberFromDB,
    addChildToDB,
    subscribeToChildren,
    subscribeToAlerts,
    logUserActivity,
    inviteSupervisor,
    updatePairingKeyInDB
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

  const menuItems = [
    { path: '/', label: t.dashboard, icon: <ICONS.Dashboard /> },
    { path: '/alerts', label: t.alerts, icon: <ICONS.Shield /> },
    { path: '/modes', label: t.modes, icon: <ICONS.Pulse /> },
    { path: '/vault', label: t.vault, icon: <ICONS.Vault /> },
    { path: '/pulse', label: t.pulse, icon: <ICONS.Pulse /> },
    { path: '/live', label: t.live, icon: <ICONS.LiveCamera /> },
    { path: '/map', label: t.map, icon: <ICONS.Location /> },
    { path: '/devices', label: t.devices, icon: <ICONS.Devices /> },
    { path: '/simulator', label: t.simulator, icon: <ICONS.Rocket /> },
    { path: '/settings', label: t.settings, icon: <ICONS.Settings /> },
  ];

  const handleUpdateMember = async (id: string, role: UserRole, updates: any) => {
    try {
      await updateMemberInDB(id, role, updates);
      logUserActivity(currentUser.id, {
        action: "تحديث بيانات",
        details: `تم تحديث إعدادات ${role} بنجاح`,
        type: 'SUCCESS'
      });
    } catch (e) { console.error(e); }
  };

  const handleDeleteMember = async (id: string, role: UserRole) => {
    try {
      await deleteMemberFromDB(id, role);
    } catch (e) { console.error(e); }
  };

  const handleAddChild = async (data: Partial<Child>) => {
    try {
      await addChildToDB(currentUser.id, data);
    } catch (e) { console.error(e); }
  };

  const handleAddSupervisor = async (data: any): Promise<FamilyMember> => {
    return await inviteSupervisor(currentUser.id, data);
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setIsAuthChecking(true);
      if (user) {
        try {
            const { profile } = await syncParentProfile(user.uid, user.email, currentUser);
            setCurrentUser(profile);
            setIsAuthenticated(true);
            
            // توليد وحفظ مفتاح الربط في السحابة
            const raw = user.uid.replace(/[^A-Z0-9]/gi, '').toUpperCase();
            const key = raw.substring(0, 4) + "-" + raw.substring(raw.length - 4);
            await updatePairingKeyInDB(user.uid, key);
            
        } catch (e) { console.error(e); }
      } else { 
          setIsAuthenticated(false); 
          setChildren([]); 
          setAlerts([]);
      }
      setTimeout(() => setIsAuthChecking(false), 2000);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'guest') return;
    const unsubChildren = subscribeToChildren(currentUser.id, (data) => setChildren(data));
    const unsubAlerts = subscribeToAlerts(currentUser.id, (data) => {
      if (data.length > alerts.length) {
        const latest = data[0];
        if (latest.severity === AlertSeverity.CRITICAL) setEmergencyAlert(latest);
        else setActiveToast(latest);
      }
      setAlerts(data);
    });
    return () => { unsubChildren(); unsubAlerts(); };
  }, [isAuthenticated, currentUser.id, alerts.length]);

  if (isAuthChecking) return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <div className="w-40 animate-pulse"><AmanahLogo /></div>
    </div>
  );
  
  if (!isAuthenticated) return <AuthView onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo'] relative overflow-x-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <AmanahGlobalDefs />
      <SystemStatusBar hasCriticalAlert={alerts.some(a => a.severity === AlertSeverity.CRITICAL)} alertCount={alerts.length} />
      
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} lang={lang} menuItems={menuItems} />

      <header className="fixed top-8 left-0 right-0 h-20 px-6 flex items-center justify-between z-[150] bg-white/80 backdrop-blur-2xl border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/settings')}>
             <div className="relative">
                <img src={currentUser.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-md object-cover" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6"><AdminShieldBadge /></div>
             </div>
             <div className="hidden sm:block">
                <p className="text-[9px] font-black text-slate-400">المدير</p>
                <p className="text-xs font-black text-slate-800">{currentUser.name}</p>
             </div>
        </div>
        
        <div className="w-20 cursor-pointer" onClick={() => navigate('/')}>
           <AmanahLogo />
        </div>

        <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-90 hover:bg-indigo-600 transition-all">
          <ICONS.Menu className="w-6 h-6" />
        </button>
      </header>

      <main className="pt-40 px-4 pb-48 max-w-7xl mx-auto min-h-screen">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} lang={lang} parentId={currentUser.id} />} />
          <Route path="/devices" element={<DevicesView children={children} lang={lang} onUpdateDevice={(id, u) => handleUpdateMember(id, 'CHILD', u)} onToggleAppBlock={() => {}} />} />
          <Route path="/alerts" element={<AlertsView alerts={alerts} theme="light" lang={lang} />} />
          <Route path="/modes" element={<ModesView modes={modes} children={children} onUpdateModes={setModes} onApplyMode={(c, m) => {}} />} />
          <Route path="/simulator" element={<SimulatorView children={children} parentId={currentUser.id} lang={lang} />} />
          <Route path="/live" element={<LiveMonitorView children={children} lang={lang} />} />
          <Route path="/vault" element={<EvidenceVaultView records={alerts as any} currentUser={currentUser} onRequestToast={(a) => setActiveToast(a)} />} />
          <Route path="/pulse" element={<PsychologicalInsightView theme="light" child={children[0]} onAcceptPlan={() => {}} />} />
          <Route path="/map" element={<MapView children={children} />} />
          <Route path="/settings" element={<SettingsView 
            currentUser={currentUser} 
            children={children} 
            lang={lang} 
            onUpdateMember={handleUpdateMember} 
            onDeleteMember={handleDeleteMember} 
            onAddChild={handleAddChild} 
            onAddSupervisor={handleAddSupervisor} 
            showSuccessToast={(m) => setActiveToast({ 
                id: 'sys-' + Date.now(), childName: 'System', platform: 'Amanah', content: m, category: Category.SAFE, severity: AlertSeverity.LOW, timestamp: new Date(), aiAnalysis: m 
            })} 
          />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-100 shadow-2xl z-[9999] pb-4 pt-2 flex justify-center gap-2 px-6">
           {menuItems.slice(0, 5).map((item) => (
             <NavLink key={item.path} to={item.path} icon={item.icon} label={item.label} />
           ))}
      </nav>

      {emergencyAlert && <EmergencyOverlay alert={emergencyAlert} onClose={() => setEmergencyAlert(null)} onAction={() => navigate('/vault')} />}
      {activeToast && <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />}
    </div>
  );
};

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void, lang: 'ar' | 'en', menuItems: any[] }> = ({ isOpen, onClose, lang, menuItems }) => {
  const navigate = useNavigate();
  return (
    <div className={`fixed inset-0 z-[6000] transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className={`absolute top-0 bottom-0 w-80 bg-white shadow-2xl transition-transform duration-500 flex flex-col ${lang === 'ar' ? (isOpen ? 'right-0' : 'right-[-100%]') : (isOpen ? 'left-0' : 'left-[-100%]')}`}>
        <div className="p-10 pb-6 border-b border-slate-50 flex justify-between items-center">
          <div className="w-24"><AmanahLogo /></div>
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 hover:rotate-90 transition-all"><ICONS.Close /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2">
          {menuItems.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); onClose(); }} className="w-full flex items-center gap-6 p-5 rounded-[2rem] hover:bg-indigo-50 transition-all text-right group active:scale-95">
              <div className="text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all">{item.icon}</div>
              <span className="font-black text-slate-700 group-hover:text-indigo-600">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="p-8 border-t border-slate-50 bg-slate-50/50">
           <button onClick={() => { logoutUser(); onClose(); }} className="w-full py-5 bg-white text-red-600 rounded-3xl font-black text-sm uppercase tracking-widest border border-red-50 flex items-center justify-center gap-3 shadow-sm hover:bg-red-50 transition-all">
             🗑️ تسجيل الخروج
           </button>
        </div>
      </div>
    </div>
  );
};

const NavLink: React.FC<{ to: string, icon: any, label: string }> = ({ to, icon, label }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <button onClick={() => navigate(to)} className={`flex flex-col items-center justify-center min-w-[65px] p-2 rounded-2xl transition-all ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform`}>{icon}</div>
      <span className={`text-[9px] font-black mt-1 uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    </button>
  );
};

export default App;
