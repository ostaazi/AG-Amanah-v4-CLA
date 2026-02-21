import React, { useEffect, useMemo, useState } from 'react';
import {
  DeviceHealthSnapshot,
  detectHealthAlerts,
  getAllDeviceHealth,
  getHealthHistory,
  HealthAlert,
  HealthHistoryPoint,
  computeHealthScore,
} from '../services/systemHealthService';
import { formatTimeDefault } from '../services/dateTimeFormat';

interface SystemHealthViewProps {
  parentId: string;
  lang: 'ar' | 'en';
}

const severityClass = (severity: HealthAlert['severity']) => {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'HIGH':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'MEDIUM':
      return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const formatAgo = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatMinutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const SystemHealthView: React.FC<SystemHealthViewProps> = ({ parentId }) => {
  const [rows, setRows] = useState<DeviceHealthSnapshot[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<HealthHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const labels = useMemo(
    () => ({
      title: 'System Health Dashboard',
      subtitle: 'Live monitoring for battery, connectivity, permissions, and protection service stability.',
      refresh: 'Refresh Now',
      monitored: 'Monitored Devices',
      avgScore: 'Average Score',
      critical: 'Critical Alerts',
      battery: 'Battery',
      network: 'Network',
      uptime: 'Uptime',
      heartbeat: 'Last Heartbeat',
      perms: 'Permissions',
      appVersion: 'App Version',
      history: 'Last 24h Trend',
      noHistory: 'No sufficient history yet.',
      alerts: 'Active Health Alerts',
      noAlerts: 'No active alerts',
    }),
    []
  );

  const refresh = async () => {
    if (!parentId) return;
    setIsLoading(true);
    try {
      const snapshots = await getAllDeviceHealth(parentId);
      setRows(snapshots);
      setLastRefreshAt(new Date());
      if (!selectedChildId && snapshots[0]?.childId) {
        setSelectedChildId(snapshots[0].childId);
      } else if (selectedChildId && snapshots.every((x) => x.childId !== selectedChildId)) {
        setSelectedChildId(snapshots[0]?.childId || '');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [parentId]);

  useEffect(() => {
    if (!selectedChildId) {
      setSelectedHistory([]);
      return;
    }
    let active = true;
    const loadHistory = async () => {
      const rows = await getHealthHistory(selectedChildId, 24);
      if (!active) return;
      setSelectedHistory(rows);
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [selectedChildId, lastRefreshAt?.getTime()]);

  const computed = useMemo(() => {
    return rows.map((snapshot) => {
      const score = computeHealthScore(snapshot);
      const alerts = detectHealthAlerts(snapshot);
      return { snapshot, score, alerts };
    });
  }, [rows]);

  const avgScore = useMemo(() => {
    if (!computed.length) return 0;
    return Math.round(computed.reduce((sum, row) => sum + row.score.overall, 0) / computed.length);
  }, [computed]);

  const criticalCount = useMemo(
    () => computed.reduce((sum, row) => sum + row.alerts.filter((x) => x.severity === 'CRITICAL').length, 0),
    [computed]
  );

  const selected = computed.find((row) => row.snapshot.childId === selectedChildId) || computed[0];

  return (
    <div className="space-y-6" dir="ltr">
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 border-b-8 border-cyan-600 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">{labels.title}</h2>
          <p className="text-sm font-bold text-slate-200 mt-2">{labels.subtitle}</p>
          {lastRefreshAt && (
            <p className="text-[11px] text-slate-300 mt-2">
              Last refresh:{' '}
              {formatTimeDefault(lastRefreshAt, { includeSeconds: true })}
            </p>
          )}
        </div>
        <button
          onClick={() => void refresh()}
          className="px-5 py-2 rounded-xl bg-cyan-600 font-black text-sm hover:bg-cyan-500 transition-colors"
        >
          {labels.refresh}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{labels.monitored}</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{rows.length}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{labels.avgScore}</p>
          <p className="text-3xl font-black text-cyan-700 mt-2">{avgScore}%</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{labels.critical}</p>
          <p className="text-3xl font-black text-rose-700 mt-2">{criticalCount}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-500 font-black">
          Loading health telemetry...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {computed.map((row) => (
            <button
              key={row.snapshot.childId}
              onClick={() => setSelectedChildId(row.snapshot.childId)}
              className={`text-left rounded-2xl border p-5 bg-white transition-all ${
                selected?.snapshot.childId === row.snapshot.childId
                  ? 'border-cyan-300 shadow-md'
                  : 'border-slate-100 hover:border-cyan-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-900">{row.snapshot.childName || row.snapshot.childId}</p>
                  <p className="text-[11px] font-bold text-slate-500 mt-1">
                    {labels.appVersion}: {row.snapshot.appVersion} | Android {row.snapshot.osVersion}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-black">
                  {row.score.overall}%
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-100 mt-4 overflow-hidden">
                <div
                  className="h-full bg-cyan-500"
                  style={{ width: `${Math.max(4, Math.min(100, row.score.overall))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 text-[12px] font-bold text-slate-700">
                <div>{labels.battery}: {row.snapshot.batteryLevel}%</div>
                <div>{labels.network}: {row.snapshot.networkType}</div>
                <div>{labels.uptime}: {formatMinutes(row.snapshot.uptimeMinutes)}</div>
                <div>{labels.heartbeat}: {formatAgo(row.snapshot.lastHeartbeat)}</div>
                <div>
                  {labels.perms}:{' '}
                  {row.snapshot.permissionsGranted.filter((x) => x.required && x.granted).length}/
                  {row.snapshot.permissionsGranted.filter((x) => x.required).length}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{labels.history}</p>
          {selectedHistory.length === 0 ? (
            <p className="text-sm font-bold text-slate-500 mt-3">{labels.noHistory}</p>
          ) : (
            <div className="space-y-2 mt-3">
              {selectedHistory.slice(-12).map((point, index) => (
                <div key={`${point.timestamp.toISOString()}-${index}`} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-500 min-w-[72px]">
                    {formatTimeDefault(point.timestamp, { includeSeconds: false })}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500"
                      style={{ width: `${Math.max(4, Math.min(100, point.score))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black text-slate-700 min-w-[36px] text-right">
                    {point.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-500">{labels.alerts}</p>
          {selected && selected.alerts.length > 0 ? (
            <div className="space-y-2 mt-3">
              {selected.alerts.map((alert, index) => (
                <div
                  key={`${alert.type}-${index}`}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold ${severityClass(alert.severity)}`}
                >
                  {alert.message}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-500 mt-3">{labels.noAlerts}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemHealthView;

