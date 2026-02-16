
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Child, MonitoringAlert, CustomMode, EvidenceRecord, ParentAccount, UserRole, AlertSeverity, Category } from './types';
import DashboardView from './components/DashboardView';
import DevicesView from './components/DevicesView';
import MapView from './components/MapView';
import AlertsView from './components/AlertsView';
import SimulatorView from './components/SimulatorView';
import ModesView from './components/ModesView';
import SettingsView from './components/SettingsView';
import LiveMonitorView from './components/LiveMonitorView';
import EvidenceVaultView from './components/EvidenceVaultView';
import PsychologicalInsightView from './components/PsychologicalInsightView';
import SystemStatusBar from './components/SystemStatusBar';
import NotificationToast from './components/NotificationToast';
import EmergencyOverlay from './components/EmergencyOverlay';
import AuthView from './components/AuthView';
import { ICONS, AmanahLogo, AmanahShield } from './constants';
import { getImagesFromDB, saveImageToDB, saveBulkImagesToDB, deleteImageFromDB, overrideLibraryDB } from './services/storageService';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { 
    fetchChildrenForParent, 
    addChildToDB, 
    updateChildInDB, 
    deleteChildFromDB,
    syncParentProfile,      // New
    updateParentProfileInDB // New
} from './services/firestoreService';
import { MY_DESIGNED_ASSETS, FALLBACK_ASSETS } from './assets';
import { translations } from './translations';

const App: React.FC = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<MonitoringAlert | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<MonitoringAlert | null>(null);
  
  // --- Auth & Data State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<ParentAccount>({
    id: 'guest', 
    name: 'الوالد', 
    role: 'ADMIN', 
    avatar: MY_DESIGNED_ASSETS.ADMIN_AVATAR || FALLBACK_ASSETS.ADMIN
  });
  
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [supervisors, setSupervisors] = useState<ParentAccount[]>([]); 

  // --- مكتبة الصور ---
  const [avatarLibrary, setAvatarLibrary] = useState<string[]>([]);

  // تحميل المكتبة الأولية (من الأصول الثابتة كاحتياط)
  useEffect(() => {
    const initStaticLibrary = () => {
        let initialImages = [...FALLBACK_ASSETS.DEFAULTS];
        if (MY_DESIGNED_ASSETS.ADMIN_AVATAR) initialImages.unshift(MY_DESIGNED_ASSETS.ADMIN_AVATAR);
        if (MY_DESIGNED_ASSETS.CHILD_AVATAR) initialImages.unshift(MY_DESIGNED_ASSETS.CHILD_AVATAR);
        if (MY_DESIGNED_ASSETS.LIBRARY_ICONS.length > 0) {
            initialImages = [...MY_DESIGNED_ASSETS.LIBRARY_ICONS, ...initialImages];
        }
        // إزالة التكرار
        const unique = Array.from(new Set(initialImages));
        setAvatarLibrary(unique);
    };
    initStaticLibrary();
  }, []);

  // --- مراقب المصادقة وجلب البيانات (Profile + Children) ---
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoadingData(true);
        
        try {
            // 1. جلب أو إنشاء ملف الأب (الاسم، الصورة، المكتبة)
            const { profile, library } = await syncParentProfile(user.uid, user.email, currentUser);
            
            setCurrentUser(profile);
            
            // دمج المكتبة السحابية مع المحلية الحالية
            if (library && library.length > 0) {
                setAvatarLibrary(prev => Array.from(new Set([...prev, ...library])));
            }

            // 2. جلب الأطفال
            const cloudChildren = await fetchChildrenForParent(user.uid);
            setChildren(cloudChildren);

        } catch (e) {
            console.error("Failed to sync data", e);
            showSuccessToast("فشل في مزامنة البيانات السحابية");
        } finally {
            setIsLoadingData(false);
        }

      } else {
        setIsAuthenticated(false);
        setChildren([]);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // --- دوال إدارة البيانات السحابية ---

  // 1. إدارة الأطفال
  const handleAddChild = async (name: string, age: number, avatar: string) => {
    if (!currentUser.id) return;
    try {
        const newChild = await addChildToDB(currentUser.id, { name, age, avatar });
        setChildren(prev => [...prev, newChild]);
        showSuccessToast(`تمت إضافة ${name} للسحابة بنجاح`);
    } catch (e) {
        console.error("Add child error:", e);
        showSuccessToast("حدث خطأ أثناء الحفظ السحابي");
    }
  };

  const handleUpdateDevice = async (childId: string, updates: Partial<Child>) => {
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, ...updates } : c));
    try { await updateChildInDB(childId, updates); } catch (e) { console.error("Update error:", e); }
  };

  const handleToggleAppBlock = async (childId: string, appId: string) => {
    const child = children.find(c => c.id === childId);
    if (!child) return;
    const updatedApps = child.appUsage.map(app => 
        app.id === appId ? { ...app, isBlocked: !app.isBlocked } : app
    );
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, appUsage: updatedApps } : c));
    try { await updateChildInDB(childId, { appUsage: updatedApps }); } catch (e) { console.error("Block app error:", e); }
  };

  const handleDeleteChild = async (id: string) => {
    setChildren(prev => prev.filter(c => c.id !== id));
    try { await deleteChildFromDB(id); } catch (e) { console.error("Delete error:", e); }
  };

  // 2. إدارة ملف الأب والمكتبة (تحديث سحابي)
  const syncLibraryToCloud = async (newLibrary: string[]) => {
      if (!isAuthenticated || !currentUser.id) return;
      try {
          // نحفظ فقط الروابط أو الصور الصغيرة لتجنب حجم المستند الكبير
          // (في تطبيق حقيقي نستخدم Firebase Storage)
          await updateParentProfileInDB(currentUser.id, { avatarLibrary: newLibrary });
      } catch (e) {
          console.error("Failed to sync library to cloud", e);
      }
  };

  const handleAddToLibrary = async (url: string) => {
    if (!avatarLibrary.includes(url)) {
      const newLib = [url, ...avatarLibrary];
      setAvatarLibrary(newLib);
      try { 
          await saveImageToDB(url); // محلي
          await syncLibraryToCloud(newLib); // سحابي
      } catch (e) { console.error("Save error:", e); }
    }
  };

  const handleAddBulkToLibrary = async (urls: string[]) => {
    const newUrls = urls.filter(url => !avatarLibrary.includes(url));
    if (newUrls.length > 0) {
      const newLib = [...newUrls, ...avatarLibrary];
      setAvatarLibrary(newLib);
      try { 
          await saveBulkImagesToDB(newUrls); // محلي
          await syncLibraryToCloud(newLib); // سحابي
      } catch (e) { console.error("Bulk save error:", e); }
    }
  };

  const handleRemoveFromLibrary = async (index: number) => {
    const urlToRemove = avatarLibrary[index];
    const newLib = avatarLibrary.filter((_, i) => i !== index);
    setAvatarLibrary(newLib);
    try { 
        await deleteImageFromDB(urlToRemove); // محلي
        await syncLibraryToCloud(newLib); // سحابي
    } catch (e) { console.error("Delete error:", e); }
  };

  const handleReorderLibrary = async (newOrder: string[]) => {
    setAvatarLibrary(newOrder);
    try { 
        await overrideLibraryDB(newOrder); // محلي
        await syncLibraryToCloud(newOrder); // سحابي
    } catch (e) { console.error("Reorder save error:", e); }
  };

  // 3. تحديث الأعضاء (الأب والمشرفين)
  const handleUpdateMember = async (id: string, currentType: 'CHILD' | 'SUPERVISOR' | 'ADMIN', updates: any) => {
    if (currentType === 'CHILD') {
        handleUpdateDevice(id, updates);
    } else if (currentType === 'ADMIN') {
        // تحديث محلي
        if (currentUser.id === id) {
            setCurrentUser(prev => ({ ...prev, ...updates }));
        }
        // تحديث سحابي لبيانات الأب
        if (isAuthenticated && currentUser.id) {
            try {
                await updateParentProfileInDB(currentUser.id, updates);
                showSuccessToast("تم تحديث الملف الشخصي في السحابة");
            } catch (e) {
                console.error("Profile update error", e);
                showSuccessToast("فشل حفظ التحديث في السحابة");
            }
        }
    } else if (currentType === 'SUPERVISOR') {
      setSupervisors(prev => prev.map(sup => sup.id === id ? { ...sup, ...updates } : sup));
    }
  };

  // --- Helpers ---
  const handleAddSupervisor = (name: string, avatar?: string) => {
    const newSupervisor: ParentAccount = {
      id: `sup-${Date.now()}`,
      name: name,
      role: 'SUPERVISOR',
      avatar: avatar || 'https://cdn-icons-png.flaticon.com/512/6024/6024190.png'
    };
    setSupervisors([...supervisors, newSupervisor]);
  };

  const handleDeleteSupervisor = (id: string) => {
    setSupervisors(prev => prev.filter(s => s.id !== id));
  };

  const showSuccessToast = (msg: string) => {
    setActiveToast({
        id: 'TOAST-'+Date.now(), category: Category.SAFE, severity: AlertSeverity.LOW, childName: 'System',
        platform: 'Amanah', content: msg, aiAnalysis: msg, timestamp: new Date()
    });
  };

  const handleNewAlert = (alert: MonitoringAlert) => {
    setActiveToast(alert);
    if (alert.severity === AlertSeverity.CRITICAL) setEmergencyAlert(alert);
  };

  const t = translations[lang];

  // --- محتوى وهمي مؤقت ---
  const [alerts] = useState<MonitoringAlert[]>([
    {
      id: 'AL-8821', childName: 'أحمد', platform: 'Discord', content: 'أرسل لي صورتك الآن وإلا سأخبر الجميع بسرك',
      category: Category.BLACKMAIL, severity: AlertSeverity.CRITICAL, timestamp: new Date(),
      aiAnalysis: 'رصد محاولة ابتزاز صريحة واستدراج (Grooming) لتبادل صور خاصة. تم التداخل الآلي لعزل الجهاز.',
      actionTaken: 'قفل فوري وعزل الأدلة', latency: '0.1245ms', suspectId: 'N9I3WD'
    }
  ]);
  const [evidenceRecords] = useState<EvidenceRecord[]>([
    {
      id: 'EV-8821', suspectUsername: 'N9I3WD', platform: 'Discord', childName: 'أحمد',
      severity: AlertSeverity.CRITICAL, encryptionKey: 'AES-QX92-B881', timestamp: new Date(),
      conversationLog: [
        { sender: 'أحمد', text: 'أنا لا أعرفك، لماذا تضيفني؟', time: '10:05 AM', isSuspect: false },
        { sender: 'GamerPro_44', text: 'أريد أن أعطيك "سكين" مجاني ونادر جداً، فقط افتح الكاميرا', time: '10:07 AM', isSuspect: true },
        { sender: 'GamerPro_44', text: 'أرسل لي صورتك الآن وإلا سأخبر الجميع بسرك', time: '10:10 AM', isSuspect: true },
      ]
    }
  ]);
  const [modes, setModes] = useState<CustomMode[]>([
    {
      id: 'm1', name: 'وضع الطوارئ', color: 'bg-red-900', icon: '🚨', allowedApps: [], allowedUrls: [], blacklistedUrls: ['discord.com'],
      cameraEnabled: false, micEnabled: false, isInternetCut: true, isScreenDimmed: true, isDeviceLocked: true,
      internetStartTime: '00:00', internetEndTime: '00:00', activeDays: [0, 1, 2, 3, 4, 5, 6]
    }
  ]);

  if (isAuthChecking) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black animate-pulse">جاري الاتصال بالنظام الآمن...</div>;
  }

  if (!isAuthenticated) {
    return <AuthView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  if (isLoadingData) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold">جاري مزامنة بيانات العائلة...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo']" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SystemStatusBar hasCriticalAlert={true} alertCount={1} />
      <header className="fixed top-7 left-0 right-0 h-20 px-6 flex items-center justify-between z-[100] bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-500">
        <div className="flex items-center gap-4">
           <div className="relative group cursor-pointer" title="تعديل الحساب">
             <div className="absolute inset-0 bg-indigo-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
             <img src={currentUser.avatar} className="w-12 h-12 rounded-full shadow-lg border-2 border-white object-cover relative z-10 transition-transform group-hover:scale-105" />
             <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-100 z-20">
               <AmanahShield className="w-4 h-4" />
             </div>
           </div>
           <div className={`text-${lang === 'ar' ? 'right' : 'left'}`}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.admin}</p>
              <p className="text-sm font-black text-slate-800">{currentUser.name}</p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button onClick={logoutUser} className="p-4 bg-red-50 text-red-600 rounded-[2rem] shadow-sm border border-red-100 hover:bg-red-600 hover:text-white transition-all active:scale-95" title="تسجيل الخروج">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-white/80 rounded-[2rem] shadow-lg border border-white hover:scale-105 hover:shadow-xl transition-all active:scale-95 text-slate-700 hover:text-indigo-600"><ICONS.Menu /></button>
        </div>
      </header>

      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} lang={lang} />
      
      <main className="pt-32 px-6 pb-40 max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} lang={lang} />} />
          <Route path="/devices" element={<DevicesView children={children} onUpdateDevice={handleUpdateDevice} onToggleAppBlock={handleToggleAppBlock} lang={lang} />} />
          <Route path="/map" element={<MapView children={children} />} />
          <Route path="/alerts" element={<AlertsView alerts={alerts} theme="light" lang={lang} />} />
          <Route path="/vault" element={<EvidenceVaultView records={evidenceRecords} currentUser={currentUser} />} />
          <Route path="/pulse" element={children.length > 0 ? <PsychologicalInsightView child={children[0]} theme="light" onAcceptPlan={() => {}} /> : <div className="p-10 text-center font-bold text-slate-400">أضف طفلاً أولاً لعرض التحليل النفسي</div>} />
          <Route path="/simulator" element={children.length > 0 ? <SimulatorView children={children} onNewAlert={handleNewAlert} lang={lang} /> : <div className="p-10 text-center font-bold text-slate-400">أضف طفلاً أولاً لبدء المحاكاة</div>} />
          <Route path="/modes" element={children.length > 0 ? <ModesView modes={modes} children={children} onUpdateModes={setModes} onApplyMode={() => {}} /> : <div className="p-10 text-center font-bold text-slate-400">أضف طفلاً أولاً لإدارة الأوضاع</div>} />
          <Route path="/live" element={children.length > 0 ? <LiveMonitorView children={children} lang={lang} /> : <div className="p-10 text-center font-bold text-slate-400">أضف طفلاً أولاً للبث المباشر</div>} />
          <Route path="/settings" element={
            <SettingsView 
              children={children} 
              supervisors={supervisors} 
              currentUser={currentUser} 
              lang={lang} 
              theme="light" 
              avatarLibrary={avatarLibrary}
              onAddToLibrary={handleAddToLibrary}
              onAddBulkToLibrary={handleAddBulkToLibrary}
              onRemoveFromLibrary={handleRemoveFromLibrary}
              onReorderLibrary={handleReorderLibrary}
              onSetLang={setLang}
              onAddChild={handleAddChild} 
              onAddSupervisor={handleAddSupervisor}
              onDeleteChild={handleDeleteChild}
              onDeleteSupervisor={handleDeleteSupervisor}
              onUpdateMember={handleUpdateMember}
              onConnectDevice={() => {}}
              showSuccessToast={showSuccessToast}
            />
          } />
        </Routes>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-white/90 backdrop-blur-3xl rounded-[2.5rem] border border-white/50 shadow-2xl shadow-indigo-500/10 px-8 py-4 z-[200] flex justify-between items-center transition-all duration-500 hover:shadow-indigo-500/20">
         <NavLink to="/" icon={<ICONS.Dashboard />} label={t.dashboard} />
         <NavLink to="/vault" icon={<ICONS.Vault />} label={t.vault} />
         <NavLink to="/pulse" icon={<ICONS.Pulse />} label={t.pulse} />
         <NavLink to="/simulator" icon={<ICONS.Rocket />} label={t.simulator} />
      </nav>

      {emergencyAlert && <EmergencyOverlay alert={emergencyAlert} onClose={() => setEmergencyAlert(null)} onAction={() => navigate('/vault')} />}
      {activeToast && <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />}
    </div>
  );
};

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void, lang: 'ar' | 'en' }> = ({ isOpen, onClose, lang }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = translations[lang];

  const menuItems = [
    { path: '/', label: t.dashboard, icon: <ICONS.Dashboard /> },
    { path: '/devices', label: t.devices, icon: <ICONS.Devices /> },
    { path: '/map', label: t.map, icon: <ICONS.Location /> },
    { path: '/alerts', label: t.alerts, icon: <ICONS.Shield /> },
    { path: '/simulator', label: t.simulator, icon: <ICONS.Rocket /> },
    { path: '/modes', label: t.modes, icon: <ICONS.WalkieTalkie /> },
    { path: '/live', label: t.live, icon: <ICONS.LiveCamera /> },
    { path: '/vault', label: t.vault, icon: <ICONS.Vault /> },
    { path: '/pulse', label: t.pulse, icon: <ICONS.Pulse /> },
  ];

  return (
    <div className={`fixed inset-0 z-[1000] ${isOpen ? 'visible' : 'invisible'}`}>
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute top-0 bottom-0 w-[70vw] sm:w-72 bg-white transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${lang === 'ar' ? 'right-0' : 'left-0'} py-8 pl-6 pr-6 flex flex-col shadow-2xl ${isOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`}>
        
        <div className="flex flex-col gap-4 mb-4 flex-shrink-0">
          <div className={`flex ${lang === 'ar' ? 'justify-end' : 'justify-start'} px-4`}>
             <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-full transition-all hover:rotate-90"><ICONS.Close /></button>
          </div>
          
          <div className="w-full flex justify-start -mr-3 select-none px-2">
             <AmanahLogo className="w-full h-auto drop-shadow-sm opacity-90" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-2 py-2">
           {menuItems.map((item) => {
             const isActive = location.pathname === item.path;
             return (
               <button 
                 key={item.path} 
                 onClick={() => { navigate(item.path); onClose(); }} 
                 className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all duration-300 group relative overflow-hidden ${
                   isActive 
                     ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                     : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'
                 }`}
               >
                 {isActive && <div className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-0 bottom-0 w-1.5 bg-indigo-600 rounded-r-full`}></div>}
                 <span className={`text-xl transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-50'}`}>
                   {item.icon}
                 </span>
                 <span className="font-black text-sm">{item.label}</span>
               </button>
             );
           })}
        </div>

        <div className="pt-6 px-4 mt-auto border-t border-slate-100 flex-shrink-0">
          <button 
             onClick={() => { navigate('/settings'); onClose(); }}
             className={`w-full flex items-center gap-4 p-5 rounded-[2rem] transition-all bg-slate-900 text-white shadow-xl shadow-slate-900/20 active:scale-95 hover:bg-black group`}
           >
             <span className="text-xl text-indigo-400 group-hover:rotate-45 transition-transform duration-500"><ICONS.Settings /></span>
             <span className="font-black text-sm">{t.settings}</span>
           </button>
        </div>

      </div>
    </div>
  );
};

const NavLink: React.FC<{ to: string, icon: any, label: string }> = ({ to, icon, label }) => {
  const navigate = useNavigate();
  const isActive = useLocation().pathname === to;
  return (
    <button onClick={() => navigate(to)} className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-indigo-600 -translate-y-1' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`p-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-indigo-50 shadow-inner' : 'hover:bg-slate-50'}`}>{icon}</div>
      <span className={`text-[9px] font-black transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
    </button>
  );
};

export default App;
