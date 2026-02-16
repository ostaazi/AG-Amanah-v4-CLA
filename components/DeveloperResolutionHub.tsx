import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Child, MonitoringAlert, ParentAccount } from '../types';
import { FEATURE_FLAGS } from '../config/featureFlags';

interface DeveloperResolutionHubProps {
  lang: 'ar' | 'en';
  currentUser: ParentAccount;
  children: Child[];
  alerts: MonitoringAlert[];
}

const statusClass = (ok: boolean) =>
  ok
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-rose-50 border-rose-200 text-rose-700';

const DeveloperResolutionHub: React.FC<DeveloperResolutionHubProps> = ({
  lang,
  currentUser,
  children,
  alerts,
}) => {
  const navigate = useNavigate();

  const diagnostics = useMemo(() => {
    const enabledFlags = Object.values(FEATURE_FLAGS).filter(Boolean).length;
    const criticalAlerts = alerts.filter((a) => String(a.severity).toUpperCase() === 'CRITICAL').length;
    const linkedDevices = children.filter((child) => Boolean((child as any).deviceOwnerUid)).length;

    return {
      enabledFlags,
      criticalAlerts,
      linkedDevices,
      totalDevices: children.length,
      hasAuthIdentity: Boolean(currentUser?.id && currentUser.id !== 'guest'),
    };
  }, [alerts, children, currentUser?.id]);

  const checks = [
    {
      id: 'auth-identity',
      ok: diagnostics.hasAuthIdentity,
      title: lang === 'ar' ? 'هوية الجلسة' : 'Session Identity',
      detail: diagnostics.hasAuthIdentity
        ? lang === 'ar'
          ? 'الهوية مصادَق عليها.'
          : 'Identity is authenticated.'
        : lang === 'ar'
          ? 'الجلسة تعمل كضيف.'
          : 'Session is running as guest.',
    },
    {
      id: 'device-linkage',
      ok: diagnostics.linkedDevices === diagnostics.totalDevices,
      title: lang === 'ar' ? 'ربط الأجهزة' : 'Device Linkage',
      detail:
        lang === 'ar'
          ? `المربوط: ${diagnostics.linkedDevices}/${diagnostics.totalDevices}`
          : `Linked: ${diagnostics.linkedDevices}/${diagnostics.totalDevices}`,
    },
    {
      id: 'feature-flags',
      ok: diagnostics.enabledFlags > 0,
      title: lang === 'ar' ? 'أعلام الميزات' : 'Feature Flags',
      detail:
        lang === 'ar'
          ? `المفعّل: ${diagnostics.enabledFlags}`
          : `Enabled: ${diagnostics.enabledFlags}`,
    },
    {
      id: 'critical-alerts',
      ok: diagnostics.criticalAlerts === 0,
      title: lang === 'ar' ? 'تنبيهات حرجة' : 'Critical Alerts',
      detail:
        lang === 'ar'
          ? `الحالي: ${diagnostics.criticalAlerts}`
          : `Current: ${diagnostics.criticalAlerts}`,
    },
  ];

  const quickActions = [
    {
      id: 'devlab',
      label: lang === 'ar' ? 'فتح مختبر التطوير' : 'Open DevLab',
      path: '/devlab',
      enabled: FEATURE_FLAGS.developerLab,
    },
    {
      id: 'security-report',
      label: lang === 'ar' ? 'تقرير الأمان' : 'Security Report',
      path: '/security-report',
      enabled: FEATURE_FLAGS.forensics,
    },
    {
      id: 'benchmark',
      label: lang === 'ar' ? 'مختبر الأداء' : 'Benchmark Lab',
      path: '/benchmark',
      enabled: FEATURE_FLAGS.forensics,
    },
    {
      id: 'settings',
      label: lang === 'ar' ? 'الإعدادات المتقدمة' : 'Advanced Settings',
      path: '/settings',
      enabled: true,
    },
  ].filter((action) => action.enabled);

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="rounded-[2.5rem] bg-slate-900 text-white p-8 border-b-8 border-emerald-600">
        <h2 className="text-3xl font-black">
          {lang === 'ar' ? 'مركز حل الأعطال التطويري' : 'Developer Resolution Hub'}
        </h2>
        <p className="text-sm font-bold text-emerald-200 mt-2">
          {lang === 'ar'
            ? `المستخدم الحالي: ${currentUser.name}`
            : `Current user: ${currentUser.name}`}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checks.map((check) => (
          <article
            key={check.id}
            className={`rounded-2xl border p-4 shadow-sm ${statusClass(check.ok)}`}
          >
            <p className="text-sm font-black">{check.title}</p>
            <p className="text-xs font-bold mt-1 opacity-80">{check.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-black text-slate-900">
          {lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
        </h3>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => navigate(action.path)}
              className="px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DeveloperResolutionHub;
