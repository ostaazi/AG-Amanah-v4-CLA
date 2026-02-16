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
import { ICONS, AmanahLogo, AmanahShield } from './constants';
import { getImagesFromDB, saveImageToDB, saveBulkImagesToDB, deleteImageFromDB, overrideLibraryDB } from './services/storageService';
import { MY_DESIGNED_ASSETS, FALLBACK_ASSETS } from './assets';

const App: React.FC = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<MonitoringAlert | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<MonitoringAlert | null>(null);

  // --- مكتبة الصور (Persistent Library via IndexedDB) ---
  const [avatarLibrary, setAvatarLibrary] = useState<string[]>([]);

  // تحميل المكتبة عند بدء التطبيق + حقن الصور الخاصة
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const storedImages = await getImagesFromDB();
        
        // تجميع الصور الافتراضية وصورك الخاصة من ملف assets.ts
        let initialImages = [...FALLBACK_ASSETS.DEFAULTS];

        // إضافة صورك الخاصة للمكتبة إذا وجدت
        if (MY_DESIGNED_ASSETS.ADMIN_AVATAR) initialImages.unshift(MY_DESIGNED_ASSETS.ADMIN_AVATAR);
        if (MY_DESIGNED_ASSETS.CHILD_AVATAR) initialImages.unshift(MY_DESIGNED_ASSETS.CHILD_AVATAR);
        if (MY_DESIGNED_ASSETS.LIBRARY_ICONS.length > 0) {
            initialImages = [...MY_DESIGNED_ASSETS.LIBRARY_ICONS, ...initialImages];
        }

        if (storedImages.length > 0) {
          // دمج الصور المخزنة مع الصور الثابتة (بدون تكرار)
          const combined = Array.from(new Set([...initialImages, ...storedImages]));
          setAvatarLibrary(combined);
        } else {
          setAvatarLibrary(initialImages);
          // حفظ الأساسيات في القاعدة لتوحيد المصدر مستقبلاً
          await saveBulkImagesToDB(initialImages);
        }
      } catch (error) {
        console.error("Failed to load library:", error);
      }
    };
    loadLibrary();
  }, []);

  const handleAddToLibrary = async (url: string) => {
    if (!avatarLibrary.includes(url)) {
      setAvatarLibrary(prev => [url, ...prev]);
      try {
        await saveImageToDB(url);
      } catch (e) {
        console.error("Save error:", e);
      }
    }
  };

  const handleAddBulkToLibrary = async (urls: string[]) => {
    const newUrls = urls.filter(url => !avatarLibrary.includes(url));
    if (newUrls.length > 0) {
      setAvatarLibrary(prev => [...newUrls, ...prev]);
      try {
        await saveBulkImagesToDB(newUrls);
      } catch (e) {
        console.error("Bulk save error:", e);
      }
    }
  };

  const handleRemoveFromLibrary = async (index: number) => {
    const urlToRemove = avatarLibrary[index];
    setAvatarLibrary(prev => prev.filter((_, i) => i !== index));
    try {
      await deleteImageFromDB(urlToRemove);
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  // وظيفة إعادة ترتيب المكتبة (تحديث الواجهة + تحديث القاعدة)
  const handleReorderLibrary = async (newOrder: string[]) => {
    setAvatarLibrary(newOrder);
    try {
      await overrideLibraryDB(newOrder);
    } catch (e) {
      console.error("Reorder save error:", e);
    }
  };

  // حساب المسؤول (يستخدم صورك الخاصة كأولوية)
  const [currentUser, setCurrentUser] = useState<ParentAccount>({
    id: 'p1', 
    name: 'محمد العتيبي', 
    role: 'ADMIN', 
    avatar: MY_DESIGNED_ASSETS.ADMIN_AVATAR || FALLBACK_ASSETS.ADMIN
  });

  const [supervisors, setSupervisors] = useState<ParentAccount[]>([]);

  // بيانات الأطفال (يستخدم صورك الخاصة كأولوية)
  const [children, setChildren] = useState<Child[]>([
    {
      id: 'c1',
      name: 'أحمد',
      avatar: MY_DESIGNED_ASSETS.CHILD_AVATAR || FALLBACK_ASSETS.CHILD,
      age: 12,
      status: 'online',
      deviceModel: 'iPhone 15 Pro',
      batteryLevel: 82,
      signalStrength: 4,
      screenTimeLimit: 300,
      currentScreenTime: 185,
      location: { lat: 24.7136, lng: 46.6753, address: 'حي الملقا، الرياض', lastUpdated: new Date() },
      deviceLocked: false, cameraBlocked: false, micBlocked: false, preventAppInstall: true,
      appUsage: [
        { id: 'a1', appName: 'Discord', icon: '👾', minutesUsed: 120, isBlocked: false, category: 'social', lastUsed: new Date() },
        { id: 'a2', appName: 'WhatsApp', icon: '💬', minutesUsed: 45, isBlocked: false, category: 'social', lastUsed: new Date() },
      ],
      callLogs: [],
      psychProfile: {
        moodScore: 62, dominantEmotion: 'قلق مرتفع', anxietyLevel: 78, isolationRisk: 55,
        futurePrediction: 'احتمالية عالية للانسحاب الاجتماعي نتيجة ضغوط خارجية مرصودة.',
        recentKeywords: ['لماذا', 'تهديد', 'خوف', 'صور'],
        recommendation: 'تفعيل بروتوكول الحوار المباشر؛ الطفل يتعرض لضغط خارجي عبر ديسكورد.',
        lastAnalysisDate: new Date()
      }
    }
  ]);

  // تنبيهات الطوارئ المحاكية
  const [alerts] = useState<MonitoringAlert[]>([
    {
      id: 'AL-8821', childName: 'أحمد', platform: 'Discord', content: 'أرسل لي صورتك الآن وإلا سأخبر الجميع بسرك',
      category: Category.BLACKMAIL, severity: AlertSeverity.CRITICAL, timestamp: new Date(),
      aiAnalysis: 'رصد محاولة ابتزاز صريحة واستدراج (Grooming) لتبادل صور خاصة. تم التداخل الآلي لعزل الجهاز.',
      actionTaken: 'قفل فوري وعزل الأدلة', latency: '0.1245ms', suspectId: 'N9I3WD'
    }
  ]);

  // خزنة الأدلة الجنائية (محاكاة كاملة)
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

  const handleNewAlert = (alert: MonitoringAlert) => {
    setActiveToast(alert);
    if (alert.severity === AlertSeverity.CRITICAL) setEmergencyAlert(alert);
  };

  const handleUpdateDevice = (childId: string, updates: Partial<Child>) => {
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, ...updates } : c));
  };

  const handleToggleAppBlock = (childId: string, appId: string) => {
    setChildren(prev => prev.map(c => {
      if (c.id !== childId) return c;
      return {
        ...c,
        appUsage: c.appUsage.map(app => app.id === appId ? { ...app, isBlocked: !app.isBlocked } : app)
      };
    }));
  };

  // --- دوال الإضافة الجديدة ---
  const handleAddChild = (name: string, age: number, avatar: string) => {
    const newChild: Child = {
      id: `child-${Date.now()}`,
      name,
      age,
      avatar: avatar || 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
      status: 'offline',
      deviceModel: 'Not Connected',
      batteryLevel: 100,
      signalStrength: 0,
      screenTimeLimit: 120,
      currentScreenTime: 0,
      deviceLocked: false,
      cameraBlocked: false,
      micBlocked: false,
      preventAppInstall: false,
      appUsage: [],
      callLogs: []
    };
    setChildren([...children, newChild]);
  };

  const handleAddSupervisor = (name: string, avatar?: string) => {
    const newSupervisor: ParentAccount = {
      id: `sup-${Date.now()}`,
      name: name,
      role: 'SUPERVISOR',
      avatar: avatar || 'https://cdn-icons-png.flaticon.com/512/6024/6024190.png'
    };
    setSupervisors([...supervisors, newSupervisor]);
  };

  // --- دوال الحذف الجديدة ---
  const handleDeleteChild = (id: string) => {
    setChildren(prev => prev.filter(c => c.id !== id));
  };

  const handleDeleteSupervisor = (id: string) => {
    setSupervisors(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateMember = (id: string, currentType: 'CHILD' | 'SUPERVISOR' | 'ADMIN', updates: any) => {
    if (updates.role && updates.role !== currentType) {
      const newRole = updates.role;
      if (currentType === 'CHILD' && newRole === 'SUPERVISOR') {
        const child = children.find(c => c.id === id);
        if (child) {
          setChildren(prev => prev.filter(c => c.id !== id));
          setSupervisors(prev => [...prev, { id: child.id, name: child.name, avatar: child.avatar, role: 'SUPERVISOR' }]);
        }
      }
      else if (currentType === 'SUPERVISOR' && newRole === 'CHILD') {
        const supervisor = supervisors.find(s => s.id === id);
        if (supervisor) {
          setSupervisors(prev => prev.filter(s => s.id !== id));
          setChildren(prev => [...prev, {
            id: supervisor.id,
            name: supervisor.name,
            avatar: supervisor.avatar,
            age: 10,
            status: 'offline',
            deviceModel: 'New Device',
            batteryLevel: 100,
            signalStrength: 4,
            screenTimeLimit: 120,
            currentScreenTime: 0,
            deviceLocked: false,
            cameraBlocked: false,
            micBlocked: false,
            preventAppInstall: false,
            appUsage: [],
            callLogs: []
          }]);
        }
      }
      return;
    }

    if (currentType === 'CHILD') {
      setChildren(prev => prev.map(child => child.id === id ? { ...child, ...updates } : child));
    } else if (currentType === 'SUPERVISOR') {
      setSupervisors(prev => prev.map(sup => sup.id === id ? { ...sup, ...updates } : sup));
    } else if (currentType === 'ADMIN') {
      if (currentUser.id === id) {
        setCurrentUser(prev => ({ ...prev, ...updates }));
      }
    }
  };

  const showSuccessToast = (msg: string) => {
    setActiveToast({
        id: 'TOAST-'+Date.now(), category: Category.SAFE, severity: AlertSeverity.LOW, childName: 'System',
        platform: 'Amanah', content: msg, aiAnalysis: msg, timestamp: new Date()
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo']" dir="rtl">
      <SystemStatusBar hasCriticalAlert={true} alertCount={1} />
      <header className="fixed top-7 left-0 right-0 h-20 px-6 flex items-center justify-between z-[100] bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-500">
        <div className="flex items-center gap-4">
           <div className="relative group cursor-pointer">
             <div className="absolute inset-0 bg-indigo-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
             <img src={currentUser.avatar} className="w-12 h-12 rounded-full shadow-lg border-2 border-white object-cover relative z-10 transition-transform group-hover:scale-105" />
             <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-100 z-20">
               <AmanahShield className="w-4 h-4" />
             </div>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المسؤول</p>
              <p className="text-sm font-black text-slate-800">{currentUser.name}</p>
           </div>
        </div>
        <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-white/80 rounded-[2rem] shadow-lg border border-white hover:scale-105 hover:shadow-xl transition-all active:scale-95 text-slate-700 hover:text-indigo-600"><ICONS.Menu /></button>
      </header>

      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <main className="pt-32 px-6 pb-40 max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} />} />
          <Route path="/devices" element={<DevicesView children={children} onUpdateDevice={handleUpdateDevice} onToggleAppBlock={handleToggleAppBlock} />} />
          <Route path="/map" element={<MapView children={children} />} />
          <Route path="/alerts" element={<AlertsView alerts={alerts} theme="light" />} />
          <Route path="/vault" element={<EvidenceVaultView records={evidenceRecords} currentUser={currentUser} />} />
          <Route path="/pulse" element={<PsychologicalInsightView child={children[0]} theme="light" onAcceptPlan={() => {}} />} />
          <Route path="/simulator" element={<SimulatorView children={children} onNewAlert={handleNewAlert} />} />
          <Route path="/modes" element={<ModesView modes={modes} children={children} onUpdateModes={setModes} onApplyMode={() => {}} />} />
          <Route path="/live" element={<LiveMonitorView children={children} lang={lang} />} />
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
         <NavLink to="/" icon={<ICONS.Dashboard />} label="الرئيسية" />
         <NavLink to="/vault" icon={<ICONS.Vault />} label="الخزنة" />
         <NavLink to="/pulse" icon={<ICONS.Pulse />} label="النبض" />
         <NavLink to="/simulator" icon={<ICONS.Rocket />} label="المحاكي" />
      </nav>

      {emergencyAlert && <EmergencyOverlay alert={emergencyAlert} onClose={() => setEmergencyAlert(null)} onAction={() => navigate('/vault')} />}
      {activeToast && <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />}
    </div>
  );
};

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'لوحة التحكم', icon: <ICONS.Dashboard /> },
    { path: '/devices', label: 'الأجهزة المتصلة', icon: <ICONS.Devices /> },
    { path: '/map', label: 'الخريطة الجغرافية', icon: <ICONS.Location /> },
    { path: '/alerts', label: 'سجل التنبيهات', icon: <ICONS.Shield /> },
    { path: '/simulator', label: 'محاكي التهديد', icon: <ICONS.Rocket /> },
    { path: '/modes', label: 'الأوضاع الذكية', icon: <ICONS.WalkieTalkie /> },
    { path: '/live', label: 'البث المباشر', icon: <ICONS.LiveCamera /> },
    { path: '/vault', label: 'خزنة الأدلة', icon: <ICONS.Vault /> },
    { path: '/pulse', label: 'النبض النفسي', icon: <ICONS.Pulse /> },
  ];

  return (
    <div className={`fixed inset-0 z-[1000] ${isOpen ? 'visible' : 'invisible'}`}>
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute top-0 bottom-0 w-[70vw] sm:w-72 bg-white transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) right-0 py-8 pl-6 pr-0 flex flex-col shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="flex flex-col gap-4 mb-4 flex-shrink-0">
          <div className="flex justify-end px-4">
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
                 {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 rounded-r-full"></div>}
                 <span className={`text-xl transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
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
             <span className="font-black text-sm">الإعدادات المتقدمة</span>
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