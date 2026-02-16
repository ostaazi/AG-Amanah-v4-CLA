import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertSeverity, Child, IncidentReport, MonitoringAlert } from '../types';
import { sovereignApi } from '../services/sovereignApiService';

interface IncidentsCenterViewProps {
  alerts: MonitoringAlert[];
  children: Child[];
  lang: 'ar' | 'en';
}

const IncidentsCenterView: React.FC<IncidentsCenterViewProps> = ({
  alerts,
  children,
  lang,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(
    'ALL'
  );

  const incidents = useMemo(
    () => sovereignApi.listIncidentsFromAlerts(alerts, children),
    [alerts, children]
  );

  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      const sev = String(incident.severity).toUpperCase();
      const bySeverity = severityFilter === 'ALL' || sev === severityFilter;
      const keyword = search.trim().toLowerCase();
      const bySearch =
        keyword.length === 0 ||
        String(incident.incident_type).toLowerCase().includes(keyword) ||
        String(incident.childName).toLowerCase().includes(keyword) ||
        String(incident.summary || '').toLowerCase().includes(keyword);
      return bySeverity && bySearch;
    });
  }, [incidents, search, severityFilter]);

  const t = {
    title: lang === 'ar' ? 'مركز الحوادث' : 'Incident Center',
    subtitle:
      lang === 'ar'
        ? 'قائمة الحوادث المستخرجة من التنبيهات مع ترتيب حسب الخطورة'
        : 'Incidents generated from alerts, sorted by risk',
    search: lang === 'ar' ? 'بحث في الحوادث...' : 'Search incidents...',
    openVault: lang === 'ar' ? 'فتح الخزنة' : 'Open Vault',
    noData:
      lang === 'ar' ? 'لا توجد حوادث مطابقة للفلاتر.' : 'No incidents match the filters.',
  };

  const badgeClass = (severity: AlertSeverity | string) => {
    const sev = String(severity).toUpperCase();
    if (sev === 'CRITICAL') return 'bg-red-600 text-white';
    if (sev === 'HIGH') return 'bg-amber-500 text-white';
    if (sev === 'MEDIUM') return 'bg-indigo-600 text-white';
    return 'bg-slate-200 text-slate-700';
  };

  const openIncidentVault = (incident: IncidentReport) => {
    const alertId = incident.incident_id.replace(/^INC-/, '');
    navigate('/vault', { state: { openAlertId: alertId } });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="bg-slate-900 text-white p-8 rounded-[3rem] border-b-4 border-red-500">
        <h2 className="text-3xl font-black tracking-tight">{t.title}</h2>
        <p className="text-slate-300 font-bold mt-2">{t.subtitle}</p>
      </section>

      <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full md:w-96 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700"
          />
          <div className="flex gap-2">
            {(['ALL', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((severity) => (
              <button
                key={severity}
                onClick={() => setSeverityFilter(severity)}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                  severityFilter === severity
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((incident) => (
            <article
              key={incident.incident_id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:bg-white hover:shadow-sm transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-black text-slate-800 text-lg">
                    {incident.incident_type}
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    {incident.childName} • {new Date(incident.created_at).toLocaleString()}
                  </p>
                  {!!incident.summary && (
                    <p className="text-sm font-bold text-slate-600">{incident.summary}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${badgeClass(incident.severity)}`}>
                    {String(incident.severity).toUpperCase()}
                  </span>
                  <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-slate-200 text-slate-700">
                    {incident.status}
                  </span>
                  <button
                    onClick={() => openIncidentVault(incident)}
                    className="px-3 py-2 rounded-lg text-xs font-black bg-indigo-600 text-white"
                  >
                    {t.openVault}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 font-black">{t.noData}</div>
        )}
      </section>
    </div>
  );
};

export default IncidentsCenterView;

