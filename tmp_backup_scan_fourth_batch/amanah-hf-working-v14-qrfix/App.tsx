
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { Child, MonitoringAlert, ParentAccount, AlertSeverity, Category, UserRole, FamilyMember } from './types';
import DashboardView from './components/DashboardView';
import DevicesView from './components/DevicesView';
import AlertsView from './components/AlertsView';
import SimulatorView from './components/SimulatorView';
import SettingsView from './components/SettingsView';
import LiveMonitorView from './components/LiveMonitorView';
import ChildAppView from './components/ChildAppView'; 
import SystemStatusBar from './components/SystemStatusBar';
import NotificationToast from './components/NotificationToast';
import EmergencyOverlay from './components/EmergencyOverlay';
import AuthView from './components/AuthView';
import { ICONS, AmanahShield } from './constants';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { 
    fetchChildrenForParent, 
    syncParentProfile,
    updateParentProfileInDB,
    updateChildInDB,
    addChildToDB,
    updateMemberInDB,
    deleteMemberFromDB,
    inviteSupervisor
} from './services/firestoreService';
import { MY_DESIGNED_ASSETS, FALLBACK_ASSETS } from './assets';
import { translations } from './translations';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<MonitoringAlert | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<MonitoringAlert | null>(null);
  
  const isChildAppRoute = location.pathname.startsWith('/child') || location.pathname.startsWith('/go');
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [is2FAVerifying, setIs2FAVerifying] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<ParentAccount>({
    id: 'guest', name: 'الوالد', role: 'ADMIN', avatar: MY_DESIGNED_ASSETS.ADMIN_AVATAR || FALLBACK_ASSETS.ADMIN
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setIsAuthChecking(true);
      if (user) {
        try {
            const { profile } = await syncParentProfile(user.uid, user.email, currentUser);
            setCurrentUser(profile);
            if ((profile as any).twoFASecret) {
                setIs2FAVerifying(true);
                setIsAuthenticated(false);
            } else {
                await completeAuth(profile);
            }
        } catch (e) { console.error("Auth Sync Error", e); }
      } else { 
          setIsAuthenticated(false); 
          setIs2FAVerifying(false);
          setChildren([]); 
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const completeAuth = async (profile: ParentAccount) => {
      setIsVerifyingCode(true);
      try {
          const cloudChildren = await fetchChildrenForParent(profile.id);
          setChildren(cloudChildren);
          setCurrentUser(profile);
          setIsAuthenticated(true);
          setIs2FAVerifying(false);
      } finally {
          setIsVerifyingCode(false);
      }
  };

  const handleVerify2FA = async () => {
      const secret = (currentUser as any).twoFASecret;
      setIsVerifyingCode(true);
      const isValid = secret ? (twoFACode === '000000') : false; // Sim for now
      if (isValid || twoFACode === '000000') {
          await completeAuth(currentUser);
      } else {
          alert(lang === 'ar' ? "رمز خاطئ" : "Invalid code");
      }
      setIsVerifyingCode(false);
  };

  const handleUpdateMember = async (id: string, type: UserRole, updates: any) => {
    if (type === 'ADMIN') {
        setCurrentUser(prev => ({ ...prev, ...updates }));
        await updateParentProfileInDB(id, updates);
    } else if (type === 'CHILD') {
        setChildren(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        await updateChildInDB(id, updates);
    }
  };

  const handleDeleteMember = async (id: string, role: UserRole) => {
    await deleteMemberFromDB(id, role);
    if (role === 'CHILD') setChildren(prev => prev.filter(c => c.id !== id));
  };

  const handleAddChild = async (data: Partial<Child>) => {
      const newChild = await addChildToDB(currentUser.id, data);
      setChildren(prev => [...prev, newChild]);
  };

  const handleNewAlert = (alert: MonitoringAlert) => {
    setAlerts(prev => [alert, ...prev]);
    setActiveToast(alert);
    if (alert.severity === AlertSeverity.CRITICAL) setEmergencyAlert(alert);
  };

  const t = translations[lang];

  if (isChildAppRoute) {
      return (
          <div className="scroll-viewport custom-scrollbar bg-black">
              <Routes>
                  <Route path="/child" element={<ChildAppView lang={lang} />} />
                  <Route path="/go" element={<ChildAppView lang={lang} />} />
                  <Route path="/child/lock" element={<ChildAppView lang={lang} isRemoteLocked={true} />} />
              </Routes>
          </div>
      );
  }

  if (isAuthChecking) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black animate-pulse text-2xl">🛡️ AMANAH AI</div>;
  
  if (is2FAVerifying && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-[3rem] shadow-2xl text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-8">🛡️</div>
          <h2 className="text-2xl font-black text-white mb-2">تأكيد الهوية</h2>
          <input 
            type="text" maxLength={6} placeholder="000 000" value={twoFACode}
            onChange={e => setTwoFACode(e.target.value.replace(/\D/g,''))}
            className="w-full p-5 bg-white/5 border border-white/20 rounded-2xl text-white text-center text-3xl font-black outline-none mb-8"
          />
          <button onClick={handleVerify2FA} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95">دخول آمن</button>
          <button onClick={logoutUser} className="mt-8 text-slate-500 font-bold text-xs">تسجيل الخروج</button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <AuthView onLoginSuccess={() => {}} />;

  return (
    <div className="h-screen w-full relative overflow-hidden bg-[#f8fafc]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SystemStatusBar hasCriticalAlert={alerts.some(a => a.severity === AlertSeverity.CRITICAL)} alertCount={alerts.length} />
      
      <header className="fixed top-7 left-0 right-0 h-16 px-4 flex items-center justify-between z-[150] bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/settings')}>
           <img src={currentUser.avatar} className="w-10 h-10 rounded-full shadow-lg border-2 border-white object-cover" />
           <div className="hidden sm:block text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.admin}</p>
              <p className="text-xs font-black text-slate-800">{currentUser.name}</p>
           </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => navigate('/settings')} className="p-3 bg-white/80 rounded-2xl shadow-lg border border-white text-slate-700 active:scale-95"><ICONS.Settings /></button>
            <button onClick={() => setIsMenuOpen(true)} className="p-3 bg-slate-900 rounded-2xl shadow-lg text-white active:scale-95"><ICONS.Menu /></button>
        </div>
      </header>

      {/* منطقة المحتوى القابلة للتمرير مع حاشية سفلية ضخمة */}
      <main className="scroll-viewport custom-scrollbar pt-28 px-4 md:px-6">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} lang={lang} />} />
          <Route path="/devices" element={<DevicesView children={children} onUpdateDevice={(id, u) => handleUpdateMember(id, 'CHILD', u)} onToggleAppBlock={() => {}} />} />
          <Route path="/alerts" element={<AlertsView alerts={alerts} theme="light" lang={lang} />} />
          <Route path="/simulator" element={children.length > 0 ? <SimulatorView children={children} onNewAlert={handleNewAlert} lang={lang} /> : null} />
          <Route path="/live" element={children.length > 0 ? <LiveMonitorView children={children} lang={lang} /> : null} />
          <Route path="/settings" element={<SettingsView currentUser={currentUser} children={children} lang={lang} onUpdateMember={handleUpdateMember} onDeleteMember={handleDeleteMember} onAddChild={handleAddChild} onAddSupervisor={() => Promise.resolve({} as any)} showSuccessToast={() => {}} />} />
        </Routes>
      </main>

      {/* القائمة العائمة المطورة (Glassmorphism) - أصبحت أصغر ولا تحجب الرؤية */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass-nav rounded-[2.5rem] shadow-2xl px-6 py-2 z-[180] flex justify-between items-center border border-white/40">
         <NavLink to="/" icon={<ICONS.Dashboard />} label={t.dashboard} />
         <NavLink to="/alerts" icon={<ICONS.Shield />} label={t.alerts} />
         <NavLink to="/live" icon={<ICONS.LiveCamera />} label={t.live} />
         <NavLink to="/settings" icon={<ICONS.Settings />} label={t.settings} />
      </nav>

      {emergencyAlert && <EmergencyOverlay alert={emergencyAlert} onClose={() => setEmergencyAlert(null)} onAction={() => navigate('/alerts')} />}
      {activeToast && <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />}
      
      {/* Sidebar */}
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} lang={lang} />
    </div>
  );
};

const NavLink: React.FC<{ to: string, icon: any, label: string }> = ({ to, icon, label }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <button onClick={() => navigate(to)} className={`flex flex-col items-center gap-1 transition-all p-2 rounded-2xl ${isActive ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`p-2 rounded-xl ${isActive ? 'bg-indigo-600/10' : ''}`}>{icon}</div>
      <span className="text-[8px] font-black">{label}</span>
    </button>
  );
};

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void, lang: 'ar' | 'en' }> = ({ isOpen, onClose, lang }) => {
  const navigate = useNavigate();
  const menuItems = [
    { path: '/', label: 'لوحة التحكم', icon: <ICONS.Dashboard /> },
    { path: '/devices', label: 'الأجهزة', icon: <ICONS.Devices /> },
    { path: '/alerts', label: 'التنبيهات', icon: <ICONS.Shield /> },
    { path: '/simulator', label: 'المحاكي', icon: <ICONS.Rocket /> },
    { path: '/settings', label: 'الإعدادات', icon: <ICONS.Settings /> },
    { path: '/go', label: '📱 معاينة بوابة الطفل', icon: <span className="text-lg">👶</span> },
  ];

  return (
    <div className={`fixed inset-0 z-[2000] transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className={`absolute top-0 bottom-0 w-[80vw] max-w-[300px] bg-white shadow-2xl transition-transform duration-500 p-8 flex flex-col ${lang === 'ar' ? (isOpen ? 'right-0' : 'right-[-300px]') : (isOpen ? 'left-0' : 'left-[-300px]')}`}>
        <h2 className="text-2xl font-black mb-10 border-b pb-4">القائمة الرئيسية</h2>
        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 text-right">
              <span className="text-slate-400">{item.icon}</span>
              <span className="font-bold text-slate-700">{item.label}</span>
            </button>
          ))}
        </div>
        <button onClick={logoutUser} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black mt-10">تسجيل الخروج</button>
      </div>
    </div>
  );
};

export default App;
