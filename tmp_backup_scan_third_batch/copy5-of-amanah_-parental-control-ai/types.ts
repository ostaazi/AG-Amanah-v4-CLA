
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'med',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskTrend {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable'
}

export interface MonitoringAlert {
  id: string;
  childName: string;
  platform: string;
  content: string;
  category: string;
  severity: AlertSeverity;
  aiAnalysis: string;
  actionTaken: string;
  timestamp: string | Date;
  imageData?: string;
  latency?: string;
  suspectId?: string;
  suspectUsername?: string;
  conversationLog?: any[];
}

// Added EvidenceRecord mapping
export interface EvidenceRecord extends MonitoringAlert {}

export interface IncidentReport {
  incident_id: string;
  child_id: string;
  childName: string;
  device_id: string;
  incident_type: Category | string;
  severity: AlertSeverity | string;
  status: 'OPEN' | 'CONTAINED' | 'ESCALATED' | 'CLOSED';
  summary: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  created_at: string;
  updated_at: string;
  legal_hold: boolean;
}

export interface EvidenceItem {
  evidence_id: string;
  family_id: string;
  incident_id?: string;
  device_id: string;
  child_id: string;
  title?: string;
  summary: string;
  content_type: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'TEXT';
  severity: AlertSeverity;
  captured_at: string;
  status: 'active' | 'deleted' | 'archived';
  sha256_hex: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'LEGAL_HOLD';
  imageData?: string;
  mime_type: string;
  size_bytes: number;
  retention_days: number;
  dek_wrapped_b64?: string;
  iv_b64?: string;
}

export interface EvidenceCustody {
  custody_id: string;
  evidence_id: string;
  incident_id?: string | null;
  actor: string;
  action: string;
  event_key: string;
  created_at: string;
  hash_hex: string;
  prev_hash_hex: string | null;
  actor_user_id?: string;
  event_json?: any;
  reason?: string;
}

export interface ForensicExport {
  export_id: string;
  incident_id: string;
  generated_at: string;
  sha256_hash: string;
  status: 'READY' | 'PENDING' | 'FAILED';
  manifest_json?: any;
  metadata: {
    examiner: string;
    classification: string;
    evidence_count?: number;
    commands_count?: number;
  };
}

export enum Category {
  BULLYING = 'تنمر إلكتروني',
  SELF_HARM = 'إيذاء النفس',
  ADULT_CONTENT = 'محتوى للبالغين',
  PREDATOR = 'تواصل مشبوه',
  VIOLENCE = 'تحريض على العنف',
  BLACKMAIL = 'ابتزاز',
  SAFE = 'آمن',
  TAMPER = 'تلاعب بالنظام',
  SEXUAL_EXPLOITATION = 'استغلال جنسي'
}

// Added AppUsage interface
export interface AppUsage {
  id: string;
  appName: string;
  icon: string;
  minutesUsed: number;
  isBlocked: boolean;
}

// Added ChildLocation interface
export interface ChildLocation {
  lat: number;
  lng: number;
  address?: string;
  lastUpdated?: Date | string;
}

export interface Child {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  batteryLevel: number;
  signalStrength: number;
  appUsage: AppUsage[];
  parentId: string;
  deviceNickname?: string;
  riskScore?: { childScore: number; trend: RiskTrend };
  riskProfile?: { isCompliant: boolean };
  location?: ChildLocation;
  micBlocked?: boolean;
  cameraBlocked?: boolean;
  preventAppInstall?: boolean;
  preventDeviceLock?: boolean;
  psychProfile?: any;
  defenseConfig?: ProactiveDefenseConfig;
}

// Expanded UserRole to include all roles used in the app
export type UserRole = 
  | 'FAMILY_OWNER' 
  | 'FAMILY_COADMIN' 
  | 'FAMILY_AUDITOR' 
  | 'PLATFORM_ADMIN' 
  | 'DEVELOPER'
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'SRE'
  | 'SOC_ANALYST'
  | 'RELEASE_MANAGER'
  | 'EMERGENCY_GUARDIAN'
  | 'PARENT_OWNER'
  | 'PARENT_GUARDIAN'
  | 'CHILD'
  | 'DEVICE_IDENTITY'
  | 'SUPPORT_TECH';

export interface ParentAccount {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  pairingKey?: string;
  playbooks?: SafetyPlaybook[];
}

// Added FamilyMember interface
export interface FamilyMember {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  familyId?: string;
}

// Added CustomMode interface
export interface CustomMode {
  id: string;
  name: string;
  icon: string;
  color: string;
  allowedApps: string[];
  cameraEnabled: boolean;
  micEnabled: boolean;
  isInternetCut: boolean;
  isDeviceLocked: boolean;
  internetStartTime: string;
  internetEndTime: string;
  activeDays: number[];
  isScreenDimmed?: boolean;
}

// Added ActivityLog interface
export interface ActivityLog {
  id: string;
  parentId: string;
  action: string;
  details: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  timestamp: any;
}

// Added CommandPriority enum
export enum CommandPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Added Classification enum
export enum Classification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  LEGAL_HOLD = 'LEGAL_HOLD'
}

// Added ContentType enum
export enum ContentType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  TEXT = 'TEXT'
}

// Added ProactiveDefenseConfig interface
export interface ProactiveDefenseConfig {
  isEnabled: boolean;
  onTextThreat: {
    lockDevice: boolean;
    blockApp: boolean;
    sendWarning: boolean;
    triggerSiren: boolean;
  };
  onVisualThreat: {
    blockCamera: boolean;
    lockDevice: boolean;
    triggerSiren: boolean;
    blockMic: boolean;
  };
  autoMessage: string;
  sirenType: 'DEFAULT' | 'VOICE_RECORD';
  voiceRecordUrl?: string;
}

// Added SystemPatch interface
export interface SystemPatch {
  id: string;
  vulnId: number;
  title: string;
  appliedBy: string;
  timestamp: Date;
  status: 'COMMITTED' | 'PENDING';
  codeSnippet: string;
}

// Added SafetyPlaybook interface
export interface SafetyPlaybook {
  id: string;
  name: string;
  category: Category;
  minSeverity: AlertSeverity;
  enabled: boolean;
  actions: AutomatedAction[];
}

// Added AutomatedAction interface
export interface AutomatedAction {
  id: string;
  type: 'LOCK_DEVICE' | 'BLOCK_APP' | 'NOTIFY_PARENTS' | 'SIREN' | 'QUARANTINE_NET' | 'DISABLE_HARDWARE';
  isEnabled: boolean;
}

// Added AppPermission type
export type AppPermission = string;

// Added AutoRule interface
export interface AutoRule {
  rule_id: string;
  name: string;
  category: Category;
  min_severity: AlertSeverity;
  enabled: boolean;
  actions_json: string[];
}

// Added IncidentTimelineItem interface
export interface IncidentTimelineItem {
  t: string;
  kind: 'COMMAND' | 'EVIDENCE' | 'AUDIT' | 'AGENT_EVENT';
  data: any;
}

// Added PlatformMetric interface
export interface PlatformMetric {
  apiLatency: string;
  wafDrops: number;
  activeSessions: number;
  dbIsolationStatus: string;
  rateLimitHits: number;
  bruteForceBlocked: number;
}

// Added Protocol interface
export interface Protocol {
  protocol_id: string;
  name: string;
  incident_type: Category;
  enabled: boolean;
  min_severity: AlertSeverity;
  actions: string[];
  export_allowed: boolean;
  delete_allowed: boolean;
  screenshot_interval_sec: number;
  blackout_message: string;
  version: number;
  status: 'PUBLISHED' | 'DRAFT';
  updated_at: string;
}
