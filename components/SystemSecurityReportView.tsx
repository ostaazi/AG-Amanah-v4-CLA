import React, { useEffect, useMemo, useState } from 'react';
import {
  SecurityVulnerability,
  applySystemPatch,
  getPerformanceReport,
  getQualityMetrics,
  runFullSecurityAudit,
  rollbackSystemPatch,
} from '../services/auditService';

interface SystemSecurityReportViewProps {
  parentId: string;
  lang: 'ar' | 'en';
}

const SystemSecurityReportView: React.FC<SystemSecurityReportViewProps> = ({ parentId, lang }) => {
  const [vulns, setVulns] = useState<SecurityVulnerability[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [quality, setQuality] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'تقرير أمان النظام',
            scan: 'إعادة فحص',
            security: 'الثغرات',
            performance: 'الأداء',
            quality: 'الجودة',
            patch: 'تطبيق التصحيح',
            rollback: 'التراجع',
          }
        : {
            title: 'System Security Report',
            scan: 'Re-Scan',
            security: 'Vulnerabilities',
            performance: 'Performance',
            quality: 'Quality',
            patch: 'Apply Patch',
            rollback: 'Rollback',
          },
    [lang]
  );

  const refresh = async () => {
    setLoading(true);
    const [v, p, q] = await Promise.all([
      runFullSecurityAudit(parentId),
      getPerformanceReport(parentId),
      getQualityMetrics(parentId),
    ]);
    setVulns(v);
    setPerformance(p);
    setQuality(q);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [parentId]);

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 border-b-8 border-indigo-600 flex items-center justify-between">
        <h2 className="text-3xl font-black">{t.title}</h2>
        <button onClick={refresh} className="px-5 py-2 rounded-xl bg-indigo-600 font-black">
          {t.scan}
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center font-black text-slate-500">
          {lang === 'ar' ? 'جاري التحليل...' : 'Scanning...'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="text-[11px] font-black text-slate-500">{t.performance}</p>
              <p className="text-2xl font-black text-slate-900 mt-2">{performance?.latency || '-'}</p>
              <p className="text-sm font-bold text-slate-500 mt-1">{performance?.memoryUsage || '-'}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="text-[11px] font-black text-slate-500">{t.quality}</p>
              <div className="space-y-2 mt-2">
                {quality.map((metric, idx) => (
                  <div key={`${metric.label}-${idx}`} className="text-sm font-black text-slate-800">
                    {metric.label}: {metric.score}%
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <p className="text-[11px] font-black text-slate-500">{t.security}</p>
            {vulns.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{v.title}</p>
                    <p className="text-[11px] font-bold text-slate-500">{v.file}</p>
                  </div>
                  {v.status === 'PATCHED' ? (
                    <button
                      onClick={async () => {
                        await rollbackSystemPatch(parentId, v.id);
                        await refresh();
                      }}
                      className="px-4 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-black"
                    >
                      {t.rollback}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await applySystemPatch(parentId, v.id);
                        await refresh();
                      }}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-black"
                    >
                      {t.patch}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SystemSecurityReportView;
