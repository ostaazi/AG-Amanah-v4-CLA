import React, { useEffect, useState } from 'react';
import { EvidenceCustody } from '../types';
import { fetchCustodyByIncident } from '../services/firestoreService';
import { verifyChainIntegrity } from '../services/forensicsService';
import { formatDateTimeDefault } from '../services/dateTimeFormat';

interface ChainOfCustodyViewProps {
  parentId: string;
  incidentId: string;
  lang: 'ar' | 'en';
}

const ChainOfCustodyView: React.FC<ChainOfCustodyViewProps> = ({ parentId, incidentId, lang }) => {
  const [rows, setRows] = useState<EvidenceCustody[]>([]);
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const data = await fetchCustodyByIncident(parentId, incidentId);
      if (!active) return;
      setRows(data);
      setIsValid(await verifyChainIntegrity(data));
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [parentId, incidentId]);

  const t = lang === 'ar'
    ? {
        title: 'سلسلة حيازة الأدلة',
        loading: 'جاري تحميل السلسلة...',
        empty: 'لا توجد أحداث مسجلة.',
        valid: 'السلسلة سليمة',
        invalid: 'السلسلة غير سليمة',
      }
    : {
        title: 'Evidence Custody Chain',
        loading: 'Loading custody chain...',
        empty: 'No custody events found.',
        valid: 'Chain is valid',
        invalid: 'Chain failed integrity check',
      };

  return (
    <div className="space-y-5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
        <h3 className="text-2xl font-black text-slate-900">{t.title}</h3>
        <p className="text-sm font-bold text-slate-500 mt-2">{incidentId}</p>
      </div>

      {!loading && (
        <div
          className={`rounded-2xl border p-4 text-sm font-black ${
            isValid === null
              ? 'bg-slate-50 border-slate-200 text-slate-600'
              : isValid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {isValid === null ? '-' : isValid ? t.valid : t.invalid}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
        {loading ? (
          <div className="text-center py-8 font-black text-slate-500">{t.loading}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 font-black text-slate-400">{t.empty}</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.custody_id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-500">
                  <span>{row.event_key}</span>
                  <span>{formatDateTimeDefault(row.created_at, { includeSeconds: true })}</span>
                </div>
                <p className="text-sm font-black text-slate-800 mt-2">
                  {row.action} • {row.actor}
                </p>
                <p className="text-[10px] font-mono text-slate-500 mt-1 break-all">
                  {row.hash_hex}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChainOfCustodyView;
