import React, { useEffect, useMemo, useState } from 'react';
import {
  Child,
  DeviceCommandAudit,
  EvidenceCustody,
  EvidenceRecord,
  ForensicExport,
  IncidentReport,
  MonitoringAlert,
  ParentAccount,
} from '../../types';
import {
  deleteAlertFromDB,
  fetchCustodyByIncident,
  logAuditEvent,
  sendRemoteCommand,
  subscribeToAuditLogs,
} from '../../services/firestoreService';
import { sovereignApi } from '../../services/sovereignApiService';
import { buildEvidencePackageManifest } from '../../workers/evidencePackageWorker';
import {
  buildEvidencePurgePlan,
  EvidencePurgePlan,
  executeEvidencePurgePlan,
} from '../../workers/evidencePurgeWorker';
import { useStepUpGuard } from '../auth/StepUpGuard';
import ParentSidebar from './ParentSidebar';
import DeviceCommandsDashboard from './DeviceCommandsDashboard';
import DeviceCommandControl from './DeviceCommandControl';
import CommandsStatusTable from './CommandsStatusTable';
import IncidentsTable from './IncidentsTable';
import IncidentDetailsTabs from './IncidentDetailsTabs';
import NotificationCenterView from './NotificationCenterView';
import ParentEvidenceVaultView from './EvidenceVaultView';
import CreateExportButton from './CreateExportButton';
import ExportsTable from './ExportsTable';
import HashVerifier from './HashVerifier';
import CustodyTimeline from './CustodyTimeline';
import ParentSafetyPlaybookHub from './SafetyPlaybookHub';

interface ParentOpsConsoleViewProps {
  lang: 'ar' | 'en';
  currentUser: ParentAccount;
  children: Child[];
  alerts: MonitoringAlert[];
}

type OpsTab =
  | 'commands'
  | 'incidents'
  | 'notifications'
  | 'evidence'
  | 'exports'
  | 'custody'
  | 'verify'
  | 'playbooks';

const downloadJson = (payload: any, filename: string) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const ParentOpsConsoleView: React.FC<ParentOpsConsoleViewProps> = ({
  lang,
  currentUser,
  children,
  alerts,
}) => {
  const [tab, setTab] = useState<OpsTab>('commands');
  const [logs, setLogs] = useState<DeviceCommandAudit[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [custodyRows, setCustodyRows] = useState<EvidenceCustody[]>([]);
  const [exportsData, setExportsData] = useState<ForensicExport[]>([]);
  const [isCreatingExport, setIsCreatingExport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [retentionDays, setRetentionDays] = useState(30);
  const [keepCritical, setKeepCritical] = useState(true);
  const [purgePlan, setPurgePlan] = useState<EvidencePurgePlan | null>(null);
  const [isBuildingPurgePlan, setIsBuildingPurgePlan] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ deleted: number; failed: number } | null>(null);
  const { requireStepUp, modal: stepUpModal } = useStepUpGuard({
    lang,
    currentUser,
  });

  const incidents = useMemo(
    () => sovereignApi.listIncidentsFromAlerts(alerts, children),
    [alerts, children]
  );

  const selectedIncident: IncidentReport | null = useMemo(() => {
    if (!incidents.length) return null;
    if (!selectedIncidentId) return incidents[0];
    return incidents.find((x) => x.incident_id === selectedIncidentId) || incidents[0];
  }, [incidents, selectedIncidentId]);

  const selectedIncidentKey = selectedIncident?.incident_id.replace(/^INC-/, '') || '';

  const evidenceRecords = useMemo<EvidenceRecord[]>(
    () =>
      alerts.map((alert) => ({
        ...(alert as EvidenceRecord),
        suspectUsername:
          (alert as any).suspectUsername ||
          `unknown_${String(alert.id || '').slice(0, 6)}`,
        conversationLog: Array.isArray((alert as any).conversationLog)
          ? (alert as any).conversationLog
          : [],
      })),
    [alerts]
  );

  const selectedIncidentRecords = useMemo(() => {
    if (!selectedIncident) return evidenceRecords;
    return evidenceRecords.filter(
      (record) =>
        record.id === selectedIncidentKey ||
        record.childName === selectedIncident.childName
    );
  }, [evidenceRecords, selectedIncident, selectedIncidentKey]);

  const selectedIncidentAudits = useMemo(() => {
    if (!selectedIncident) return logs;
    return logs.filter(
      (row) =>
        row.child_id === selectedIncident.child_id ||
        row.command_id.includes(selectedIncidentKey)
    );
  }, [logs, selectedIncident, selectedIncidentKey]);

  const legalHoldRecordIds = useMemo(() => {
    const holdChildren = new Set(
      incidents.filter((incident) => incident.legal_hold).map((incident) => incident.childName)
    );
    return evidenceRecords
      .filter((record) => holdChildren.has(record.childName))
      .map((record) => record.id);
  }, [incidents, evidenceRecords]);

  useEffect(() => {
    setSelectedIncidentId((prev) => prev || incidents[0]?.incident_id || '');
  }, [incidents]);

  useEffect(() => {
    const unsub = subscribeToAuditLogs(currentUser.id, (rows) => setLogs(rows));
    return () => unsub();
  }, [currentUser.id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!selectedIncident?.incident_id) {
        setCustodyRows([]);
        return;
      }
      const incidentKey = selectedIncident.incident_id.replace(/^INC-/, '');
      const rows = await fetchCustodyByIncident(currentUser.id, incidentKey);
      if (!active) return;
      setCustodyRows(rows);
    };
    load();
    return () => {
      active = false;
    };
  }, [currentUser.id, selectedIncident?.incident_id]);

  const allLocksDisabledUntilTs = Number(currentUser.enabledFeatures?.allLocksDisabledUntil || 0);
  const allLocksDisabledTemporarily = allLocksDisabledUntilTs > Date.now();
  const allLocksDisabledPermanently =
    currentUser.enabledFeatures?.allLocksDisabledPermanently === true;
  const allLocksDisabled = allLocksDisabledPermanently || allLocksDisabledTemporarily;
  const lockDisableLabel =
    lang === 'ar'
      ? allLocksDisabledPermanently
        ? 'تعطيل دائم مفعل من الإعدادات.'
        : allLocksDisabledTemporarily
          ? `تعطيل مؤقت مفعل حتى ${new Date(allLocksDisabledUntilTs).toLocaleString('ar-EG')}.`
          : ''
      : allLocksDisabledPermanently
        ? 'Permanent lock disable is enabled from settings.'
        : allLocksDisabledTemporarily
          ? `Temporary lock disable is active until ${new Date(allLocksDisabledUntilTs).toLocaleString('en-US')}.`
          : '';

  const onSendCommand = async (childId: string, command: string, payload?: any) => {
    const createdAt = new Date().toISOString();
    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isLockCommand = command === 'lockDevice' || command === 'lockscreenBlackout';

    if (allLocksDisabled && isLockCommand) {
      await logAuditEvent(currentUser.id, {
        command_id: commandId,
        child_id: childId,
        actor_user_id: currentUser.id,
        actor_role: currentUser.role,
        command_type: command,
        payload: payload || true,
        status: 'failed',
        error_message:
          lang === 'ar'
            ? 'تم حظر أمر القفل لأن تعطيل جميع الأقفال مفعل.'
            : 'Lock command blocked because all locks are disabled in settings.',
        created_at: createdAt,
        updated_at: createdAt,
      });
      return;
    }

    await logAuditEvent(currentUser.id, {
      command_id: commandId,
      child_id: childId,
      actor_user_id: currentUser.id,
      actor_role: currentUser.role,
      command_type: command,
      payload: payload || true,
      status: 'queued',
      created_at: createdAt,
      updated_at: createdAt,
    });
    try {
      await sendRemoteCommand(childId, command, payload ?? true);
      await logAuditEvent(currentUser.id, {
        command_id: commandId,
        child_id: childId,
        actor_user_id: currentUser.id,
        actor_role: currentUser.role,
        command_type: command,
        payload: payload || true,
        status: 'acked',
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      });
    } catch (error: any) {
      await logAuditEvent(currentUser.id, {
        command_id: commandId,
        child_id: childId,
        actor_user_id: currentUser.id,
        actor_role: currentUser.role,
        command_type: command,
        payload: payload || true,
        status: 'failed',
        error_message: String(error?.message || 'Unknown error'),
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      });
    }
  };

  const createExport = async () => {
    const incident = selectedIncident;
    if (!incident || isCreatingExport) return;

    setIsCreatingExport(true);
    setExportError(null);

    try {
      const manifest = await buildEvidencePackageManifest({
        parentId: currentUser.id,
        incidentId: incident.incident_id,
        exportedBy: currentUser.name,
        records: selectedIncidentRecords,
        custody: custodyRows,
        audits: selectedIncidentAudits,
      });

      const row: ForensicExport = {
        export_id: `EXP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        incident_id: incident.incident_id,
        generated_at: manifest.generatedAt,
        sha256_hash: manifest.hashes.packageSha256,
        status: 'READY',
        manifest_json: {
          manifest,
          records: selectedIncidentRecords,
          custody: custodyRows,
          audits: selectedIncidentAudits,
        },
        metadata: {
          examiner: currentUser.name,
          classification: incident.legal_hold ? 'LEGAL_HOLD' : 'CONFIDENTIAL',
          evidence_count: manifest.counts.records,
          commands_count: manifest.counts.audits,
        },
      };

      setExportsData((prev) => [row, ...prev]);

      await logAuditEvent(currentUser.id, {
        command_id: `export-${Date.now()}`,
        child_id: incident.child_id || 'unknown-child',
        actor_user_id: currentUser.id,
        actor_role: currentUser.role,
        command_type: 'evidence_export',
        payload: {
          incidentId: incident.incident_id,
          manifestHash: manifest.hashes.packageSha256,
          counts: manifest.counts,
        },
        status: 'done',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Export generation failed', error);
      setExportError(
        lang === 'ar'
          ? 'تعذر إنشاء الحزمة الجنائية. حاول مجددًا.'
          : 'Failed to build forensic package. Please retry.'
      );
    } finally {
      setIsCreatingExport(false);
    }
  };

  const downloadExportPackage = (entry: ForensicExport) => {
    if (!entry.manifest_json) return;
    const incidentSafe = String(entry.incident_id || 'incident').replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = `amanah_export_${incidentSafe}_${entry.export_id}.json`;
    downloadJson(entry.manifest_json, file);
  };

  const previewPurgePlan = async () => {
    setIsBuildingPurgePlan(true);
    try {
      const plan = buildEvidencePurgePlan(evidenceRecords, {
        retentionDays,
        keepCritical,
        legalHoldIds: legalHoldRecordIds,
      });
      setPurgePlan(plan);
      setPurgeResult(null);
    } finally {
      setIsBuildingPurgePlan(false);
    }
  };

  const runPurgePlan = async () => {
    if (!purgePlan || isPurging) return;

    setIsPurging(true);
    try {
      const result = await executeEvidencePurgePlan(purgePlan, deleteAlertFromDB);
      setPurgeResult(result);

      await logAuditEvent(currentUser.id, {
        command_id: `purge-${Date.now()}`,
        child_id: selectedIncident?.child_id || 'all-children',
        actor_user_id: currentUser.id,
        actor_role: currentUser.role,
        command_type: 'evidence_purge',
        payload: {
          retentionDays,
          keepCritical,
          plannedDelete: purgePlan.summary.deleteCount,
          executedDelete: result.deleted,
          failed: result.failed,
        },
        status: result.failed > 0 ? 'failed' : 'done',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Purge execution failed', error);
    } finally {
      setIsPurging(false);
    }
  };

  const sidebarItems: Array<{ id: OpsTab; label: string }> = [
    { id: 'commands', label: lang === 'ar' ? 'الأوامر' : 'Commands' },
    { id: 'incidents', label: lang === 'ar' ? 'الحوادث' : 'Incidents' },
    { id: 'notifications', label: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
    { id: 'evidence', label: lang === 'ar' ? 'الأدلة' : 'Evidence' },
    { id: 'exports', label: lang === 'ar' ? 'التصدير' : 'Exports' },
    { id: 'custody', label: lang === 'ar' ? 'الحيازة' : 'Custody' },
    { id: 'verify', label: lang === 'ar' ? 'التحقق' : 'Verify' },
    { id: 'playbooks', label: 'Playbooks' },
  ];

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="rounded-[2.5rem] bg-slate-900 text-white p-8 border-b-8 border-indigo-600">
        <h2 className="text-3xl font-black">
          {lang === 'ar' ? 'كونسول عمليات الوالدين' : 'Parent Ops Console'}
        </h2>
        <p className="text-sm font-bold text-indigo-200 mt-2">{currentUser.name}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-3">
          <ParentSidebar
            lang={lang}
            items={sidebarItems}
            active={tab}
            onSelect={(id) => setTab(id as OpsTab)}
          />
        </div>
        <div className="xl:col-span-9 space-y-4">
          {tab === 'commands' && (
            <>
              <DeviceCommandsDashboard lang={lang} logs={logs} />
              <DeviceCommandControl
                lang={lang}
                children={children}
                onSendCommand={onSendCommand}
                allLocksDisabled={allLocksDisabled}
                lockDisableLabel={lockDisableLabel}
              />
              <CommandsStatusTable lang={lang} logs={logs} />
            </>
          )}

          {tab === 'incidents' && (
            <>
              <IncidentsTable
                lang={lang}
                incidents={incidents}
                selectedIncidentId={selectedIncident?.incident_id}
                onSelect={setSelectedIncidentId}
              />
              <IncidentDetailsTabs lang={lang} incident={selectedIncident} />
            </>
          )}

          {tab === 'notifications' && <NotificationCenterView lang={lang} alerts={alerts} />}

          {tab === 'evidence' && (
            <>
              <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-4">
                <h4 className="text-lg font-black text-slate-900">
                  {lang === 'ar' ? 'خطة حذف الأدلة التلقائية' : 'Auto Evidence Purge Plan'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <label className="block">
                    <span className="text-[11px] font-black text-slate-500">
                      {lang === 'ar' ? 'الاحتفاظ بالأيام' : 'Retention days'}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(Math.max(1, Number(e.target.value) || 30))}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-black text-slate-700 mb-2">
                    <input
                      type="checkbox"
                      checked={keepCritical}
                      onChange={(e) => setKeepCritical(e.target.checked)}
                    />
                    {lang === 'ar' ? 'الاحتفاظ بالحالات الحرجة' : 'Keep critical evidence'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      void previewPurgePlan();
                    }}
                    disabled={isBuildingPurgePlan}
                    className="h-11 rounded-xl bg-slate-900 text-white font-black text-sm disabled:opacity-50"
                  >
                    {isBuildingPurgePlan
                      ? lang === 'ar'
                        ? 'جاري التحليل...'
                        : 'Analyzing...'
                      : lang === 'ar'
                        ? 'معاينة الخطة'
                        : 'Preview Plan'}
                  </button>
                </div>

                {purgePlan && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                    <p className="text-sm font-black text-slate-800">
                      {lang === 'ar'
                        ? `سيتم حذف ${purgePlan.summary.deleteCount} سجل والاحتفاظ بـ ${purgePlan.summary.keepCount} سجل.`
                        : `Will delete ${purgePlan.summary.deleteCount} and keep ${purgePlan.summary.keepCount} records.`}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {lang === 'ar' ? 'عتبة الحذف:' : 'Threshold:'} {purgePlan.summary.thresholdIso}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void requireStepUp('DELETE_EVIDENCE', runPurgePlan);
                      }}
                      disabled={isPurging || purgePlan.summary.deleteCount === 0}
                      className="h-11 px-5 rounded-xl bg-rose-600 text-white font-black text-sm disabled:opacity-50"
                    >
                      {isPurging
                        ? lang === 'ar'
                          ? 'جاري التنفيذ...'
                          : 'Executing...'
                        : lang === 'ar'
                          ? 'تنفيذ الحذف'
                          : 'Execute Purge'}
                    </button>
                  </div>
                )}

                {purgeResult && (
                  <p className="text-sm font-black text-slate-700">
                    {lang === 'ar'
                      ? `النتيجة: حذف ${purgeResult.deleted} وفشل ${purgeResult.failed}.`
                      : `Result: deleted ${purgeResult.deleted}, failed ${purgeResult.failed}.`}
                  </p>
                )}
              </div>
              <ParentEvidenceVaultView lang={lang} records={alerts} />
            </>
          )}

          {tab === 'exports' && (
            <>
              <CreateExportButton
                lang={lang}
                onCreate={() => {
                  void requireStepUp('EXPORT_EVIDENCE', createExport);
                }}
                isBusy={isCreatingExport}
                disabled={!selectedIncident}
              />
              {exportError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm font-black">
                  {exportError}
                </div>
              )}
              <ExportsTable
                lang={lang}
                exportsData={exportsData}
                onDownload={downloadExportPackage}
              />
            </>
          )}

          {tab === 'custody' && <CustodyTimeline lang={lang} rows={custodyRows} />}

          {tab === 'verify' && <HashVerifier lang={lang} />}

          {tab === 'playbooks' && <ParentSafetyPlaybookHub lang={lang} currentUser={currentUser} />}
        </div>
      </div>
      {stepUpModal}
    </div>
  );
};

export default ParentOpsConsoleView;
