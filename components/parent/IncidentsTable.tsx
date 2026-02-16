import React from 'react';
import { IncidentReport } from '../../types';

interface IncidentsTableProps {
  lang: 'ar' | 'en';
  incidents: IncidentReport[];
  selectedIncidentId?: string;
  onSelect: (incidentId: string) => void;
}

const IncidentsTable: React.FC<IncidentsTableProps> = ({
  lang,
  incidents,
  selectedIncidentId,
  onSelect,
}) => (
  <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h4 className="text-lg font-black text-slate-900">
      {lang === 'ar' ? 'جدول الحوادث' : 'Incidents Table'}
    </h4>
    <div className="space-y-2">
      {incidents.slice(0, 20).map((incident) => (
        <button
          key={incident.incident_id}
          onClick={() => onSelect(incident.incident_id)}
          className={`w-full rounded-xl border p-3 text-right ${
            selectedIncidentId === incident.incident_id
              ? 'bg-indigo-50 border-indigo-200'
              : 'bg-slate-50 border-slate-100'
          }`}
        >
          <p className="text-sm font-black text-slate-900">{incident.childName}</p>
          <p className="text-[11px] font-bold text-slate-500">
            {incident.incident_type} • {incident.severity} • {incident.status}
          </p>
        </button>
      ))}
      {incidents.length === 0 && (
        <p className="text-sm font-bold text-slate-400 text-center py-4">
          {lang === 'ar' ? 'لا توجد حوادث.' : 'No incidents.'}
        </p>
      )}
    </div>
  </div>
);

export default IncidentsTable;
