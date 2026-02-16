import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Child, MonitoringAlert, ParentAccount } from '../types';
import { sovereignApi } from '../services/sovereignApiService';
import { FEATURE_FLAGS } from '../config/featureFlags';
import FamilyIncidentResponseView from './FamilyIncidentResponseView';

interface CommandCenterProps {
  lang: 'ar' | 'en';
  currentUser: ParentAccount;
  children: Child[];
  alerts: MonitoringAlert[];
}

const CommandCenter: React.FC<CommandCenterProps> = ({ lang, currentUser, children, alerts }) => {
  const navigate = useNavigate();

  const incidents = useMemo(
    () => sovereignApi.listIncidentsFromAlerts(alerts, children),
    [alerts, children]
  );

  const criticalAlerts = useMemo(
    () => alerts.filter((alert) => String(alert.severity).toUpperCase() === 'CRITICAL').length,
    [alerts]
  );

  const topIncident = incidents[0] || null;
  const topIncidentAlert = useMemo(() => {
    if (!topIncident) return null;
    const key = topIncident.incident_id.replace(/^INC-/, '');
    return alerts.find((a) => a.id === key || a.childName === topIncident.childName) || null;
  }, [alerts, topIncident]);

  const shortcuts = [
    {
      id: 'war-room',
      enabled: FEATURE_FLAGS.incidentWarRoom,
      label: lang === 'ar' ? 'غرفة الحادث' : 'War Room',
      path: '/war-room',
    },
    {
      id: 'playbooks',
      enabled: FEATURE_FLAGS.playbookHub,
      label: lang === 'ar' ? 'البروتوكولات' : 'Playbooks',
      path: '/playbooks',
    },
    {
      id: 'parent-ops',
      enabled: FEATURE_FLAGS.parentOpsConsole,
      label: lang === 'ar' ? 'عمليات الوالدين' : 'Parent Ops',
      path: '/parent-ops',
    },
    {
      id: 'vault',
      enabled: FEATURE_FLAGS.evidenceVault,
      label: lang === 'ar' ? 'خزنة الأدلة' : 'Evidence Vault',
      path: '/vault',
    },
    {
      id: 'pulse',
      enabled: FEATURE_FLAGS.psychologicalPulse,
      label: lang === 'ar' ? 'النبض النفسي' : 'Psych Pulse',
      path: '/pulse',
    },
  ].filter((item) => item.enabled);

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="rounded-[2.5rem] bg-slate-900 text-white p-8 border-b-8 border-indigo-600">
        <h2 className="text-3xl font-black">{lang === 'ar' ? 'مركز الأوامر' : 'Command Center'}</h2>
        <p className="text-sm font-bold text-indigo-200 mt-2">
          {lang === 'ar'
            ? `قائد الجلسة: ${currentUser.name}`
            : `Session operator: ${currentUser.name}`}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <p className="text-[11px] font-black text-slate-500">{lang === 'ar' ? 'إجمالي التنبيهات' : 'Total Alerts'}</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{alerts.length}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <p className="text-[11px] font-black text-slate-500">{lang === 'ar' ? 'تنبيهات حرجة' : 'Critical Alerts'}</p>
          <p className="text-3xl font-black text-rose-600 mt-1">{criticalAlerts}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <p className="text-[11px] font-black text-slate-500">{lang === 'ar' ? 'الحوادث النشطة' : 'Active Incidents'}</p>
          <p className="text-3xl font-black text-indigo-600 mt-1">{incidents.length}</p>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-black text-slate-900">
          {lang === 'ar' ? 'اختصارات الاستجابة' : 'Response Shortcuts'}
        </h3>
        <div className="flex flex-wrap gap-3">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.id}
              onClick={() => navigate(shortcut.path)}
              className="px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-colors"
            >
              {shortcut.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-black text-slate-900">
          {lang === 'ar' ? 'خطة استجابة الأسرة' : 'Family Response Plan'}
        </h3>
        <FamilyIncidentResponseView lang={lang} incident={topIncidentAlert} />
      </section>
    </div>
  );
};

export default CommandCenter;
