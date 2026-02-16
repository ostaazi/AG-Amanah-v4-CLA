'use client';

import React from 'react';
import { Link } from 'react-router-dom';

export type IncidentRow = {
  incident_id: string;
  device_id: string;
  child_user_id: string | null;
  incident_type: string;
  risk_level: string;
  summary: string;
  detected_at: string;
  status: string;
};

function riskBadge(risk: string) {
  const r = (risk || '').toUpperCase();
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-widest border';
  if (r === 'CRITICAL') return `${base} bg-red-50 text-red-700 border-red-200`;
  if (r === 'HIGH') return `${base} bg-orange-50 text-orange-700 border-orange-200`;
  if (r === 'MEDIUM') return `${base} bg-yellow-50 text-yellow-700 border-yellow-200`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
}

function statusBadge(status: string) {
  const s = (status || '').toUpperCase();
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-widest border';
  if (s === 'OPEN') return `${base} bg-blue-50 text-blue-700 border-blue-200`;
  if (s === 'MITIGATED') return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  if (s === 'CLOSED') return `${base} bg-slate-50 text-slate-700 border-slate-200`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
}

export default function IncidentsTable({
  loading,
  items,
  familyId,
}: {
  loading: boolean;
  items: IncidentRow[];
  familyId: string;
}) {
  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky right-0 z-10 border-b border-slate-200 bg-slate-50 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
              الحادثة (Incident)
            </th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
              الخطورة
            </th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
              الحالة
            </th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
              الجهاز
            </th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
              وقت الرصد
            </th>
            <th className="border-b border-slate-200 px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
              الملخص
            </th>
          </tr>
        </thead>

        <tbody className="bg-white">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-6 py-20 text-center text-sm font-bold text-slate-400 animate-pulse">
                جاري سحب الحوادث من النواة...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-20 text-center text-sm font-bold text-slate-300">
                لا توجد حوادث مسجلة حالياً.
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr key={it.incident_id} className="group hover:bg-slate-50/80 transition-colors">
                <td className="sticky right-0 z-10 border-b border-slate-100 bg-white group-hover:bg-slate-50 px-6 py-4">
                  <Link
                    to={`/incident/${encodeURIComponent(it.incident_id)}`}
                    className="text-sm font-black text-slate-900 hover:text-indigo-600 transition-colors"
                  >
                    {it.incident_type}
                  </Link>
                  <div className="mt-1 text-[9px] font-mono font-bold text-slate-400">
                    ID: {it.incident_id.slice(0, 12)}...
                  </div>
                </td>

                <td className="border-b border-slate-100 px-6 py-4 whitespace-nowrap">
                  <span className={riskBadge(it.risk_level)}>{it.risk_level}</span>
                </td>

                <td className="border-b border-slate-100 px-6 py-4 whitespace-nowrap">
                  <span className={statusBadge(it.status)}>{it.status}</span>
                </td>

                <td className="border-b border-slate-100 px-6 py-4">
                  <div className="font-mono text-[10px] font-bold text-slate-500">{it.device_id}</div>
                </td>

                <td className="border-b border-slate-100 px-6 py-4 text-[11px] font-bold text-slate-600">
                  {new Date(it.detected_at).toLocaleString('ar-EG')}
                </td>

                <td className="border-b border-slate-100 px-6 py-4 text-xs font-bold text-slate-500">
                  <div className="max-w-[400px] truncate leading-relaxed">{it.summary}</div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
           Family Context: <span className="text-slate-600 font-mono">{familyId}</span>
         </p>
      </div>
    </div>
  );
}