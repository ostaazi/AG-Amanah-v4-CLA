import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertSeverity,
  AutomatedAction,
  Category,
  ParentAccount,
  SafetyPlaybook,
} from '../types';
import { fetchPlaybooks, savePlaybooks } from '../services/firestoreService';
import DefenseRulesView from './parent/DefenseRulesView';
import DefensePolicyView from './parent/DefensePolicyView';
import GeoFenceManager from './parent/GeoFenceManager';
import SafetyProtocolStudio from './SafetyProtocolStudio';
import PlatformSOCView from './PlatformSOCView';

interface SafetyPlaybookHubProps {
  currentUser: ParentAccount;
  lang: 'ar' | 'en';
}

type HubTab = 'playbooks' | 'rules' | 'policy' | 'geo' | 'studio' | 'soc';

const PLAYBOOK_ACTION_OPTIONS: Array<{
  type: AutomatedAction['type'];
  ar: string;
  en: string;
}> = [
  { type: 'NOTIFY_PARENTS', ar: 'تنبيه الوالدين', en: 'Notify Parents' },
  { type: 'BLOCK_APP', ar: 'حظر التطبيق', en: 'Block App' },
  { type: 'LOCK_DEVICE', ar: 'قفل الجهاز', en: 'Lock Device' },
  { type: 'LOCKSCREEN_BLACKOUT', ar: 'شاشة حجب سوداء', en: 'Blackout Lock Screen' },
  { type: 'WALKIE_TALKIE_ENABLE', ar: 'تفعيل Walkie-Talkie', en: 'Enable Walkie-Talkie' },
  { type: 'LIVE_CAMERA_REQUEST', ar: 'طلب بث الكاميرا', en: 'Request Live Camera' },
  { type: 'SCREENSHOT_CAPTURE', ar: 'التقاط لقطة شاشة', en: 'Capture Screenshot' },
  { type: 'SIREN', ar: 'صافرة ردع', en: 'Deterrence Siren' },
  { type: 'QUARANTINE_NET', ar: 'حجر الشبكة', en: 'Network Quarantine' },
  { type: 'DISABLE_HARDWARE', ar: 'تعطيل الكاميرا/المايك', en: 'Disable Camera/Mic' },
];

const defaultPlaybooks = (lang: 'ar' | 'en'): SafetyPlaybook[] => [
  {
    id: 'pb-bullying',
    name: lang === 'ar' ? 'درع التنمر الإلكتروني' : 'Cyberbullying Shield',
    category: Category.BULLYING,
    minSeverity: AlertSeverity.HIGH,
    enabled: true,
    actions: [
      { id: 'a1', type: 'NOTIFY_PARENTS', isEnabled: true },
      { id: 'a2', type: 'BLOCK_APP', isEnabled: true },
      { id: 'a6', type: 'SCREENSHOT_CAPTURE', isEnabled: true },
    ],
  },
  {
    id: 'pb-predator',
    name: lang === 'ar' ? 'بروتوكول الاستدراج' : 'Predator Protocol',
    category: Category.PREDATOR,
    minSeverity: AlertSeverity.CRITICAL,
    enabled: true,
    actions: [
      { id: 'a3', type: 'LOCK_DEVICE', isEnabled: true },
      { id: 'a7', type: 'LOCKSCREEN_BLACKOUT', isEnabled: true },
      { id: 'a8', type: 'WALKIE_TALKIE_ENABLE', isEnabled: true },
      { id: 'a4', type: 'SIREN', isEnabled: true },
      { id: 'a5', type: 'NOTIFY_PARENTS', isEnabled: true },
    ],
  },
];

const SafetyPlaybookHub: React.FC<SafetyPlaybookHubProps> = ({ currentUser, lang }) => {
  const [tab, setTab] = useState<HubTab>('playbooks');
  const [loading, setLoading] = useState(true);
  const [playbooks, setPlaybooks] = useState<SafetyPlaybook[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const stored = await fetchPlaybooks(currentUser.id);
        if (!active) return;
        setPlaybooks(stored.length ? stored : defaultPlaybooks(lang));
      } catch (error) {
        if (!active) return;
        console.warn('Playbooks load skipped:', error);
        setPlaybooks(defaultPlaybooks(lang));
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch((error) => {
      if (!active) return;
      console.warn('Playbooks load fatal fallback:', error);
      setPlaybooks(defaultPlaybooks(lang));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [currentUser.id, lang]);

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'مكتبة بروتوكولات الحماية',
            save: 'حفظ التغييرات',
            tabs: {
              playbooks: 'البروتوكولات',
              rules: 'قواعد الدفاع',
              policy: 'سياسات الدفاع',
              geo: 'السياج الجغرافي',
              studio: 'استوديو البروتوكول',
              soc: 'لوحة SOC',
            },
            enabled: 'مفعّل',
            disabled: 'متوقف',
            loading: 'جارٍ التحميل...',
            protocolActions: 'إجراءات البروتوكول',
            on: 'مفعل',
            off: 'متوقف',
          }
        : {
            title: 'Safety Playbook Hub',
            save: 'Save Changes',
            tabs: {
              playbooks: 'Playbooks',
              rules: 'Rules',
              policy: 'Policy',
              geo: 'GeoFence',
              studio: 'Studio',
              soc: 'SOC',
            },
            enabled: 'Enabled',
            disabled: 'Disabled',
            loading: 'Loading...',
            protocolActions: 'Protocol Actions',
            on: 'ON',
            off: 'OFF',
          },
    [lang]
  );

  const togglePlaybook = (id: string) => {
    setPlaybooks((prev) => prev.map((pb) => (pb.id === id ? { ...pb, enabled: !pb.enabled } : pb)));
  };

  const updateSeverity = (id: string, minSeverity: AlertSeverity) => {
    setPlaybooks((prev) => prev.map((pb) => (pb.id === id ? { ...pb, minSeverity } : pb)));
  };

  const togglePlaybookAction = (playbookId: string, actionType: AutomatedAction['type']) => {
    setPlaybooks((prev) =>
      prev.map((pb) => {
        if (pb.id !== playbookId) return pb;
        const existing = pb.actions.find((action) => action.type === actionType);
        if (!existing) {
          return {
            ...pb,
            actions: [
              ...pb.actions,
              {
                id: `a-${pb.id}-${actionType.toLowerCase()}`,
                type: actionType,
                isEnabled: true,
              },
            ],
          };
        }

        return {
          ...pb,
          actions: pb.actions.map((action) =>
            action.type === actionType ? { ...action, isEnabled: !action.isEnabled } : action
          ),
        };
      })
    );
  };

  const persist = async () => {
    setSaving(true);
    try {
      await savePlaybooks(currentUser.id, playbooks);
    } catch (error) {
      console.warn('Playbooks save skipped:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="rounded-[2.5rem] bg-slate-900 text-white p-8 border-b-8 border-indigo-600 flex items-center justify-between">
        <h2 className="text-3xl font-black">{t.title}</h2>
        <button
          onClick={persist}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-indigo-600 font-black disabled:opacity-50"
        >
          {saving ? '...' : t.save}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(t.tabs) as HubTab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-black border ${
              tab === key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {t.tabs[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center font-black text-slate-500">{t.loading}</div>
      ) : (
        <>
          {tab === 'playbooks' && (
            <div className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4">
              {playbooks.map((pb) => (
                <div key={pb.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{pb.name}</p>
                      <p className="text-[11px] font-bold text-slate-500">{pb.category}</p>
                    </div>
                    <button
                      onClick={() => togglePlaybook(pb.id)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        pb.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {pb.enabled ? t.enabled : t.disabled}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {[AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL].map((s) => (
                      <button
                        key={`${pb.id}-${s}`}
                        onClick={() => updateSeverity(pb.id, s)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                          pb.minSeverity === s
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-black text-slate-500">{t.protocolActions}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {PLAYBOOK_ACTION_OPTIONS.map((option) => {
                        const isEnabled = !!pb.actions.find(
                          (action) => action.type === option.type && action.isEnabled
                        );
                        return (
                          <button
                            key={`${pb.id}-${option.type}`}
                            onClick={() => togglePlaybookAction(pb.id, option.type)}
                            className={`px-3 py-2 rounded-xl border text-[10px] font-black flex items-center justify-between ${
                              isEnabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-white text-slate-500 border-slate-200'
                            }`}
                          >
                            <span>{isEnabled ? t.on : t.off}</span>
                            <span>{lang === 'ar' ? option.ar : option.en}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'rules' && <DefenseRulesView lang={lang} playbooks={playbooks} />}
          {tab === 'policy' && <DefensePolicyView lang={lang} />}
          {tab === 'geo' && <GeoFenceManager lang={lang} />}
          {tab === 'studio' && <SafetyProtocolStudio lang={lang} />}
          {tab === 'soc' && <PlatformSOCView lang={lang} />}
        </>
      )}
    </div>
  );
};

export default SafetyPlaybookHub;
