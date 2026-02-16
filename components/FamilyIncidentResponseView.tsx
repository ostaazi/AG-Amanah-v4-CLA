import React, { useMemo } from 'react';
import { AlertSeverity, MonitoringAlert } from '../types';

interface FamilyIncidentResponseViewProps {
  lang: 'ar' | 'en';
  incident: MonitoringAlert | null;
}

const FamilyIncidentResponseView: React.FC<FamilyIncidentResponseViewProps> = ({ lang, incident }) => {
  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'استجابة الأسرة للحادث',
            noIncident: 'لا يوجد حادث نشط لعرض خطة الاستجابة.',
            immediate: 'خلال 10 دقائق',
            firstDay: 'خلال 24 ساعة',
            weekly: 'خلال 7 أيام',
            severity: 'شدة الحادث',
            immediatePlan: 'حفظ الدليل + إيقاف التواصل مع المصدر + طمأنة الطفل.',
            firstDayPlan: 'مراجعة الإعدادات الأمنية + تحديث خطة الحماية + متابعة نفسية.',
            weeklyPlan: 'جلسات تقييم قصيرة + تتبع مؤشرات التحسن + تحديث البروتوكول.',
          }
        : {
            title: 'Family Incident Response',
            noIncident: 'No active incident to build a response plan.',
            immediate: 'Within 10 minutes',
            firstDay: 'Within 24 hours',
            weekly: 'Within 7 days',
            severity: 'Incident Severity',
            immediatePlan: 'Preserve evidence + stop contact source + reassure the child.',
            firstDayPlan: 'Review security settings + update protection plan + emotional follow-up.',
            weeklyPlan: 'Short assessment sessions + progress tracking + protocol refinement.',
          },
    [lang]
  );

  if (!incident) {
    return <div className="p-8 text-center font-black text-slate-500">{t.noIncident}</div>;
  }

  const severityColor =
    incident.severity === AlertSeverity.CRITICAL
      ? 'bg-rose-50 border-rose-200 text-rose-700'
      : incident.severity === AlertSeverity.HIGH
        ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-emerald-50 border-emerald-200 text-emerald-700';

  return (
    <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
        <h3 className="text-2xl font-black text-slate-900">{t.title}</h3>
        <p className="text-sm font-bold text-slate-500 mt-2">
          {incident.childName} - {incident.platform}
        </p>
      </div>

      <div className={`rounded-2xl border p-4 text-sm font-black ${severityColor}`}>
        {t.severity}: {incident.severity}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-[11px] font-black text-slate-500">{t.immediate}</p>
          <p className="text-sm font-black text-slate-900 mt-2">{t.immediatePlan}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-[11px] font-black text-slate-500">{t.firstDay}</p>
          <p className="text-sm font-black text-slate-900 mt-2">{t.firstDayPlan}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-[11px] font-black text-slate-500">{t.weekly}</p>
          <p className="text-sm font-black text-slate-900 mt-2">{t.weeklyPlan}</p>
        </div>
      </div>
    </div>
  );
};

export default FamilyIncidentResponseView;
