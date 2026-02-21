import React, { useEffect, useMemo, useState } from 'react';
import {
  ComplianceCheck,
  ComplianceFramework,
  ComplianceStatus,
  ComplianceSummary,
  ConsentRecord,
  DataCollectionItem,
  getComplianceChecks,
  getComplianceSummary,
  getConsentRecords,
  getDataCollectionInventory,
} from '../services/complianceService';
import { formatDateTimeDefault, formatTimeDefault } from '../services/dateTimeFormat';

interface ComplianceDashboardViewProps {
  parentId: string;
  lang: 'ar' | 'en';
}

type FrameworkFilter = 'ALL' | ComplianceFramework;

const statusClass = (status: ComplianceStatus): string => {
  switch (status) {
    case 'COMPLIANT':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PARTIAL':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'NON_COMPLIANT':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

const frameworkCode = (framework: ComplianceFramework): string => {
  if (framework === 'GDPR_K') return 'GDPR-K';
  if (framework === 'LOCAL_POLICY') return 'LOCAL';
  return framework;
};

const ComplianceDashboardView: React.FC<ComplianceDashboardViewProps> = ({ parentId, lang }) => {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [inventory, setInventory] = useState<DataCollectionItem[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [filter, setFilter] = useState<FrameworkFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0648\u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629',
            subtitle:
              '\u0645\u062a\u0627\u0628\u0639\u0629 \u062d\u0627\u0644\u0629 \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a COPPA \u0648 GDPR-K \u0648\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0645\u0646\u0635\u0629.',
            refresh: '\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0622\u0646',
            lastRefresh: '\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b',
            loading: '\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644...',
            overallScore: '\u0627\u0644\u0645\u0624\u0634\u0631 \u0627\u0644\u0639\u0627\u0645',
            checks: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a',
            nonCompliant: '\u062d\u0627\u0644\u0627\u062a \u0639\u062f\u0645 \u0627\u0645\u062a\u062b\u0627\u0644',
            activeConsents: '\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629',
            frameworks: '\u0625\u0637\u0627\u0631\u0627\u062a \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644',
            filter: '\u0627\u0644\u062a\u0635\u0641\u064a\u0629',
            all: '\u0627\u0644\u0643\u0644',
            requirements: '\u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a',
            inventory: '\u062c\u0631\u062f \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',
            consents: '\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629',
            noConsents: '\u0644\u0627 \u064a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a \u0645\u0648\u0627\u0641\u0642\u0629 \u0628\u0639\u062f.',
            noChecks: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629.',
            compliant: '\u0645\u0645\u062a\u062b\u0644',
            partial: '\u062c\u0632\u0626\u064a',
            blocked: '\u063a\u064a\u0631 \u0645\u0645\u062a\u062b\u0644',
            status: '\u0627\u0644\u062d\u0627\u0644\u0629',
            legalBasis: '\u0627\u0644\u0623\u0633\u0627\u0633 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a',
            retention: '\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638',
            encrypted: '\u0627\u0644\u062a\u0634\u0641\u064a\u0631',
            sharedWith: '\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0645\u0639',
            days: '\u064a\u0648\u0645',
            yes: '\u0646\u0639\u0645',
            no: '\u0644\u0627',
            granted: '\u0645\u0645\u0646\u0648\u062d',
            revoked: '\u0645\u0644\u063a\u064a',
          }
        : {
            title: 'Compliance & Privacy Dashboard',
            subtitle: 'Track COPPA, GDPR-K, and local policy readiness from one control surface.',
            refresh: 'Refresh Now',
            lastRefresh: 'Last refresh',
            loading: 'Loading compliance telemetry...',
            overallScore: 'Overall Score',
            checks: 'Total Requirements',
            nonCompliant: 'Non-Compliant',
            activeConsents: 'Active Consents',
            frameworks: 'Framework Breakdown',
            filter: 'Filter',
            all: 'All',
            requirements: 'Requirements',
            inventory: 'Data Collection Inventory',
            consents: 'Consent Records',
            noConsents: 'No consent records yet.',
            noChecks: 'No requirements match the current filter.',
            compliant: 'Compliant',
            partial: 'Partial',
            blocked: 'Non-Compliant',
            status: 'Status',
            legalBasis: 'Legal Basis',
            retention: 'Retention',
            encrypted: 'Encrypted',
            sharedWith: 'Shared With',
            days: 'days',
            yes: 'Yes',
            no: 'No',
            granted: 'Granted',
            revoked: 'Revoked',
          },
    [lang]
  );

  const frameworkLabel = (framework: ComplianceFramework): string => {
    if (framework === 'COPPA') return 'COPPA';
    if (framework === 'GDPR_K') return 'GDPR-K';
    return lang === 'ar' ? '\u0627\u0644\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u0645\u062d\u0644\u064a\u0629' : 'Local Policy';
  };

  const statusLabel = (status: ComplianceStatus): string => {
    if (status === 'COMPLIANT') return t.compliant;
    if (status === 'PARTIAL') return t.partial;
    if (status === 'NON_COMPLIANT') return t.blocked;
    return lang === 'ar' ? '\u063a\u064a\u0631 \u0645\u0642\u064a\u0645' : 'Not Assessed';
  };

  const refresh = async () => {
    if (!parentId) return;
    setLoading(true);
    try {
      const [summaryData, checksData, consentData] = await Promise.all([
        getComplianceSummary(parentId),
        getComplianceChecks(parentId),
        getConsentRecords(parentId),
      ]);
      setSummary(summaryData);
      setChecks(checksData);
      setConsents(consentData);
      setInventory(getDataCollectionInventory());
      setLastRefreshAt(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [parentId]);

  const activeConsents = useMemo(
    () => consents.filter((record) => record.granted && !record.revokedAt).length,
    [consents]
  );

  const filteredChecks = useMemo(() => {
    if (filter === 'ALL') return checks;
    return checks.filter((check) => check.framework === filter);
  }, [checks, filter]);

  const nonCompliantCount = useMemo(
    () => checks.filter((check) => check.status === 'NON_COMPLIANT').length,
    [checks]
  );

  const unencryptedCount = useMemo(
    () => inventory.filter((item) => !item.encrypted).length,
    [inventory]
  );

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 border-b-8 border-emerald-600 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">{t.title}</h2>
          <p className="text-sm font-bold text-slate-200 mt-2">{t.subtitle}</p>
          {lastRefreshAt && (
            <p className="text-[11px] text-slate-300 mt-2">
              {t.lastRefresh}: {formatTimeDefault(lastRefreshAt, { includeSeconds: true })}
            </p>
          )}
        </div>
        <button
          onClick={() => void refresh()}
          className="px-5 py-2 rounded-xl bg-emerald-600 font-black text-sm hover:bg-emerald-500 transition-colors"
        >
          {t.refresh}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{t.overallScore}</p>
          <p className="text-3xl font-black text-emerald-700 mt-2">{summary?.overallScore ?? 0}%</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{t.checks}</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{checks.length}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{t.nonCompliant}</p>
          <p className="text-3xl font-black text-rose-700 mt-2">{nonCompliantCount}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{t.activeConsents}</p>
          <p className="text-3xl font-black text-cyan-700 mt-2">{activeConsents || summary?.activeConsents || 0}</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-500 font-black">
          {t.loading}
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <p className="text-[11px] font-black text-slate-500">{t.frameworks}</p>
              <div className="inline-flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-500">{t.filter}</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as FrameworkFilter)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 bg-white"
                >
                  <option value="ALL">{t.all}</option>
                  <option value="COPPA">COPPA</option>
                  <option value="GDPR_K">GDPR-K</option>
                  <option value="LOCAL_POLICY">{frameworkLabel('LOCAL_POLICY')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(summary?.frameworks || []).map((item) => (
                <div key={item.framework} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">{frameworkLabel(item.framework)}</p>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                      {item.score}%
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 mt-2">
                    {item.compliant} {t.compliant} | {item.partial} {t.partial} | {item.nonCompliant} {t.blocked}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <p className="text-[11px] font-black text-slate-500">{t.requirements}</p>
            {filteredChecks.length === 0 ? (
              <p className="text-sm font-bold text-slate-500 mt-3">{t.noChecks}</p>
            ) : (
              <div className="space-y-2 mt-3">
                {filteredChecks.map((check) => (
                  <div key={check.id} className="rounded-xl border border-slate-100 p-4 bg-slate-50">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {lang === 'ar' ? check.requirementAr : check.requirement}
                        </p>
                        <p className="text-xs font-bold text-slate-500 mt-1">
                          {lang === 'ar' ? check.descriptionAr : check.description}
                        </p>
                        <p className="text-[10px] font-black text-slate-400 mt-2">
                          {frameworkCode(check.framework)} | {check.id}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-lg border text-xs font-black ${statusClass(check.status)}`}>
                        {statusLabel(check.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black text-slate-500">{t.inventory}</p>
                <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                  {unencryptedCount} {lang === 'ar' ? '\u063a\u064a\u0631 \u0645\u0634\u0641\u0631' : 'unencrypted'}
                </span>
              </div>
              <div className="space-y-2 mt-3 max-h-[28rem] overflow-y-auto pr-1">
                {inventory.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-black text-slate-900">{lang === 'ar' ? item.dataTypeAr : item.dataType}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">{lang === 'ar' ? item.purposeAr : item.purpose}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] font-bold text-slate-700">
                      <div>
                        {t.retention}: {item.retentionDays} {t.days}
                      </div>
                      <div>
                        {t.encrypted}: {item.encrypted ? t.yes : t.no}
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 mt-2">
                      {t.legalBasis}: {item.legalBasis}
                    </p>
                    {item.sharedWith.length > 0 && (
                      <p className="text-[10px] font-black text-slate-500 mt-1">
                        {t.sharedWith}: {item.sharedWith.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <p className="text-[11px] font-black text-slate-500">{t.consents}</p>
              {consents.length === 0 ? (
                <p className="text-sm font-bold text-slate-500 mt-3">{t.noConsents}</p>
              ) : (
                <div className="space-y-2 mt-3">
                  {consents.map((record) => {
                    const status = record.granted && !record.revokedAt ? t.granted : t.revoked;
                    const className =
                      record.granted && !record.revokedAt
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200';
                    return (
                      <div key={record.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-slate-900">{record.consentType}</p>
                            <p className="text-[11px] font-bold text-slate-500 mt-1">{record.description}</p>
                            <p className="text-[10px] font-black text-slate-400 mt-2">
                              {formatDateTimeDefault(record.grantedAt, { includeSeconds: true })}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-lg border text-xs font-black ${className}`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ComplianceDashboardView;


