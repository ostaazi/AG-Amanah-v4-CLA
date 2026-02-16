
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Child, MonitoringAlert, ParentAccount, AlertSeverity, Category, UserRole, FamilyMember } from './types';
import DashboardView from './components/DashboardView';
import DevicesView from './components/DevicesView';
import AlertsView from './components/AlertsView';
import SimulatorView from './components/SimulatorView';
import SettingsView from './components/SettingsView';
import LiveMonitorView from './components/LiveMonitorView';
import EvidenceVaultView from './components/EvidenceVaultView';
import PsychologicalInsightView from './components/PsychologicalInsightView';
import MapView from './components/MapView';
import SystemStatusBar from './components/SystemStatusBar';
import NotificationToast from './components/NotificationToast';
import EmergencyOverlay from './components/EmergencyOverlay';
import AuthView from './components/AuthView';
import { ICONS, AmanahLogo, AmanahShield } from './constants';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { 
    syncParentProfile,
    updateParentProfileInDB,
    updateChildInDB,
    addChildToDB,
    updateMemberInDB,
    deleteMemberFromDB,
    inviteSupervisor,
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
  const [isVaultActive, setIsVaultActive] = useState(false);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  const [currentUser, setCurrentUser] = useState<ParentAccount>({
    id: 'guest', name: 'الوالد', role: 'ADMIN', avatar: MY_DESIGNED_ASSETS.ADMIN_AVATAR || FALLBACK_ASSETS.ADMIN
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);

  const t = translations[lang];

  const menuItems = [
    { path: '/', label: t.dashboard, icon: <ICONS.Dashboard /> },
    { path: '/alerts', label: t.alerts, icon: <ICONS.Shield /> },
    { path: '/vault', label: t.vault, icon: <ICONS.Vault /> },
    { path: '/pulse', label: t.pulse, icon: <ICONS.Pulse /> },
    { path: '/live', label: t.live, icon: <ICONS.LiveCamera /> },
    { path: '/map', label: t.map, icon: <ICONS.Location /> },
    { path: '/devices', label: t.devices, icon: <ICONS.Devices /> },
    { path: '/simulator', label: t.simulator, icon: <ICONS.Rocket /> },
    { path: '/settings', label: t.settings, icon: <ICONS.Settings /> },
  ];

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
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'guest') return;

    const unsubChildren = subscribeToChildren(currentUser.id, (data) => {
      setChildren(data);
    });

    const unsubAlerts = subscribeToAlerts(currentUser.id, (data) => {
      if (data.length > alerts.length) {
        const latest = data[0];
        if (latest.severity === AlertSeverity.CRITICAL) {
          setEmergencyAlert(latest);
        } else {
          setActiveToast(latest);
        }
      }
      setAlerts(data);
    });

    return () => {
      unsubChildren();
      unsubAlerts();
    };
  }, [isAuthenticated, currentUser.id, alerts.length]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleUpdateMember = async (id: string, type: UserRole, updates: any) => {
    try {
        if (type === 'ADMIN') {
            setCurrentUser(prev => ({ ...prev, ...updates }));
            await updateParentProfileInDB(id, updates);
        } else if (type === 'SUPERVISOR') {
            await updateMemberInDB(id, 'SUPERVISOR', updates);
        } else if (type === 'CHILD') {
            await updateChildInDB(id, updates);
        }
    } catch (error) { console.error(error); }
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

  if (isAuthChecking) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black animate-pulse text-2xl">🛡️ AMANAH AI</div>;
  if (!isAuthenticated) return <AuthView onLoginSuccess={() => {}} />;

  const showBottomNav = !emergencyAlert;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo'] relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SystemStatusBar hasCriticalAlert={alerts.some(a => a.severity === AlertSeverity.CRITICAL)} alertCount={alerts.length} />
      
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} lang={lang} menuItems={menuItems} />

      <header className="fixed top-7 left-0 right-0 h-20 px-6 flex items-center justify-between z-[150] bg-white/60 backdrop-blur-xl border-b border-white/20">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/settings')}>
           <div className="relative group">
             <img src={currentUser.avatar} className="w-12 h-12 rounded-full shadow-lg border-2 border-white object-cover" />
             <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-100"><AmanahShield className="w-4 h-4" /></div>
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{translations[lang].admin}</p>
              <p className="text-sm font-black text-slate-800">{currentUser.name}</p>
           </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-white/80 rounded-[2rem] shadow-lg border border-white text-slate-700 active:scale-95"><ICONS.Menu /></button>
        </div>
      </header>

      {/* حاشية سفلية كبيرة pb-48 لضمان عدم تداخل المحتوى مع القائمة */}
      <main className="pt-32 px-4 pb-48 max-w-7xl mx-auto relative z-[50]">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} lang={lang} parentId={currentUser.id} />} />
          <Route path="/devices" element={<DevicesView children={children} onUpdateDevice={(id, u) => handleUpdateMember(id, 'CHILD', u)} onToggleAppBlock={() => {}} />} />
          <Route path="/alerts" element={<AlertsView alerts={alerts} theme="light" lang={lang} />} />
          <Route path="/simulator" element={children.length > 0 ? <SimulatorView children={children} parentId={currentUser.id} lang={lang} /> : null} />
          <Route path="/live" element={children.length > 0 ? <LiveMonitorView children={children} lang={lang} /> : null} />
          <Route path="/vault" element={<EvidenceVaultView records={alerts as any} currentUser={currentUser} onModalToggle={setIsVaultActive} onRequestToast={(a) => setActiveToast(a)} />} />
          <Route path="/pulse" element={children.length > 0 ? <PsychologicalInsightView theme="light" child={children[0]} onAcceptPlan={() => {}} /> : null} />
          <Route path="/map" element={<MapView children={children} />} />
          <Route path="/settings" element={<SettingsView currentUser={currentUser} children={children} lang={lang} onUpdateMember={handleUpdateMember} onDeleteMember={handleDeleteMember} onAddChild={handleAddChild} onAddSupervisor={() => Promise.resolve({} as any)} showSuccessToast={() => {}} />} />
        </Routes>
      </main>

      {/* القائمة السفلية المستطيلة والنحيفة (Rectangular Slim Bar) */}
      <nav className={`fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-[180] transition-all duration-500 transform ${showBottomNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
         <div className="flex overflow-x-auto custom-scrollbar items-center gap-1 py-1.5 px-4 scroll-smooth">
           {menuItems.map((item) => (
             <NavLink key={item.path} to={item.path} icon={item.icon} label={item.label} />
           ))}
         </div>
         {/* حاشية سفلية إضافية للأجهزة ذات الحواف المنحنية (iPhone Notch Area) */}
         <div className="h-6 bg-white/95"></div>
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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
      <div className={`absolute top-0 bottom-0 w-[60vw] max-w-[190px] bg-white shadow-2xl transition-transform duration-500 ease-out p-4 flex flex-col ${lang === 'ar' ? (isOpen ? 'right-0 translate-x-0' : 'right-0 translate-x-full') : (isOpen ? 'left-0 translate-x-0' : 'left-0 -translate-x-full')}`}>
        <div className="flex justify-between items-center mb-10">
           <div className="w-14">
              <AmanahLogo />
           </div>
           <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 transition-all active:scale-90 shadow-sm border border-slate-100">
              <ICONS.Close />
           </button>
        </div>
        
        <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button 
              key={item.path} 
              onClick={() => { navigate(item.path); onClose(); }} 
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-indigo-50/50 transition-all group active:scale-95"
            >
              <div className="text-slate-400 group-hover:text-indigo-600 transition-colors scale-90 shrink-0">
                {item.icon}
              </div>
              <span className="font-bold text-slate-700 text-[11px] tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-100 mt-4">
           <button onClick={logoutUser} className="w-full py-3.5 bg-red-50 text-red-600 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-red-100 transition-colors">
             {lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
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
    <button 
      onClick={() => navigate(to)} 
      className={`flex flex-col items-center justify-center min-w-[62px] gap-0.5 transition-all duration-300 group shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
    >
      <div className={`p-1.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-indigo-50' : 'bg-transparent group-hover:bg-slate-50'}`}>
        <div className={`${isActive ? 'scale-110' : 'scale-90'} transition-transform`}>
            {icon}
        </div>
      </div>
      <span className={`text-[8px] font-black whitespace-nowrap px-1 transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>
        {label}
      </span>
    </button>
  );
};

export default App;
