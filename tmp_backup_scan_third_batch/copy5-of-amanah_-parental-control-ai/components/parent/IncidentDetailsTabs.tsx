
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import EvidenceList from './EvidenceList';
import CustodyTimeline, { CustodyEvent } from './CustodyTimeline';
import CommandsStatusTable, { DeviceCommandRow } from './CommandsStatusTable';
import CreateExportButton from './CreateExportButton';

type Incident = {
  incident_id: string;
  family_id: string;
  device_id: string;
  child_user_id: string | null;
  incident_type: string;
  risk_level: string;
  summary: string;
  detected_at: string;
  status: string;
  meta_json: any;
};

function badgeClass(kind: 'risk' | 'status', value: string) {
  const v = (value || '').toUpperCase();
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border shadow-sm';
  if (kind === 'risk') {
    if (v === 'CRITICAL') return `${base} bg-red-600 text-white border-red-700`;
    if (v === 'HIGH') return `${base} bg-orange-500 text-white border-orange-600`;
    if (v === 'MEDIUM') return `${base} bg-yellow-400 text-slate-900 border-yellow-500`;
    return `${base} bg-slate-100 text-slate-700 border-slate-200`;
  }
  if (v === 'OPEN') return `${base} bg-blue-600 text-white border-blue-700`;
  if (v === 'MITIGATED') return `${base} bg-emerald-600 text-white border-emerald-700`;
  if (v === 'CLOSED') return `${base} bg-slate-200 text-slate-700 border-slate-300`;
  return `${base} bg-slate-100 text-slate-700 border-slate-200`;
}

export default function IncidentDetailsTabs({
  incident,
  evidence,
}: {
  incident: Incident;
  evidence: any[];
}) {
  const [tab, setTab] = useState<'evidence' | 'custody' | 'commands'>('evidence');

  const [custody, setCustody] = useState<CustodyEvent[]>([]);
  const [custodyLoading, setCustodyLoading] = useState(false);
  const [custodyErr, setCustodyErr] = useState('');

  const [commands, setCommands] = useState<DeviceCommandRow[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [commandsErr, setCommandsErr] = useState('');

  const incidentId = incident.incident_id;

  async function loadCustody() {
    setCustodyLoading(true);
    setCustodyErr('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/custody`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load custody');
      setCustody(json.items || []);
    } catch (e: any) {
      setCustodyErr(e?.message || 'Unexpected error');
    } finally {
      setCustodyLoading(false);
    }
  }

  async function loadCommands() {
    setCommandsLoading(true);
    setCommandsErr('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/commands`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load commands');
      setCommands(json.items || []);
    } catch (e: any) {
      setCommandsErr(e?.message || 'Unexpected error');
    } finally {
      setCommandsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'custody' && custody.length === 0 && !custodyLoading) loadCustody();
    if (tab === 'commands' && commands.length === 0 && !commandsLoading) loadCommands();
  }, [tab]);

  return (
    <div className="p-8 space-y-10">
      {/* Dynamic Summary Header */}
      <div className="bg-slate-50/50 rounded-[3rem] border border-slate-100 p-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex-1 space-y-6 text-right">
          <div className="flex flex-wrap items-center gap-4 justify-start">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{incident.incident_type}</h2>
            <span className={badgeClass('risk', incident.risk_level)}>{incident.risk_level}</span>
            <span className={badgeClass('status', incident.status)}>{incident.status}</span>
          </div>

          <p className="text-lg font-bold text-slate-600 leading-relaxed italic max-w-2xl">
            "{incident.summary}"
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100" dir="ltr">
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident ID</p>
                <p className="font-mono text-xs font-black text-slate-800">{incident.incident_id.slice(0, 16)}...</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Device</p>
                <p className="font-mono text-xs font-black text-slate-800">{incident.device_id}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Detected</p>
                <p className="text-xs font-black text-slate-800">{new Date(incident.detected_at).toLocaleString('ar-EG')}</p>
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 shrink-0 items-center">
          <CreateExportButton incidentId={incident.incident_id} />
          <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest">Forensic Integrity Guaranteed</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-4 bg-slate-100/50 p-2 rounded-2xl w-fit mr-auto lg:mr-0">
        {[
          { id: 'evidence', label: `الأدلة (${evidence?.length || 0})`, icon: '📂' },
          { id: 'custody', label: 'سجل الحيازة', icon: '📜' },
          { id: 'commands', label: 'الأوامر السيادية', icon: '⚡' }
        ].map(t => (
          <button
            key={t.id}
            className={`px-8 py-4 rounded-xl text-xs font-black transition-all flex items-center gap-3 ${
              tab === t.id ? 'bg-white text-indigo-600 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => setTab(t.id as any)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in duration-500">
        {tab === 'evidence' ? (
          <EvidenceList evidence={evidence || []} />
        ) : tab === 'custody' ? (
          <CustodyTimeline loading={custodyLoading} error={custodyErr} items={custody} />
        ) : (
          <CommandsStatusTable loading={commandsLoading} error={commandsErr} items={commands} />
        )}
      </div>
    </div>
  );
}
