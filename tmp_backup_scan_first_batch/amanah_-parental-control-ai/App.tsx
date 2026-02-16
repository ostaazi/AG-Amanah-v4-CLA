
import React, { useState } from 'react';
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

const App: React.FC = () => {
  const navigate = useNavigate();
  const [lang] = useState<'ar' | 'en'>('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<MonitoringAlert | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<MonitoringAlert | null>(null);

  // حساب المسؤول
  const [currentUser] = useState<ParentAccount>({
    id: 'p1', name: 'محمد العتيبي', role: 'ADMIN', avatar: 'https://i.pravatar.cc/150?u=father'
  });

  // بيانات الأطفال الشاملة (محاكاة فعلية)
  const [children] = useState<Child[]>([
    {
      id: 'c1',
      name: 'أحمد',
      avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo']" dir="rtl">
      <SystemStatusBar hasCriticalAlert={true} alertCount={1} />
      <header className="fixed top-7 left-0 right-0 h-20 px-6 flex items-center justify-between z-[100] bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="flex items-center gap-4">
           {/* صورة المستخدم + درع أمانة المصغر */}
           <div className="relative">
             <img src={currentUser.avatar} className="w-12 h-12 rounded-full shadow-lg border-2 border-white object-cover" />
             <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-100">
               <AmanahShield className="w-4 h-4" />
             </div>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase">المسؤول</p>
              <p className="text-sm font-black text-slate-800">{currentUser.name}</p>
           </div>
        </div>
        <button onClick={() => setIsMenuOpen(true)} className="p-4 bg-white/80 rounded-[2rem] shadow-xl border border-white hover:scale-105 transition-transform"><ICONS.Menu /></button>
      </header>

      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <main className="pt-32 px-6 pb-40 max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={<DashboardView children={children} alerts={alerts} onTriggerDemo={() => navigate('/simulator')} />} />
          <Route path="/vault" element={<EvidenceVaultView records={evidenceRecords} currentUser={currentUser} />} />
          <Route path="/pulse" element={<PsychologicalInsightView child={children[0]} theme="light" onAcceptPlan={() => {}} />} />
          <Route path="/simulator" element={<SimulatorView children={children} onNewAlert={handleNewAlert} />} />
          <Route path="/modes" element={<ModesView modes={modes} children={children} onUpdateModes={setModes} onApplyMode={() => {}} />} />
        </Routes>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-white/90 backdrop-blur-3xl rounded-[3rem] border border-white shadow-2xl px-8 py-4 z-[200] flex justify-between items-center">
         <NavLink to="/" icon={<ICONS.Dashboard />} label="الرئيسية" />
         <NavLink to="/vault" icon={<ICONS.Vault />} label="الخزنة" />
         <NavLink to="/pulse" icon={<span className="text-xl">🧠</span>} label="النبض" />
         <NavLink to="/simulator" icon={<span className="text-xl">🔬</span>} label="المحاكي" />
      </nav>

      {emergencyAlert && <EmergencyOverlay alert={emergencyAlert} onClose={() => setEmergencyAlert(null)} onAction={() => navigate('/vault')} />}
      {activeToast && <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />}
    </div>
  );
};

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  return (
    <div className={`fixed inset-0 z-[1000] ${isOpen ? 'visible' : 'invisible'}`}>
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute top-0 bottom-0 w-80 bg-white transition-transform right-0 p-10 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-8 mb-10">
          <div className="flex justify-between items-start">
             <button onClick={onClose} className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors"><ICONS.Close /></button>
          </div>
          {/* تم تكبير الحاوية هنا من w-32 إلى w-56 ليظهر اللوجو بوضوح */}
          <div className="w-56 self-center">
            <AmanahLogo />
          </div>
        </div>
        <div className="space-y-4">
           {['/', '/vault', '/pulse', '/simulator'].map(p => (
             <button key={p} onClick={() => { navigate(p); onClose(); }} className="w-full text-right p-4 rounded-2xl hover:bg-slate-50 font-bold text-slate-700 active:scale-95 transition-all">
               {p === '/' ? 'لوحة التحكم' : p === '/vault' ? 'خزنة الأدلة' : p === '/pulse' ? 'النبض النفسي' : 'محاكي التهديد'}
             </button>
           ))}
        </div>
      </div>
    </div>
  );
};

const NavLink: React.FC<{ to: string, icon: any, label: string }> = ({ to, icon, label }) => {
  const navigate = useNavigate();
  const isActive = useLocation().pathname === to;
  return (
    <button onClick={() => navigate(to)} className={`flex flex-col items-center gap-1 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
      <div className={`p-3 rounded-2xl ${isActive ? 'bg-indigo-50' : ''}`}>{icon}</div>
      <span className="text-[9px] font-black">{label}</span>
    </button>
  );
};

export default App;
