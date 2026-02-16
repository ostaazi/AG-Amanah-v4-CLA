import React, { useEffect, useMemo, useState } from 'react';
import { AlertSeverity, EvidenceCustody, MonitoringAlert } from '../types';
import { fetchCustodyByIncident } from '../services/firestoreService';
import { verifyChainIntegrity } from '../services/forensicsService';
import ExportBundleModal from './ExportBundleModal';

interface IncidentWarRoomProps {
  parentId: string;
  alerts: MonitoringAlert[];
  lang: 'ar' | 'en';
  onOpenVault: () => void;
}

const IncidentWarRoom: React.FC<IncidentWarRoomProps> = ({ parentId, alerts, lang, onOpenVault }) => {
  const [custody, setCustody] = useState<EvidenceCustody[]>([]);
  const [integrity, setIntegrity] = useState<'pending' | 'ok' | 'broken'>('pending');
  const [openExport, setOpenExport] = useState(false);

  const incident = useMemo(() => {
    const ordered = [...alerts].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    return (
      ordered.find((a) => a.severity === AlertSeverity.CRITICAL) ||
      ordered.find((a) => a.severity === AlertSeverity.HIGH) ||
      ordered[0] ||
      null
    );
  }, [alerts]);

  const incidentId = incident?.id || 'incident-demo';

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!incidentId) return;
      setIntegrity('pending');
      const chain = await fetchCustodyByIncident(parentId, incidentId);
      if (!active) return;
      setCustody(chain);
      if (!chain.length) {
        setIntegrity('ok');
        return;
      }
      const valid = await verifyChainIntegrity(chain);
      if (!active) return;
      setIntegrity(valid ? 'ok' : 'broken');
    };
    load();
    return () => {
      active = false;
    };
  }, [incidentId, parentId]);

  const t = lang === 'ar'
    ? {
        title: 'غرفة إدارة الحادث',
        noIncident: 'لا يوجد حادث نشط حاليًا.',
        summary: 'ملخص الحادث',
        chain: 'سجل سلسلة الحيازة',
        openVault: 'فتح خزنة الأدلة',
        export: 'تصدير حزمة الأدلة',
        ok: 'سلسلة الحيازة سليمة',
        broken: 'تحذير: خلل في سلسلة الحيازة',
        pending: 'جاري التحقق من النزاهة...',
      }
    : {
        title: 'Incident War Room',
        noIncident: 'No active incident at the moment.',
        summary: 'Incident Summary',
        chain: 'Custody Chain Log',
        openVault: 'Open Evidence Vault',
        export: 'Export Evidence Bundle',
        ok: 'Custody chain verified',
        broken: 'Warning: custody chain integrity failed',
        pending: 'Verifying integrity...',
      };

  if (!incident) {
    return <div className="p-10 text-center font-black text-slate-500">{t.noIncident}</div>;
  }

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {openExport && <ExportBundleModal incidentId={incidentId} lang={lang} onClose={() => setOpenExport(false)} />}

      <div className="rounded-[2.5rem] bg-slate-900 text-white p-8 border-b-8 border-indigo-600">
        <h2 className="text-3xl font-black">{t.title}</h2>
        <p className="text-sm text-indigo-200 font-bold mt-2">{incident.childName} • {incident.platform}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4">
          <h3 className="text-xl font-black text-slate-900">{t.summary}</h3>
          <p className="text-sm font-bold text-slate-600 leading-relaxed">{incident.content}</p>
          <p className="text-sm text-slate-500 font-bold">{incident.aiAnalysis}</p>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-[11px] font-black text-slate-500 mb-2">{t.chain}</p>
            {!custody.length ? (
              <p className="text-xs font-bold text-slate-400">
                {lang === 'ar' ? 'لا توجد أحداث حيازة مسجلة بعد لهذا الحادث.' : 'No custody events recorded for this incident yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {custody.slice(0, 6).map((entry) => (
                  <div key={entry.custody_id} className="text-xs font-bold text-slate-700 bg-white rounded-xl p-3 border border-slate-100">
                    [{entry.event_key}] {entry.action} • {entry.actor}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4">
          <div
            className={`rounded-2xl p-4 border text-sm font-black ${
              integrity === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : integrity === 'broken'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            {integrity === 'ok' ? t.ok : integrity === 'broken' ? t.broken : t.pending}
          </div>
          <button
            onClick={onOpenVault}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-black"
          >
            {t.openVault}
          </button>
          <button
            onClick={() => setOpenExport(true)}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black"
          >
            {t.export}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncidentWarRoom;
