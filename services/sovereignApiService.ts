import { AlertSeverity, Child, IncidentReport, MonitoringAlert } from '../types';

const riskFromSeverity = (
  severity: AlertSeverity | string
): 'low' | 'medium' | 'high' | 'critical' => {
  const sev = String(severity).toUpperCase();
  if (sev === 'CRITICAL') return 'critical';
  if (sev === 'HIGH') return 'high';
  if (sev === 'MEDIUM') return 'medium';
  return 'low';
};

const tsToDate = (timestamp: Date | string | undefined): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const severityScore = (severity: AlertSeverity | string): number => {
  const sev = String(severity).toUpperCase();
  if (sev === 'CRITICAL') return 4;
  if (sev === 'HIGH') return 3;
  if (sev === 'MEDIUM') return 2;
  return 1;
};

const sortIncidents = (items: IncidentReport[]): IncidentReport[] =>
  [...items].sort((a, b) => {
    const sevDiff = severityScore(b.severity) - severityScore(a.severity);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

export const sovereignApi = {
  listIncidentsFromAlerts: (
    alerts: MonitoringAlert[],
    children: Child[] = []
  ): IncidentReport[] => {
    const mapped = alerts.map((alert) => {
      const ts = tsToDate(alert.timestamp);
      const child = children.find((c) => c.name === alert.childName);
      const riskLevel = riskFromSeverity(alert.severity);

      return {
        incident_id: `INC-${alert.id}`,
        child_id: child?.id || 'unknown-child',
        childName: alert.childName || 'Unknown',
        device_id: child?.id || 'unknown-device',
        incident_type: alert.category || 'Unknown',
        severity: alert.severity || AlertSeverity.LOW,
        status: riskLevel === 'critical' ? 'OPEN' : 'CONTAINED',
        summary: alert.aiAnalysis || alert.content || '',
        risk_level: riskLevel,
        detected_at: ts.toISOString(),
        created_at: ts.toISOString(),
        updated_at: ts.toISOString(),
        legal_hold: riskLevel === 'critical' || riskLevel === 'high',
      } as IncidentReport;
    });

    return sortIncidents(mapped);
  },

  getIncidentById: (
    alerts: MonitoringAlert[],
    incidentId: string,
    children: Child[] = []
  ): IncidentReport | null => {
    const all = sovereignApi.listIncidentsFromAlerts(alerts, children);
    return all.find((item) => item.incident_id === incidentId) || null;
  },
};

