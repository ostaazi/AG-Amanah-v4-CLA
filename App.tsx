import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Child,
  MonitoringAlert,
  ParentAccount,
  AlertSeverity,
  Category,
  UserRole,
  CustomMode,
  PairingRequest,
  ProactiveDefenseConfig,
} from './types';

// استيراد المكونات من مساراتها الصحيحة داخل components/
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
import DevLabView from './components/DevLabView';
import ProactiveDefenseView from './components/ProactiveDefenseView';
import IncidentsCenterView from './components/IncidentsCenterView';
import DeviceEnrollmentView from './components/DeviceEnrollmentView';
import FamilyRolesView from './components/FamilyRolesView';
import AdvisorView from './components/AdvisorView';
import SystemStatusBar from './components/SystemStatusBar';
import NotificationToast from './components/NotificationToast';
import EmergencyOverlay from './components/EmergencyOverlay';
import AuthView from './components/AuthView';
import { ProtectedRoute } from './components/ProtectedRoute';
import IncidentWarRoom from './components/IncidentWarRoom';
import ChainOfCustodyView from './components/ChainOfCustodyView';
import SystemSecurityReportView from './components/SystemSecurityReportView';
import VisualBenchmarkView from './components/VisualBenchmarkView';
import SafetyPlaybookHub from './components/SafetyPlaybookHub';
import ParentOpsConsoleView from './components/parent/ParentOpsConsoleView';
import CommandCenter from './components/CommandCenter';
import DeveloperResolutionHub from './components/DeveloperResolutionHub';

import { ICONS, AmanahLogo, AdminShieldBadge, AmanahGlobalDefs, AmanahShield } from './constants';
import { subscribeToAuthChanges, logoutUser } from './services/authService';
import { auth } from './services/firebaseConfig';
import {
  syncParentProfile,
  updateMemberInDB,
  deleteMemberFromDB,
  addChildToDB,
  subscribeToChildren,
  subscribeToAlerts,
  logUserActivity,
  inviteSupervisor,
  saveAlertToDB,
  subscribeToPairingRequests,
  approvePairingRequest,
  rejectPairingRequest,
  sendRemoteCommand,
  backfillChildDeviceOwnership,
  rotatePairingKey,
} from './services/firestoreService';
import { buildPulseExecutionEvidenceAlert } from './services/pulseExecutionEvidenceService';
import { translations } from './translations';
import { MY_DESIGNED_ASSETS, FALLBACK_ASSETS } from './assets';
import { FEATURE_FLAGS } from './config/featureFlags';

// تعريف المكونات الفرعية داخل الملف لضمان عملها
const NavLink: React.FC<{ to: string; icon: any; label: string }> = ({ to, icon, label }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center justify-center min-w-[65px] p-2 rounded-2xl transition-all ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <div className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform`}>{icon}</div>
      <span
        className={`text-[9px] font-black mt-1 uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}
      >
        {label}
      </span>
    </button>
  );
};

const Sidebar: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  menuItems: any[];
}> = ({ isOpen, onClose, lang, menuItems }) => {
  const navigate = useNavigate();
  return (
    <div
      className={`fixed inset-0 z-[6000] transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div
        className={`absolute top-0 bottom-0 w-80 bg-white shadow-2xl transition-transform duration-500 flex flex-col ${lang === 'ar' ? (isOpen ? 'right-0' : 'right-[-100%]') : isOpen ? 'left-0' : 'left-[-100%]'}`}
      >
        <div className="p-10 pb-6 border-b border-slate-50 flex justify-between items-center">
          <div className="w-24">
            <AmanahLogo />
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 hover:rotate-90 transition-all"
          >
            <ICONS.Close />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2 text-right">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                onClose();
              }}
              className="w-full flex items-center gap-6 p-5 rounded-[2rem] hover:bg-indigo-50 transition-all text-right group active:scale-95"
            >
              <div className="text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all">
                {item.icon}
              </div>
              <span className="font-black text-slate-700 group-hover:text-indigo-600">
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <div className="p-8 border-t border-slate-50 bg-slate-50/50">
          <button
            onClick={() => {
              logoutUser();
              onClose();
            }}
            className="w-full py-5 bg-white text-red-600 rounded-3xl font-black text-sm uppercase tracking-widest border border-red-50 flex items-center justify-center gap-3 shadow-sm hover:bg-red-50 transition-all"
          >
            🗑️ تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
};

const PairingRequestModal: React.FC<{
  requests: PairingRequest[];
  onApprove: (request: PairingRequest) => void;
  onReject: (requestId: string) => void;
  lang: 'ar' | 'en';
}> = ({ requests, onApprove, onReject, lang }) => {
  if (requests.length === 0) return null;
  const current = requests[0];
  const t = lang === 'ar' ? {
    title: 'طلب ربط جديد 🛡️',
    desc: 'يرغب جهاز جديد في الانضمام إلى نظام الأمان الخاص بك.',
    device: 'الجهاز:',
    model: 'الموديل:',
    approve: 'موافقة',
    reject: 'رفض',
  } : {
    title: 'New Pairing Request 🛡️',
    desc: 'A new device wants to join your security system.',
    device: 'Device:',
    model: 'Model:',
    approve: 'Approve',
    reject: 'Reject',
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 border border-white/20 transform animate-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 scale-110 shadow-inner">
            <ICONS.Devices className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 brand-font">{t.title}</h2>
          <p className="text-sm text-slate-500 font-bold mb-6">{t.desc}</p>

          <div className="w-full bg-slate-50 rounded-2xl p-5 mb-8 text-right space-y-2 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="font-black text-indigo-600"> {current.childName}</span>
              <span className="text-slate-400 font-bold">{t.device}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-black text-slate-700">{current.model}</span>
              <span className="text-slate-400 font-bold">{t.model}</span>
            </div>
          </div>

          <div className="w-full flex gap-4">
            <button
              onClick={() => onApprove(current)}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
            >
              ✅ {t.approve}
            </button>
            <button
              onClick={() => onReject(current.id)}
              className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all"
            >
              ❌ {t.reject}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const IntegrationPlaceholder: React.FC<{
  title: string;
  subtitle: string;
}> = ({ title, subtitle }) => (
  <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-10 text-center space-y-4">
    <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl">
      🧩
    </div>
    <h3 className="text-2xl font-black text-slate-900">{title}</h3>
    <p className="text-sm font-bold text-slate-500 max-w-xl mx-auto leading-relaxed">{subtitle}</p>
  </div>
);

const App: React.FC = () => {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const location = useLocation();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<MonitoringAlert | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<MonitoringAlert | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [currentUser, setCurrentUser] = useState<ParentAccount>({
    id: 'guest',
    name: 'الوالد',
    role: 'ADMIN',
    avatar: MY_DESIGNED_ASSETS.ADMIN_AVATAR || FALLBACK_ASSETS.ADMIN,
    alertProtocol: 'FULL',
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [modes, setModes] = useState<CustomMode[]>([
    {
      id: 'm1',
      name: 'وقت المذاكرة',
      icon: '📚',
      color: 'bg-indigo-600',
      allowedApps: ['Educational'],
      allowedUrls: [],
      blacklistedUrls: ['tiktok.com'],
      cameraEnabled: false,
      micEnabled: true,
      isInternetCut: false,
      isScreenDimmed: false,
      isDeviceLocked: false,
      internetStartTime: '08:00',
      internetEndTime: '14:00',
      activeDays: [0, 1, 2, 3, 4],
    },
    {
      id: 'm2',
      name: 'وقت النوم',
      icon: '🌙',
      color: 'bg-slate-900',
      allowedApps: [],
      allowedUrls: [],
      blacklistedUrls: [],
      cameraEnabled: false,
      micEnabled: false,
      isInternetCut: true,
      isScreenDimmed: true,
      isDeviceLocked: true,
      internetStartTime: '21:00',
      internetEndTime: '07:00',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    },
  ]);

  const handleAcceptSuggestedMode = (plan: Partial<CustomMode>) => {
    const nextMode: CustomMode = {
      id: plan.id || `mode-${Date.now()}`,
      name: plan.name || (lang === 'ar' ? 'وضع مخصص' : 'Custom Mode'),
      icon: plan.icon || '🛡️',
      color: plan.color || 'bg-indigo-700',
      allowedApps: plan.allowedApps || [],
      allowedUrls: plan.allowedUrls || [],
      blacklistedUrls: plan.blacklistedUrls || [],
      cameraEnabled: plan.cameraEnabled ?? false,
      micEnabled: plan.micEnabled ?? true,
      isInternetCut: plan.isInternetCut ?? false,
      isScreenDimmed: plan.isScreenDimmed ?? false,
      isDeviceLocked: plan.isDeviceLocked ?? false,
      internetStartTime: plan.internetStartTime || '06:00',
      internetEndTime: plan.internetEndTime || '22:00',
      activeDays: plan.activeDays || [0, 1, 2, 3, 4, 5, 6],
      preferredVideoSource: plan.preferredVideoSource || 'screen',
      preferredAudioSource: plan.preferredAudioSource || 'mic',
      autoStartLiveStream: plan.autoStartLiveStream ?? false,
      autoTakeScreenshot: plan.autoTakeScreenshot ?? false,
    };

    setModes((prev) =>
      prev.some((mode) => mode.id === nextMode.id)
        ? prev.map((mode) => (mode.id === nextMode.id ? nextMode : mode))
        : [...prev, nextMode]
    );
    return nextMode.id;
  };

  const handlePlanExecutionResult = (summary: { done: number; failed: number; skipped: number }) => {
    setActiveToast({
      id: `plan-run-${Date.now()}`,
      childName: 'System',
      platform: 'Digital Balance',
      content:
        lang === 'ar'
          ? `انتهى التنفيذ التلقائي: ${summary.done} تم، ${summary.skipped} تخطي، ${summary.failed} فشل.`
          : `Auto execution finished: ${summary.done} done, ${summary.skipped} skipped, ${summary.failed} failed.`,
      category: Category.SAFE,
      severity: summary.failed > 0 ? AlertSeverity.MEDIUM : AlertSeverity.LOW,
      timestamp: new Date(),
      aiAnalysis:
        lang === 'ar'
          ? 'تم تسجيل نتيجة تشغيل خطوات خطة التوازن الرقمي.'
      : 'Digital balance auto-execution summary was logged.',
    });
  };

  const handleSaveExecutionEvidence = async (payload: {
    childId: string;
    childName: string;
    scenarioId: string;
    scenarioTitle: string;
    severity: AlertSeverity;
    dominantPlatform: string;
    summary: { done: number; failed: number; skipped: number };
    timeline: Array<{ title: string; detail: string; status: 'done' | 'error' | 'skipped' | 'info'; at: string }>;
  }) => {
    const parentId = auth?.currentUser?.uid || currentUser.id;
    if (!parentId || parentId === 'guest') {
      throw new Error('Missing parent account id for evidence save');
    }

    const { compactSummary, alertData } = buildPulseExecutionEvidenceAlert(payload, lang);

    const recordId = await saveAlertToDB(parentId, alertData);

    if (!recordId) {
      throw new Error('Failed to persist evidence record');
    }

    setActiveToast({
      id: `pulse-vault-${Date.now()}`,
      childName: payload.childName,
      platform: 'Evidence Vault',
      content:
        lang === 'ar'
          ? 'تم حفظ سجل تنفيذ الخطة داخل الخزنة الجنائية.'
          : 'Execution timeline saved to forensic vault.',
      category: Category.SAFE,
      severity: AlertSeverity.LOW,
      timestamp: new Date(),
      aiAnalysis:
        lang === 'ar'
          ? `تم حفظ الدليل بالمعرف ${recordId}.`
          : `Evidence stored with id ${recordId}.`,
    });

    return recordId;
  };

  const handleApplyMode = async (childId: string, modeId?: string) => {
    const targetMode = modes.find((mode) => mode.id === modeId);
    const targetChild = children.find((child) => child.id === childId);
    if (!targetMode || !targetChild) return;

    const allowList = new Set(
      (targetMode.allowedApps || []).map((name) => name.toLowerCase().replace(/\s+/g, ' ').trim())
    );
    const previousBlockByApp = new Map(
      (targetChild.appUsage || []).map((app) => [app.id, !!app.isBlocked])
    );

    const nextAppUsage = (targetChild.appUsage || []).map((app) => {
      const appNameNorm = (app.appName || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const shouldBlock = allowList.size === 0 ? true : !allowList.has(appNameNorm);
      return { ...app, isBlocked: shouldBlock };
    });

    const changedApps = nextAppUsage.filter((app) => previousBlockByApp.get(app.id) !== app.isBlocked);
    const patch: Partial<Child> = {
      deviceLocked: targetMode.isDeviceLocked,
      cameraBlocked: !targetMode.cameraEnabled,
      micBlocked: !targetMode.micEnabled,
      appUsage: nextAppUsage,
    };

    setChildren((prev) => prev.map((child) => (child.id === childId ? { ...child, ...patch } : child)));
    await handleUpdateMember(childId, 'CHILD', patch);

    const commandQueue: Promise<any>[] = [sendRemoteCommand(childId, 'lockDevice', targetMode.isDeviceLocked)];

    if (targetMode.blackoutOnApply) {
      commandQueue.push(
        sendRemoteCommand(childId, 'lockscreenBlackout', {
          enabled: true,
          message:
            targetMode.blackoutMessage ||
            (lang === 'ar'
              ? 'تم قفل الجهاز لدواعي الأمان. يرجى التواصل مع الوالدين.'
              : 'Device locked for safety. Please contact a parent.'),
          source: 'mode_apply',
        })
      );
    }

    if (targetMode.enableWalkieTalkieOnApply) {
      commandQueue.push(
        sendRemoteCommand(childId, 'walkieTalkieEnable', {
          enabled: true,
          source: targetMode.preferredAudioSource || 'mic',
          sourceTag: 'mode_apply',
        })
      );
    }

    for (const app of changedApps) {
      commandQueue.push(
        sendRemoteCommand(childId, 'blockApp', {
          appId: app.id,
          appName: app.appName,
          blocked: app.isBlocked,
          isBlocked: app.isBlocked,
          reason: 'mode_apply',
        })
      );
    }

    if (targetMode.autoTakeScreenshot) {
      commandQueue.push(sendRemoteCommand(childId, 'takeScreenshot', true));
    }

    if (targetMode.preferredVideoSource) {
      commandQueue.push(sendRemoteCommand(childId, 'setVideoSource', targetMode.preferredVideoSource));
    }

    if (targetMode.preferredAudioSource) {
      commandQueue.push(sendRemoteCommand(childId, 'setAudioSource', targetMode.preferredAudioSource));
    }

    if (targetMode.autoStartLiveStream) {
      commandQueue.push(
        sendRemoteCommand(childId, 'startLiveStream', {
          videoSource: targetMode.preferredVideoSource || 'screen',
          audioSource: targetMode.preferredAudioSource || 'mic',
          source: 'mode_apply',
        })
      );
    }

    const commandResults = await Promise.allSettled(commandQueue);
    const failedCommands = commandResults.filter((result) => result.status === 'rejected').length;

    setActiveToast({
      id: `apply-mode-${Date.now()}`,
      childName: targetChild.name,
      platform: 'Modes',
      content:
        lang === 'ar'
          ? `تم تطبيق وضع "${targetMode.name}" على ${targetChild.name}.`
          : `Mode "${targetMode.name}" was applied to ${targetChild.name}.`,
      category: Category.SAFE,
      severity: failedCommands > 0 ? AlertSeverity.MEDIUM : AlertSeverity.LOW,
      timestamp: new Date(),
      aiAnalysis:
        failedCommands > 0
          ? lang === 'ar'
            ? `نجح ${commandQueue.length - failedCommands} أمر وفشل ${failedCommands}.`
            : `${commandQueue.length - failedCommands} commands succeeded and ${failedCommands} failed.`
          : lang === 'ar'
            ? 'تم تنفيذ جميع أوامر الوضع بنجاح.'
            : 'All mode commands executed successfully.',
    });
  };

  const t = translations[lang];

  const menuItems = useMemo(() => {
    const items: Array<{ path: string; label: string; icon: React.ReactNode }> = [];

    if (FEATURE_FLAGS.dashboard) items.push({ path: '/', label: t.dashboard, icon: <ICONS.Dashboard /> });
    if (FEATURE_FLAGS.alerts) items.push({ path: '/alerts', label: t.alerts, icon: <ICONS.Shield /> });
    if (FEATURE_FLAGS.advancedDefense) {
      items.push({ path: '/defense', label: t.advancedDefense, icon: <ICONS.Shield /> });
    }
    if (FEATURE_FLAGS.incidentCenter) {
      items.push({ path: '/incidents', label: t.incidents, icon: <ICONS.Dashboard /> });
    }
    if (FEATURE_FLAGS.deviceEnrollment) {
      items.push({ path: '/enrollment', label: t.enrollment, icon: <ICONS.Devices /> });
    }
    if (FEATURE_FLAGS.familyRoles) {
      items.push({ path: '/family-roles', label: t.familyRoles, icon: <ICONS.Settings /> });
    }
    if (FEATURE_FLAGS.advisor) {
      items.push({ path: '/advisor', label: t.advisor, icon: <ICONS.Pulse /> });
    }
    if (FEATURE_FLAGS.incidentWarRoom) {
      items.push({ path: '/war-room', label: t.warRoom, icon: <ICONS.ShieldCheck /> });
    }
    if (FEATURE_FLAGS.playbookHub) {
      items.push({ path: '/playbooks', label: t.playbookHub, icon: <ICONS.Command /> });
    }
    if (FEATURE_FLAGS.parentOpsConsole) {
      items.push({ path: '/parent-ops', label: t.parentOps, icon: <ICONS.Command /> });
    }
    if (FEATURE_FLAGS.commandCenter && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR')) {
      items.push({ path: '/command-center', label: t.commandCenter, icon: <ICONS.Command /> });
    }
    if (FEATURE_FLAGS.forensics) {
      items.push({ path: '/custody', label: t.custodyChain, icon: <ICONS.Chain /> });
      items.push({ path: '/security-report', label: t.securityReport, icon: <ICONS.ShieldCheck /> });
      items.push({ path: '/benchmark', label: t.benchmark, icon: <ICONS.Rocket /> });
    }
    if (FEATURE_FLAGS.modes) items.push({ path: '/modes', label: t.modes, icon: <ICONS.Pulse /> });
    if (FEATURE_FLAGS.evidenceVault) items.push({ path: '/vault', label: t.vault, icon: <ICONS.Vault /> });
    if (FEATURE_FLAGS.psychologicalPulse) items.push({ path: '/pulse', label: t.pulse, icon: <ICONS.Pulse /> });
    if (FEATURE_FLAGS.liveMonitor) items.push({ path: '/live', label: t.live, icon: <ICONS.LiveCamera /> });
    if (FEATURE_FLAGS.geoMap) items.push({ path: '/map', label: t.map, icon: <ICONS.Location /> });
    if (FEATURE_FLAGS.devices) items.push({ path: '/devices', label: t.devices, icon: <ICONS.Devices /> });
    if (FEATURE_FLAGS.developerLab && currentUser.role === 'ADMIN') {
      items.push({ path: '/devlab', label: t.devLab, icon: <ICONS.Settings /> });
    }
    if (FEATURE_FLAGS.developerResolutionHub && currentUser.role === 'ADMIN') {
      items.push({ path: '/dev-resolution', label: t.developerResolution, icon: <ICONS.Settings /> });
    }
    if (FEATURE_FLAGS.simulator) items.push({ path: '/simulator', label: t.simulator, icon: <ICONS.Rocket /> });
    items.push({ path: '/settings', label: t.settings, icon: <ICONS.Settings /> });

    return items;
  }, [t, currentUser.role]);

  const handleUpdateMember = async (id: string, role: UserRole, updates: any) => {
    try {
      await updateMemberInDB(id, role, updates);
      if (id === currentUser.id) {
        setCurrentUser((prev) => ({ ...prev, ...updates }));
      }
      logUserActivity(currentUser.id, {
        action: 'تحديث بيانات',
        details: `تم تحديث إعدادات ${role} بنجاح`,
        type: 'SUCCESS',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateDefense = async (
    childId: string,
    config: ProactiveDefenseConfig
  ) => {
    await handleUpdateMember(childId, 'CHILD', { defenseConfig: config });
  };

  const handleRotatePairingKey = async (): Promise<string | undefined> => {
    try {
      const newKey = await rotatePairingKey(currentUser.id);
      setCurrentUser((prev) => ({
        ...prev,
        pairingKey: newKey,
        pairingKeyExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }));
      setActiveToast({
        id: `pairing-key-${Date.now()}`,
        childName: 'System',
        platform: 'Amanah',
        content: lang === 'ar' ? 'تم تدوير مفتاح الربط بنجاح' : 'Pairing key rotated successfully',
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
        timestamp: new Date(),
        aiAnalysis: lang === 'ar' ? 'تم إنشاء رمز جديد صالح لمدة 10 دقائق.' : 'A new 10-minute key was generated.',
      });
      return newKey;
    } catch (error) {
      console.error('Rotate pairing key failed:', error);
      setActiveToast({
        id: `pairing-key-error-${Date.now()}`,
        childName: 'System',
        platform: 'Amanah',
        content: lang === 'ar' ? 'فشل تدوير مفتاح الربط' : 'Failed to rotate pairing key',
        category: Category.SAFE,
        severity: AlertSeverity.MEDIUM,
        timestamp: new Date(),
        aiAnalysis: lang === 'ar' ? 'تحقق من الصلاحيات أو الاتصال ثم أعد المحاولة.' : 'Check permissions/network and retry.',
      });
      return undefined;
    }
  };

  const handleUpdateDeviceControls = async (childId: string, updates: Partial<Child>) => {
    await handleUpdateMember(childId, 'CHILD', updates);
    const child = children.find((c) => c.id === childId);
    const hasMicOrCameraUpdate =
      Object.prototype.hasOwnProperty.call(updates, 'micBlocked') ||
      Object.prototype.hasOwnProperty.call(updates, 'cameraBlocked');
    const hasPreventInstallUpdate = Object.prototype.hasOwnProperty.call(updates, 'preventAppInstall');

    if (hasMicOrCameraUpdate) {
      const nextMicBlocked = updates.micBlocked ?? child?.micBlocked ?? false;
      const nextCameraBlocked = updates.cameraBlocked ?? child?.cameraBlocked ?? false;
      const shouldBlockHardware = !!(nextMicBlocked || nextCameraBlocked);
      await sendRemoteCommand(childId, 'blockCameraAndMic', shouldBlockHardware);
    }

    if (hasPreventInstallUpdate) {
      setActiveToast({
        id: 'device-cap-' + Date.now(),
        childName: 'Amanah AI',
        platform: 'Device Controls',
        content: 'Partial support',
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
        timestamp: new Date(),
        aiAnalysis:
          'App install prevention depends on Android enterprise/device-owner privileges and may vary by device policy.',
      } as MonitoringAlert);
    }
  };

  const handleToggleAppBlock = async (childId: string, appId: string) => {
    const child = children.find((c) => c.id === childId);
    if (!child) return;

    const nextUsage = (child.appUsage || []).map((app) =>
      app.id === appId ? { ...app, isBlocked: !app.isBlocked } : app
    );

    await handleUpdateMember(childId, 'CHILD', { appUsage: nextUsage });
    const targetApp = nextUsage.find((a) => a.id === appId);
    await sendRemoteCommand(childId, 'blockApp', {
      appId,
      appName: targetApp?.appName || '',
      blocked: !!targetApp?.isBlocked,
      isBlocked: !!targetApp?.isBlocked,
    });
  };

  const handleToggleDeviceLock = async (childId: string, shouldLock: boolean) => {
    if (shouldLock) {
      await handleUpdateMember(childId, 'CHILD', { preventDeviceLock: false });
    }
    await sendRemoteCommand(childId, 'lockDevice', shouldLock);
    await sendRemoteCommand(childId, 'lockscreenBlackout', {
      enabled: shouldLock,
      message: shouldLock
        ? 'تم قفل الجهاز لدواعي الأمان. يرجى التواصل مع الوالدين.'
        : '',
    });
  };

  const handleMinimizeEmergency = (alert: MonitoringAlert) => {
    setEmergencyAlert(null);
    setActiveToast(alert);
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setIsAuthChecking(true);
      if (user) {
        try {
          const { profile } = await syncParentProfile(user.uid, user.email, currentUser);
          setCurrentUser({
            ...profile,
            alertProtocol:
              profile.alertProtocol ||
              (profile.emergencyOverlayEnabled === false ? 'SIMPLE' : 'FULL'),
          });
          setIsAuthenticated(true);
        } catch (e) {
          console.error(e);
        }
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
    const ownerId = auth?.currentUser?.uid;
    if (!isAuthenticated || !ownerId) return;

    backfillChildDeviceOwnership(ownerId).catch((e: any) => {
      const code = e?.code || '';
      const message = String(e?.message || '');
      const isPermissionIssue =
        code === 'permission-denied' || message.includes('Missing or insufficient permissions');

      if (!isPermissionIssue) {
        console.error('Failed to backfill device ownership', e);
      }
    });

    let childLoaded = false;
    let alertsLoaded = false;

    const checkLoading = () => {
      if (childLoaded && alertsLoaded) {
        setTimeout(() => setIsLoadingData(false), 800);
      }
    };

    const unsubChildren = subscribeToChildren(ownerId, (data) => {
      setChildren(data);
      childLoaded = true;
      checkLoading();
    });
    const unsubAlerts = subscribeToAlerts(ownerId, (data) => {
      if (data.length > alerts.length) {
        const latest = data[0];
        const protocol = currentUser.alertProtocol || 'FULL';

        // Logic: Respect User Notification Protocol
        if (protocol !== 'NONE') {
          if (latest.severity === AlertSeverity.CRITICAL && protocol === 'FULL') {
            setEmergencyAlert(latest);
          } else {
            setActiveToast(latest);
          }
        }
      }
      setAlerts(data);
      alertsLoaded = true;
      checkLoading();
    });

    const unsubPairing = subscribeToPairingRequests(ownerId, (data) => {
      setPairingRequests(data);
    });

    // Safety fallback
    const safetyTimer = setTimeout(() => setIsLoadingData(false), 5000);

    return () => {
      unsubChildren();
      unsubAlerts();
      unsubPairing();
      clearTimeout(safetyTimer);
    };
  }, [isAuthenticated, alerts.length, currentUser.alertProtocol]);

  if (isAuthChecking)
    return (
      <div
        className="min-h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden"
        dir="rtl"
      >
        <AmanahGlobalDefs />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center animate-in fade-in duration-1000">
          <div className="w-48 mb-10 transform scale-125">
            <AmanahShield className="w-full h-auto" />
          </div>
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-black text-white tracking-tighter brand-font">
              أمانة • Amanah AI
            </h1>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10 shadow-xl">
                <span className="w-2 h-2 bg-indigo-50 rounded-full animate-ping"></span>
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  System Initialization...
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-40 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-24 animate-loading-slide"></div>
        </div>
      </div>
    );

  if (!isAuthenticated) return <AuthView onLoginSuccess={() => { }} />;

  return (
    <div
      className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo'] relative overflow-x-hidden"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <AmanahGlobalDefs />
      <SystemStatusBar
        hasCriticalAlert={alerts.some((a) => a.severity === AlertSeverity.CRITICAL)}
        alertCount={alerts.length}
      />
      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        lang={lang}
        menuItems={menuItems}
      />

      <header className="fixed top-8 left-0 right-0 h-20 px-6 flex items-center justify-between z-[150] bg-white/80 backdrop-blur-2xl border-b border-slate-100 shadow-sm">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/settings')}
        >
          <div className="relative">
            <img
              src={currentUser.avatar}
              className="w-12 h-12 rounded-full border-2 border-white shadow-md object-cover"
            />
            <div className="absolute -bottom-1 -left-1 w-6 h-6">
              <AdminShieldBadge />
            </div>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">
              Master Admin
            </p>
            <p className="text-xs font-black text-slate-800">{currentUser.name}</p>
          </div>
        </div>
        <div
          className="w-24 cursor-pointer transform hover:scale-105 transition-transform"
          onClick={() => navigate('/')}
        >
          <AmanahLogo />
        </div>
        <button
          onClick={() => setIsMenuOpen(true)}
          className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-90 hover:bg-indigo-600 transition-all"
        >
          <ICONS.Menu className="w-6 h-6" />
        </button>
      </header>

      <main className="pt-40 px-4 pb-48 max-w-7xl mx-auto min-h-screen">
        <Suspense
          fallback={
            <div className="p-10 text-center text-slate-400 font-bold">جاري تحميل الوحدة...</div>
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                <DashboardView
                  children={children}
                  alerts={alerts}
                  onTriggerDemo={() => navigate('/simulator')}
                  lang={lang}
                  parentId={currentUser.id}
                  isLoading={isLoadingData}
                />
              }
            />
            <Route
              path="/devices"
              element={
                FEATURE_FLAGS.devices ? (
                  <DevicesView
                    children={children}
                    lang={lang}
                    onUpdateDevice={handleUpdateDeviceControls}
                    onToggleAppBlock={handleToggleAppBlock}
                    onToggleDeviceLock={handleToggleDeviceLock}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/alerts"
              element={<AlertsView alerts={alerts} theme="light" lang={lang} />}
            />
            <Route
              path="/defense"
              element={
                FEATURE_FLAGS.advancedDefense ? (
                  <ProactiveDefenseView
                    children={children}
                    lang={lang}
                    parentId={currentUser.id}
                    onUpdateDefense={handleUpdateDefense}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/incidents"
              element={
                FEATURE_FLAGS.incidentCenter ? (
                  <IncidentsCenterView alerts={alerts} children={children} lang={lang} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/enrollment"
              element={
                FEATURE_FLAGS.deviceEnrollment ? (
                  <DeviceEnrollmentView
                    lang={lang}
                    currentUser={currentUser}
                    requests={pairingRequests}
                    onRotatePairingKey={handleRotatePairingKey}
                    onApprove={async (request) => {
                      await approvePairingRequest(currentUser.id, request);
                    }}
                    onReject={async (requestId) => {
                      await rejectPairingRequest(currentUser.id, requestId);
                    }}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/family-roles"
              element={
                FEATURE_FLAGS.familyRoles ? (
                  <FamilyRolesView
                    lang={lang}
                    currentUser={currentUser}
                    children={children}
                    onUpdateMember={handleUpdateMember}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/advisor"
              element={
                FEATURE_FLAGS.advisor ? (
                  <AdvisorView lang={lang} children={children} alerts={alerts} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/war-room"
              element={
                FEATURE_FLAGS.incidentWarRoom ? (
                  <IncidentWarRoom
                    parentId={currentUser.id}
                    alerts={alerts}
                    lang={lang}
                    onOpenVault={() => navigate('/vault')}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/playbooks"
              element={
                FEATURE_FLAGS.playbookHub ? (
                  <SafetyPlaybookHub currentUser={currentUser} lang={lang} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/parent-ops"
              element={
                FEATURE_FLAGS.parentOpsConsole ? (
                  <ParentOpsConsoleView
                    lang={lang}
                    currentUser={currentUser}
                    children={children}
                    alerts={alerts}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/command-center"
              element={
                FEATURE_FLAGS.commandCenter ? (
                  <ProtectedRoute userRole={currentUser.role} allowedRoles={['ADMIN', 'SUPERVISOR']}>
                    <CommandCenter
                      lang={lang}
                      currentUser={currentUser}
                      children={children}
                      alerts={alerts}
                    />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/custody"
              element={
                FEATURE_FLAGS.forensics ? (
                  <ChainOfCustodyView
                    parentId={currentUser.id}
                    incidentId={
                      alerts.find((a) => a.severity === AlertSeverity.CRITICAL)?.id ||
                      alerts.find((a) => a.severity === AlertSeverity.HIGH)?.id ||
                      alerts[0]?.id ||
                      'incident-demo'
                    }
                    lang={lang}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/security-report"
              element={
                FEATURE_FLAGS.forensics ? (
                  <SystemSecurityReportView parentId={currentUser.id} lang={lang} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/benchmark"
              element={
                FEATURE_FLAGS.forensics ? (
                  <VisualBenchmarkView lang={lang} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/modes"
              element={
                <ModesView
                  modes={modes}
                  children={children}
                  onUpdateModes={setModes}
                  onApplyMode={handleApplyMode}
                />
              }
            />
            <Route
              path="/simulator"
              element={
                FEATURE_FLAGS.simulator ? (
                  <SimulatorView children={children} parentId={currentUser.id} lang={lang} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/devlab"
              element={
                FEATURE_FLAGS.developerLab ? (
                  <ProtectedRoute userRole={currentUser.role} allowedRoles={['ADMIN']}>
                    <DevLabView />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/dev-resolution"
              element={
                FEATURE_FLAGS.developerResolutionHub ? (
                  <ProtectedRoute userRole={currentUser.role} allowedRoles={['ADMIN']}>
                    <DeveloperResolutionHub
                      lang={lang}
                      currentUser={currentUser}
                      children={children}
                      alerts={alerts}
                    />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/live"
              element={
                FEATURE_FLAGS.liveMonitor ? (
                  <LiveMonitorView children={children} lang={lang} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/vault"
              element={
                FEATURE_FLAGS.evidenceVault ? (
                  <ProtectedRoute userRole={currentUser.role} allowedRoles={['ADMIN', 'SUPERVISOR']}>
                    <EvidenceVaultView
                      records={alerts as any}
                      currentUser={currentUser}
                      lang={lang}
                      onRequestToast={(a) => setActiveToast(a)}
                      isLoading={isLoadingData}
                    />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/pulse"
              element={
                FEATURE_FLAGS.psychologicalPulse ? (
                  <PsychologicalInsightView
                    theme="light"
                    child={children[0]}
                    alerts={alerts}
                    onAcceptPlan={handleAcceptSuggestedMode}
                    onApplyModeToChild={handleApplyMode}
                    onPlanExecutionResult={handlePlanExecutionResult}
                    onSaveExecutionEvidence={handleSaveExecutionEvidence}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/map"
              element={FEATURE_FLAGS.geoMap ? <MapView children={children} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute userRole={currentUser.role} allowedRoles={['ADMIN']}>
                  <SettingsView
                    currentUser={currentUser}
                    children={children}
                    lang={lang}
                    onUpdateMember={handleUpdateMember}
                    onDeleteMember={(id, role) => deleteMemberFromDB(id, role)}
                    onAddChild={async (data) => {
                      await addChildToDB(currentUser.id, data);
                    }}
                    onAddSupervisor={(data) => inviteSupervisor(currentUser.id, data)}
                    showSuccessToast={(m) =>
                      setActiveToast({
                        id: 'sys-' + Date.now(),
                        childName: 'System',
                        platform: 'Amanah',
                        content: m,
                        category: Category.SAFE,
                        severity: AlertSeverity.LOW,
                        timestamp: new Date(),
                        aiAnalysis: m,
                      })
                    }
                  />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-100 shadow-2xl z-[9999] pb-4 pt-2 flex justify-center gap-2 px-6">
        {menuItems.slice(0, 5).map((item) => (
          <NavLink key={item.path} to={item.path} icon={item.icon} label={item.label} />
        ))}
      </nav>

      {emergencyAlert && (
        <EmergencyOverlay
          alert={emergencyAlert}
          onClose={() => setEmergencyAlert(null)}
          onAction={() => navigate('/vault')}
          onMinimize={() => handleMinimizeEmergency(emergencyAlert)}
        />
      )}
      {activeToast && (
        <NotificationToast alert={activeToast} onClose={() => setActiveToast(null)} />
      )}
      <PairingRequestModal
        requests={pairingRequests}
        lang={lang}
        onApprove={(req) => approvePairingRequest(currentUser.id, req)}
        onReject={(id) => rejectPairingRequest(currentUser.id, id)}
      />
    </div>
  );
};

export default App;


