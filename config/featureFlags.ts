export type FeatureFlagKey =
  | 'dashboard'
  | 'alerts'
  | 'devices'
  | 'modes'
  | 'simulator'
  | 'evidenceVault'
  | 'psychologicalPulse'
  | 'liveMonitor'
  | 'geoMap'
  | 'developerLab'
  | 'advancedDefense'
  | 'incidentCenter'
  | 'deviceEnrollment'
  | 'familyRoles'
  | 'advisor'
  | 'stepUpSecurity'
  | 'incidentWarRoom'
  | 'playbookHub'
  | 'parentOpsConsole'
  | 'forensics'
  | 'commandCenter'
  | 'developerResolutionHub';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const fromEnv = (key: string, fallback: boolean): boolean => {
  const raw = (import.meta.env[key] as string | undefined)?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

export const FEATURE_FLAGS: FeatureFlags = {
  dashboard: fromEnv('VITE_FF_DASHBOARD', true),
  alerts: fromEnv('VITE_FF_ALERTS', true),
  devices: fromEnv('VITE_FF_DEVICES', true),
  modes: fromEnv('VITE_FF_MODES', true),
  simulator: fromEnv('VITE_FF_SIMULATOR', true),
  evidenceVault: fromEnv('VITE_FF_EVIDENCE_VAULT', true),
  psychologicalPulse: fromEnv('VITE_FF_PSYCHOLOGICAL_PULSE', true),
  liveMonitor: fromEnv('VITE_FF_LIVE_MONITOR', true),
  geoMap: fromEnv('VITE_FF_GEO_MAP', true),
  developerLab: fromEnv('VITE_FF_DEVLAB', true),
  advancedDefense: fromEnv('VITE_FF_ADVANCED_DEFENSE', true),
  incidentCenter: fromEnv('VITE_FF_INCIDENT_CENTER', true),
  deviceEnrollment: fromEnv('VITE_FF_DEVICE_ENROLLMENT', true),
  familyRoles: fromEnv('VITE_FF_FAMILY_ROLES', true),
  advisor: fromEnv('VITE_FF_ADVISOR', true),
  stepUpSecurity: fromEnv('VITE_FF_STEP_UP_SECURITY', true),
  incidentWarRoom: fromEnv('VITE_FF_INCIDENT_WAR_ROOM', true),
  playbookHub: fromEnv('VITE_FF_PLAYBOOK_HUB', true),
  parentOpsConsole: fromEnv('VITE_FF_PARENT_OPS_CONSOLE', true),
  forensics: fromEnv('VITE_FF_FORENSICS', true),
  commandCenter: fromEnv('VITE_FF_COMMAND_CENTER', true),
  developerResolutionHub: fromEnv('VITE_FF_DEVELOPER_RESOLUTION_HUB', true),
};
