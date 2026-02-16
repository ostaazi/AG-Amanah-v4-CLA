
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
import { ICONS, AmanahLogo, AmanahShield, AdminShieldBadge, AmanahGlobalDefs } from './constants';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { 
    syncParentProfile,
    updateParentProfileInDB,
    updateChildInDB,
    addChildToDB,
    updateMemberInDB,
    deleteMemberFromDB,
    subscribeToChildren,
    subscribeToAlerts,
    logUserActivity,
    inviteSupervisor
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
  const [isVaultActive, setIsVaultActive] = useState(false);
  
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
    } catch (e) {
      console.error("Update error", e);
    }
  };

  const handleDeleteMember = async (id: string, role: UserRole) => {
    try {
      await deleteMemberFromDB(id, role);
      logUserActivity(currentUser.id, {
        action: "حذف عضو",
        details: `تم حذف ${role} من النظام`,
        type: 'DANGER'
      });
    } catch (e) {
      console.error("Delete Member Error", e);
    }
  };

  const handleAddChild = async (data: Partial<Child>) => {
    try {
      await addChildToDB(currentUser.id, data);
      logUserActivity(currentUser.id, {
        action: "إضافة طفل",
        details: `تمت إضافة ${data.name} للنظام`,
        type: 'SUCCESS'
      });
    } catch (e) {
      console.error("Add Child Error", e);
    }
  };

  const handleAddSupervisor = async (data: any): Promise<FamilyMember> => {
    const supervisor = await inviteSupervisor(currentUser.id, data);
    logUserActivity(currentUser.id, {
      action: "إضافة مشرف",
      details: `تمت إضافة المشرف ${data.name}`,
      type: 'SUCCESS'
    });
    return supervisor;
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setIsAuthChecking(true);
      if (user) {
        try {
            const { profile } = await syncParentProfile(user.uid, user.email, currentUser);
            setCurrentUser(profile);
            setIsAuthenticated(true);
        } catch (e) { console.error("Auth Sync Error", e); }
      } else { 
          setIsAuthenticated(false); 
          setChildren([]); 
          setAlerts([]);
      }
      setTimeout(() => setIsAuthChecking(false), 2500);
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
    <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center p-6 overflow-hidden relative">
      <AmanahGlobalDefs />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(138,21,56,0.18)_0%,transparent_70%)] animate-pulse"></div>
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="w-full max-w-[280px] md:max-w-[420px] relative z-20 flex flex-col items-center drop-shadow-[0_0_50px_rgba(138,21,56,0.3)] animate-in zoom-in-90 duration-1000">
        <div className="w-full animate-[pulse_3s_ease-in-out_infinite]">
          <AmanahLogo className="w-full h-auto" />
        </div>
      </div>
      <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-4 z-20">
         <div className="flex gap-2">
            <div className="w-2 h-2 bg-[#8A1538] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-[#8A1538] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-[#8A1538] rounded-full animate-bounce"></div>
         </div>
         <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.6em] ml-[0.6em]">Amanah Sovereignty Engine</p>
      </div>
    </div>
  );
  
  if (!isAuthenticated) return <AuthView onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo'] relative overflow-x-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <AmanahGlobalDefs />
      <SystemStatusBar hasCriticalAlert={alerts.some(a => a.severity === AlertSeverity.CRITICAL)} alertCount={alerts.length} />
      
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} lang={lang} menuItems={menuItems} />

      {/* Header Container with Safety Padding (Hawsahi) */}
      <header className="fixed top-7 left-0 right-0 h-24 px-6 flex items-center justify-between z-[150] bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/settings')}>
           <div className="relative group">
             <img src={currentUser.avatar} className="w-14 h-14 rounded-2xl shadow-lg border-2 border-white object-cover" />
             <div className="absolute -bottom-1 -left-1 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-100 p-0.5">
                {/* بادج المدير المخصص كما في الصورة المرفقة */}
                <AdminShieldBadge className="w-full h-full" />
             </div>
           </div>
           <div className="hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{translations[lang].admin}</p>
              <p className="text-sm font-black text-slate-800 leading-tight">{currentUser.name}</p>
           </div>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 w-28 md:w-32 drop-shadow-md cursor-pointer" onClick={() => navigate('/')}>
           <AmanahLogo />
        </div>

        <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-white shadow-xl rounded-[2rem] border border-slate-100 text-slate-700 active:scale-95 hover:bg-slate-50 transition-all"><ICONS.Menu /></button>
        </div>
      </header>

      {/* Main Content with Consistent Bottom and Top Margin (Hawsahi) */}
      <main className="pt-40 px-4 pb-52 max-w-7xl mx-auto relative z-[50] min-h-screen">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} lang={lang} parentId={currentUser.id} />} />
          <Route path="/devices" element={<DevicesView children={children} onUpdateDevice={(id, u) => handleUpdateMember(id, 'CHILD', u)} onToggleAppBlock={() => {}} />} />
          <Route path="/alerts" element={<AlertsView alerts={alerts} theme="light" lang={lang} />} />
          <Route path="/modes" element={<ModesView modes={modes} children={children} onUpdateModes={setModes} onApplyMode={(c, m) => {}} />} />
          <Route path="/simulator" element={children.length > 0 ? <SimulatorView children={children} parentId={currentUser.id} lang={lang} /> : null} />
          <Route path="/live" element={children.length > 0 ? <LiveMonitorView children={children} lang={lang} /> : null} />
          <Route path="/vault" element={<EvidenceVaultView records={alerts as any} currentUser={currentUser} onRequestToast={(a) => setActiveToast(a)} />} />
          <Route path="/pulse" element={children.length > 0 ? <PsychologicalInsightView theme="light" child={children[0]} onAcceptPlan={() => {}} /> : null} />
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
                id: 'success-' + Date.now(), 
                childName: 'System', 
                platform: 'Amanah AI', 
                content: m, 
                category: Category.SAFE, 
                severity: AlertSeverity.LOW, 
                timestamp: new Date(), 
                aiAnalysis: m 
            })} 
          />} />
        </Routes>
      </main>

      {/* Bottom Navigation with Extra Height and Shadow (Hawsahi) */}
      <nav className={`fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-200 shadow-[0_-15px_50px_rgba(0,0,0,0.12)] z-[180] pb-10 pt-2`}>
         <div className="flex overflow-x-auto custom-scrollbar items-center justify-between sm:justify-center gap-1 sm:gap-6 px-6 scroll-smooth">
           {menuItems.map((item) => (
             <NavLink key={item.path} to={item.path} icon={item.icon} label={item.label} />
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
    <div className={`fixed inset-0 z-[2000] transition-all duration-500 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className={`absolute top-0 bottom-0 w-[80vw] max-w-[320px] bg-white shadow-2xl transition-transform duration-500 ease-out p-8 flex flex-col ${lang === 'ar' ? (isOpen ? 'right-0 translate-x-0' : 'right-0 translate-x-full') : (isOpen ? 'left-0 translate-x-0' : 'left-0 -translate-x-full')}`}>
        <div className="flex justify-between items-center mb-16">
          <div className="w-24"><AmanahLogo /></div>
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-colors"><ICONS.Close /></button>
        </div>
        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {menuItems.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); onClose(); }} className="w-full flex items-center gap-5 p-4 rounded-[1.5rem] hover:bg-indigo-50/70 transition-all group active:scale-95 text-right">
              <div className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">{item.icon}</div>
              <span className="font-black text-slate-700 text-sm tracking-tight group-hover:text-indigo-600 transition-colors truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="pt-10 border-t border-slate-100 mt-6">
           <button onClick={() => { logoutUser(); onClose(); }} className="w-full p-4 rounded-[1.5rem] bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors">تسجيل الخروج</button>
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
    <button onClick={() => navigate(to)} className={`flex flex-col items-center justify-center min-w-[70px] gap-1 transition-all duration-300 group shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`p-2.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-indigo-100 shadow-sm' : 'bg-transparent group-hover:bg-slate-100'}`}>
        <div className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform`}>{icon}</div>
      </div>
      <span className={`text-[9px] font-black whitespace-nowrap px-1 transition-all uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    </button>
  );
};

export default App;
