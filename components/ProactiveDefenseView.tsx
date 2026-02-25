import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertSeverity,
  Category,
  Child,
  ChildSignalEvent,
  CommandPriority,
  MonitoringAlert,
  ProactiveDefenseConfig,
  SafetyPlaybook,
} from '../types';
import { ICONS } from '../constants';
import { DefenseAction, getDefenseActionsWithPlaybooks } from '../services/ruleEngineService';
import { fetchPlaybooks, sendRemoteCommand } from '../services/firestoreService';
import { buildUnifiedPsychSignals } from '../services/psychSignalFusionService';
import { buildPsychAutomationGate, PsychAutomationCommand } from '../services/psychAutomationGateService';

interface ProactiveDefenseViewProps {
  children: Child[];
  alerts?: MonitoringAlert[];
  signalEvents?: ChildSignalEvent[];
  lang: 'ar' | 'en';
  parentId: string;
  autoLockInAutomationEnabled?: boolean;
  allLocksDisabled?: boolean;
  onUpdateDefense: (childId: string, config: ProactiveDefenseConfig) => Promise<void> | void;
}

const defaultDefenseConfig: ProactiveDefenseConfig = {
  isEnabled: true,
  onTextThreat: {
    lockDevice: true,
    blockApp: true,
    sendWarning: true,
    triggerSiren: false,
  },
  onVisualThreat: {
    blockCamera: true,
    lockDevice: true,
    triggerSiren: true,
    blockMic: true,
  },
  autoMessage:
    'تم رصد نشاط غير آمن. تم تفعيل حماية فورية لحين مراجعة ولي الأمر.',
  sirenType: 'DEFAULT',
};

const cloneDefenseConfig = (config: ProactiveDefenseConfig): ProactiveDefenseConfig => ({
  ...config,
  onTextThreat: { ...config.onTextThreat },
  onVisualThreat: { ...config.onVisualThreat },
});

const applyConfigToDefenseActions = (
  actions: DefenseAction[],
  config: ProactiveDefenseConfig
): DefenseAction[] => {
  if (!config.isEnabled) return [];

  const allowLock = config.onTextThreat.lockDevice || config.onVisualThreat.lockDevice;
  const allowSiren = config.onTextThreat.triggerSiren || config.onVisualThreat.triggerSiren;
  const allowHardwareBlock = config.onVisualThreat.blockCamera || config.onVisualThreat.blockMic;

  return actions.filter((action) => {
    if ((action.command === 'lockDevice' || action.command === 'lockscreenBlackout') && !allowLock) {
      return false;
    }
    if (action.command === 'blockApp' && !config.onTextThreat.blockApp) {
      return false;
    }
    if (action.command === 'notifyParent' && !config.onTextThreat.sendWarning) {
      return false;
    }
    if (action.command === 'playSiren' && !allowSiren) {
      return false;
    }
    if (action.command === 'blockCameraAndMic' && !allowHardwareBlock) {
      return false;
    }
    return true;
  });
};

const ProactiveDefenseView: React.FC<ProactiveDefenseViewProps> = ({
  children,
  alerts = [],
  signalEvents = [],
  lang,
  parentId,
  autoLockInAutomationEnabled = true,
  allLocksDisabled = false,
  onUpdateDefense,
}) => {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.PREDATOR);
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity>(AlertSeverity.HIGH);
  const [isApplying, setIsApplying] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastRunSummary, setLastRunSummary] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [configError, setConfigError] = useState('');
  const [playbooks, setPlaybooks] = useState<SafetyPlaybook[]>([]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || children[0],
    [children, selectedChildId]
  );

  const activeScenarioId = useMemo(() => {
    if (selectedCategory === Category.BULLYING) return 'bullying' as const;
    if (selectedCategory === Category.SELF_HARM) return 'self_harm' as const;
    if (selectedCategory === Category.PHISHING_LINK) return 'phishing_links' as const;
    if (selectedCategory === Category.SCAM) return 'crypto_scams' as const;
    if (selectedCategory === Category.BLACKMAIL) return 'threat_exposure' as const;
    if (selectedCategory === Category.VIOLENCE) return 'harmful_challenges' as const;
    if (selectedCategory === Category.SEXUAL_EXPLOITATION) return 'sexual_exploitation' as const;
    return 'sexual_exploitation' as const;
  }, [selectedCategory]);

  const selectedChildAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) => alert.childId === selectedChild?.id || alert.childName === selectedChild?.name
      ),
    [alerts, selectedChild?.id, selectedChild?.name]
  );

  const selectedChildSignalEvents = useMemo(
    () =>
      signalEvents.filter(
        (event) => event.childId === selectedChild?.id || event.childName === selectedChild?.name
      ),
    [signalEvents, selectedChild?.id, selectedChild?.name]
  );

  const signalFusion = useMemo(
    () =>
      buildUnifiedPsychSignals({
        child: selectedChild,
        alerts: selectedChildAlerts,
        signalEvents: selectedChildSignalEvents,
      }),
    [selectedChild, selectedChildAlerts, selectedChildSignalEvents]
  );

  const automationGate = useMemo(
    () =>
      buildPsychAutomationGate({
        activeScenarioId,
        dominantSeverity: selectedSeverity,
        trajectories: signalFusion.trajectories,
      }),
    [activeScenarioId, selectedSeverity, signalFusion.trajectories]
  );

  const persistedConfig = useMemo(
    () => cloneDefenseConfig(selectedChild?.defenseConfig || defaultDefenseConfig),
    [selectedChild?.id, selectedChild?.defenseConfig]
  );
  const [config, setConfig] = useState<ProactiveDefenseConfig>(persistedConfig);
  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(persistedConfig),
    [config, persistedConfig]
  );

  useEffect(() => {
    setConfig(persistedConfig);
    setConfigError('');
    setSaveNotice('');
  }, [persistedConfig]);

  const actions = useMemo(() => {
    const baseActions = getDefenseActionsWithPlaybooks(selectedCategory, selectedSeverity, playbooks, {
      allowAutoLock: autoLockInAutomationEnabled && !allLocksDisabled,
      confidence: automationGate.ruleEngineConfidence,
    });
    const configuredActions = applyConfigToDefenseActions(baseActions, config);
    return configuredActions.filter((action) => {
      const decision = automationGate.commandDecisions[action.command as PsychAutomationCommand];
      return decision ? decision.allowed : true;
    });
  }, [
    allLocksDisabled,
    automationGate.commandDecisions,
    automationGate.ruleEngineConfidence,
    autoLockInAutomationEnabled,
    config,
    playbooks,
    selectedCategory,
    selectedSeverity,
  ]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const stored = await fetchPlaybooks(parentId);
        if (!mounted) return;
        setPlaybooks(stored);
      } catch (error) {
        if (!mounted) return;
        console.warn('Failed to load playbooks for defense view:', error);
        setPlaybooks([]);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [parentId]);

  const t = {
    title: lang === 'ar' ? 'الدفاع الاستباقي' : 'Proactive Defense',
    subtitle:
      lang === 'ar'
        ? 'إدارة الاستجابة الفورية للتهديدات الحرجة'
        : 'Manage automatic emergency response',
    noChild:
      lang === 'ar'
        ? 'أضف طفلًا أو اربط جهازًا لتفعيل الدفاع.'
        : 'Add a child device to activate defense.',
    save: lang === 'ar' ? 'حفظ إعدادات الدفاع' : 'Save Defense Settings',
    applyNow: lang === 'ar' ? 'تنفيذ الإجراءات الآن' : 'Run Actions Now',
    defenseOn: lang === 'ar' ? 'الحماية مفعلة' : 'Protection Enabled',
    defenseOff: lang === 'ar' ? 'الحماية معطلة' : 'Protection Disabled',
    category: lang === 'ar' ? 'فئة التهديد' : 'Threat Category',
    severity: lang === 'ar' ? 'شدة التهديد' : 'Severity',
    textProtocol: lang === 'ar' ? 'استجابة التهديد النصي' : 'Text Threat Protocol',
    visualProtocol: lang === 'ar' ? 'استجابة التهديد البصري' : 'Visual Threat Protocol',
    autoMessage: lang === 'ar' ? 'رسالة الردع' : 'Deterrence Message',
    autoLockDisabledNote:
      lang === 'ar'
        ? 'القفل التلقائي معطل من الإعدادات. ستستمر بقية أوامر الحماية.'
        : 'Automatic lock is disabled from settings. Other protection actions remain active.',
    allLocksDisabledNote:
      lang === 'ar'
        ? 'تم تعطيل جميع الأقفال مؤقتًا/دائمًا من الإعدادات. لن يتم إرسال أي أوامر قفل.'
        : 'All locks are disabled from settings (temporary/permanent). No lock commands will be sent.',
    trajectoryGateLabel: lang === 'ar' ? 'بوابة المسارات' : 'Trajectory Gate',
  };

  if (!selectedChild) {
    return (
      <div className="p-10 bg-white rounded-[2.5rem] border border-slate-100 text-center text-slate-500 font-bold">
        {t.noChild}
      </div>
    );
  }

  const patchConfig = (patch: Partial<ProactiveDefenseConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...patch,
      onTextThreat: patch.onTextThreat
        ? { ...prev.onTextThreat, ...patch.onTextThreat }
        : prev.onTextThreat,
      onVisualThreat: patch.onVisualThreat
        ? { ...prev.onVisualThreat, ...patch.onVisualThreat }
        : prev.onVisualThreat,
    }));
    setConfigError('');
    setSaveNotice('');
  };

  const saveConfig = async () => {
    if (!selectedChild || isSavingConfig) return;
    if (!isDirty) {
      setSaveNotice(lang === 'ar' ? 'لا توجد تغييرات جديدة للحفظ.' : 'No new changes to save.');
      return;
    }
    setIsSavingConfig(true);
    setConfigError('');
    setSaveNotice('');
    try {
      await onUpdateDefense(selectedChild.id, config);
      setSaveNotice(
        lang === 'ar' ? 'تم حفظ إعدادات الدفاع الاستباقي بنجاح.' : 'Proactive defense settings saved.'
      );
    } catch (error: any) {
      setConfigError(
        lang === 'ar'
          ? `فشل حفظ إعدادات الدفاع: ${String(error?.message || 'خطأ غير معروف')}`
          : `Failed to save defense settings: ${String(error?.message || 'Unknown error')}`
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  const runActionsNow = async () => {
    if (actions.length === 0) {
      setLastRunSummary(
        lang === 'ar'
          ? 'لا توجد أوامر متاحة للتنفيذ بعد قيود البوابة والإعدادات.'
          : 'No commands available to execute after gate/settings constraints.'
      );
      return;
    }
    setIsApplying(true);
    try {
      const results = await Promise.allSettled(
        actions.map((action) => sendRemoteCommand(selectedChild.id, action.command, action.payload ?? true))
      );
      const failed = results.filter((result) => result.status === 'rejected').length;
      const done = results.length - failed;
      setLastRunSummary(
        lang === 'ar'
          ? `تم تنفيذ ${done} أوامر وفشل ${failed}.`
          : `Executed ${done} commands, failed ${failed}.`
      );
    } finally {
      setIsApplying(false);
    }
  };

  const priorityClass = (priority: CommandPriority) => {
    if (priority === CommandPriority.CRITICAL) return 'bg-red-50 text-red-700 border-red-200';
    if (priority === CommandPriority.HIGH) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="bg-slate-900 text-white p-8 rounded-[3rem] border-b-4 border-indigo-500">
        <h2 className="text-3xl font-black tracking-tight">{t.title}</h2>
        <p className="text-indigo-200 font-bold mt-2">{t.subtitle}</p>
      </section>

      <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-all border ${
                selectedChild.id === child.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-700">{t.defenseOn}</p>
              <button
                onClick={() => patchConfig({ isEnabled: !config.isEnabled })}
                className={`w-14 h-8 rounded-full p-1 transition-all ${
                  config.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    config.isEnabled ? '-translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs font-bold text-slate-500">
              {config.isEnabled ? t.defenseOn : t.defenseOff}
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
            <p className="text-sm font-black text-slate-700">{t.autoMessage}</p>
            <textarea
              value={config.autoMessage}
              onChange={(e) => patchConfig({ autoMessage: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 min-h-24"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <p className="font-black text-slate-700 mb-4">{t.textProtocol}</p>
            <div className="space-y-2 text-sm">
              <ToggleRow
                label="Lock Device"
                checked={config.onTextThreat.lockDevice}
                onToggle={() =>
                  patchConfig({
                    onTextThreat: {
                      ...config.onTextThreat,
                      lockDevice: !config.onTextThreat.lockDevice,
                    },
                  })
                }
              />
              <ToggleRow
                label="Block App"
                checked={config.onTextThreat.blockApp}
                onToggle={() =>
                  patchConfig({
                    onTextThreat: {
                      ...config.onTextThreat,
                      blockApp: !config.onTextThreat.blockApp,
                    },
                  })
                }
              />
              <ToggleRow
                label="Trigger Siren"
                checked={config.onTextThreat.triggerSiren}
                onToggle={() =>
                  patchConfig({
                    onTextThreat: {
                      ...config.onTextThreat,
                      triggerSiren: !config.onTextThreat.triggerSiren,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <p className="font-black text-slate-700 mb-4">{t.visualProtocol}</p>
            <div className="space-y-2 text-sm">
              <ToggleRow
                label="Block Camera"
                checked={config.onVisualThreat.blockCamera}
                onToggle={() =>
                  patchConfig({
                    onVisualThreat: {
                      ...config.onVisualThreat,
                      blockCamera: !config.onVisualThreat.blockCamera,
                    },
                  })
                }
              />
              <ToggleRow
                label="Block Mic"
                checked={config.onVisualThreat.blockMic}
                onToggle={() =>
                  patchConfig({
                    onVisualThreat: {
                      ...config.onVisualThreat,
                      blockMic: !config.onVisualThreat.blockMic,
                    },
                  })
                }
              />
              <ToggleRow
                label="Lock Device"
                checked={config.onVisualThreat.lockDevice}
                onToggle={() =>
                  patchConfig({
                    onVisualThreat: {
                      ...config.onVisualThreat,
                      lockDevice: !config.onVisualThreat.lockDevice,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-500 uppercase">{t.category}</p>
            <div className="flex flex-wrap gap-2">
              {[Category.PREDATOR, Category.BULLYING, Category.SELF_HARM].map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                    selectedCategory === category
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-500 uppercase">{t.severity}</p>
            <div className="flex gap-2">
              {[AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL].map((severity) => (
                <button
                  key={severity}
                  onClick={() => setSelectedSeverity(severity)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                    selectedSeverity === severity
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
          <p className="font-black text-slate-700">Suggested Actions</p>
          {allLocksDisabled && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700">
              {t.allLocksDisabledNote}
            </div>
          )}
          {!allLocksDisabled && !autoLockInAutomationEnabled && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-700">
              {t.autoLockDisabledNote}
            </div>
          )}
          <div
            className={`rounded-xl px-3 py-2 text-[11px] font-black border ${
              automationGate.lockEnabled
                ? 'text-rose-700 bg-rose-50 border-rose-200'
                : automationGate.containmentEnabled
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-slate-700 bg-slate-100 border-slate-200'
            }`}
          >
            <span className="uppercase tracking-wide">{t.trajectoryGateLabel}: </span>
            {lang === 'ar' ? automationGate.summaryAr : automationGate.summaryEn}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {actions.map((action) => (
              <div
                key={action.id}
                className={`rounded-xl p-3 border text-xs font-black ${priorityClass(action.priority)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{action.label}</span>
                  <span className="text-[10px] opacity-70">{action.priority}</span>
                </div>
              </div>
            ))}
          </div>
          {actions.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-700">
              {lang === 'ar'
                ? 'لا توجد أوامر مقترحة بعد تطبيق قيود الإعدادات + بوابة المسارات.'
                : 'No suggested commands remain after applying settings and trajectory gate constraints.'}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={saveConfig}
            disabled={isSavingConfig}
            className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm shadow disabled:opacity-50"
          >
            {isSavingConfig
              ? lang === 'ar'
                ? 'جارٍ الحفظ...'
                : 'Saving...'
              : t.save}
          </button>
          <button
            onClick={runActionsNow}
            disabled={isApplying}
            className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black text-sm shadow disabled:opacity-50"
          >
            {isApplying ? 'Running...' : t.applyNow}
          </button>
        </div>
        {lastRunSummary && (
          <div className="text-xs font-black text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            {lastRunSummary}
          </div>
        )}
        {configError && (
          <div className="text-xs font-black text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {configError}
          </div>
        )}
        {!!saveNotice && !configError && (
          <div className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {saveNotice}
          </div>
        )}
      </section>
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; checked: boolean; onToggle: () => void }> = ({
  label,
  checked,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200"
  >
    <span className="font-bold text-slate-700">{label}</span>
    <span
      className={`w-10 h-6 rounded-full p-1 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span
        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? '-translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

export default ProactiveDefenseView;

