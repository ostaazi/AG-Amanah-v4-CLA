export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum Category {
  BULLYING = '\u062a\u0646\u0645\u0631 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
  SELF_HARM = '\u0625\u064a\u0630\u0627\u0621 \u0627\u0644\u0646\u0641\u0633',
  ADULT_CONTENT = '\u0645\u062d\u062a\u0648\u0649 \u0644\u0644\u0628\u0627\u0644\u063a\u064a\u0646',
  SCAM = '\u0627\u062d\u062a\u064a\u0627\u0644',
  PREDATOR = '\u062a\u0648\u0627\u0635\u0644 \u0645\u0634\u0628\u0648\u0647',
  VIOLENCE = '\u062a\u062d\u0631\u064a\u0636 \u0639\u0644\u0649 \u0627\u0644\u0639\u0646\u0641',
  BLACKMAIL = '\u0627\u0628\u062a\u0632\u0627\u0632',
  SEXUAL_EXPLOITATION = '\u0627\u0633\u062a\u063a\u0644\u0627\u0644 \u062c\u0646\u0633\u064a',
  PHISHING_LINK = '\u0631\u0627\u0628\u0637 \u0645\u0634\u0628\u0648\u0647',
  TAMPER = '\u062a\u0644\u0627\u0639\u0628 \u0628\u0627\u0644\u0646\u0638\u0627\u0645',
  SAFE = '\u0622\u0645\u0646',
}

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

export interface Device {
  id: string;
  model: string;
  os: string;
  lastActive: Date;
  nickname?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  avatar: string;
  devices?: Device[];
  emailVerified?: boolean;
  phoneVerified?: boolean;
  inviteStatus?: 'EMAIL_SENT' | 'PENDING' | 'ACCEPTED' | 'FAILED';
  inviteMethod?: 'EMAIL_LINK' | 'PASSWORD_RESET' | 'CUSTOM_EMAIL';
  inviteSentAt?: Date | any;
}

export interface AppUsage {
  id: string;
  appName: string;
  icon: string;
  minutesUsed: number;
  isBlocked: boolean;
}

export interface ChildLocation {
  lat: number;
  lng: number;
  address: string;
  lastUpdated: Date;
}

export interface PsychologicalProfile {
  anxietyLevel: number;
  moodScore: number;
  dominantEmotion: string;
  isolationRisk: number;
  recentKeywords: string[];
  recommendation: string;
  priorityScenario?:
    | 'bullying'
    | 'threat_exposure'
    | 'gaming'
    | 'inappropriate_content'
    | 'cyber_crime'
    | 'crypto_scams'
    | 'phishing_links'
    | 'self_harm'
    | 'sexual_exploitation'
    | 'account_theft_fraud'
    | 'gambling_betting'
    | 'privacy_tracking'
    | 'harmful_challenges';
  incidentReadinessScore?: number;
  riskSignals?: {
    id: string;
    title: string;
    severity: AlertSeverity;
    reason: string;
    suggestedAction: string;
  }[];
  weeklyTrend?: { label: string; value: number }[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: Date;
  type: 'INFO' | 'WARNING' | 'DANGER' | 'SUCCESS';
}

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

export interface Child extends FamilyMember {
  parentId: string;
  deviceOwnerUid?: string;
  age: number;
  status: 'online' | 'offline';
  batteryLevel: number;
  signalStrength: number;
  screenTimeLimit: number;
  currentScreenTime: number;
  deviceLocked: boolean;
  cameraBlocked: boolean;
  micBlocked: boolean;
  preventAppInstall: boolean;
  preventDeviceLock: boolean;
  deviceNickname?: string;
  appUsage: AppUsage[];
  location?: ChildLocation;
  psychProfile?: PsychologicalProfile;
  riskScore?: { childScore: number; trend: 'up' | 'down' | 'stable' };
  riskProfile?: { isCompliant: boolean };
  defenseConfig?: ProactiveDefenseConfig;
}

export type AlertProtocolMode = 'FULL' | 'SIMPLE' | 'NONE';

export interface ParentFeatureToggles {
  liveMonitor?: boolean;
  evidenceVault?: boolean;
  locationTracking?: boolean;
  psychAnalysis?: boolean;
  webFiltering?: boolean;
  appBlocking?: boolean;
  chatMonitoring?: boolean;
  autoLockInAutomation?: boolean;
  allLocksDisabledPermanently?: boolean;
  allLocksDisabledUntil?: number;
  advancedDefense?: boolean;
  incidentCenter?: boolean;
  forensicExport?: boolean;
  geofence?: boolean;
  commandCenter?: boolean;
  familyRoles?: boolean;
  advisor?: boolean;
  benchmark?: boolean;
  securityReport?: boolean;
  developerHub?: boolean;
}

export interface ParentAccount extends FamilyMember {
  pushEnabled?: boolean;
  twoFASecret?: string;
  biometricId?: string;
  backupCodes?: string[];
  alertProtocol?: AlertProtocolMode;
  emergencyOverlayEnabled?: boolean;
  encryptionSalt?: string;
  encryptionIterations?: number;
  encryptionMigrated?: boolean;
  pairingKey?: string;
  pairingKeyExpiresAt?: Date | any;
  enabledFeatures?: ParentFeatureToggles;
  playbooks?: SafetyPlaybook[];
}

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
  isSuspect: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

export interface MonitoringAlert {
  id: string;
  childId?: string;
  childName: string;
  platform: string;
  content: string;
  imageData?: string;
  captureStatus?: string;
  evidencePayloadVersion?: string;
  evidenceUploadStatus?: string;
  evidenceUploadAttempt?: number;
  evidenceUploadRetryCount?: number;
  evidenceUploadCorrelationId?: string;
  evidenceUploadLastError?: string;
  evidenceUploadSource?: string;
  evidenceUploadQueuedAt?: Date | any;
  evidenceUploadLastAttemptAt?: Date | any;
  evidenceUploadAckAt?: Date | any;
  evidenceMissingFields?: string[];
  evidenceCoreFieldCount?: number;
  evidencePresentFieldCount?: number;
  evidenceCompleteness?: number;
  evidenceHasAllCoreFields?: boolean;
  evidenceBundleSequence?: number;
  sourceLocation?: string;
  category: Category;
  severity: AlertSeverity;
  confidence?: number; // 0-100, alerts below 70 should not trigger auto-lock
  timestamp: Date;
  aiAnalysis: string;
  actionTaken?: string;
  latency?: string;
  suspectId?: string;
  status?: string;
}

export type ChildSignalEventType =
  | 'search_intent'
  | 'watch_intent'
  | 'audio_transcript'
  | 'link_intent'
  | 'conversation_pattern'
  | 'behavioral_drift';

export interface ChildSignalEvent {
  id: string;
  parentId: string;
  childId?: string;
  childName?: string;
  eventType: ChildSignalEventType;
  source: string;
  platform?: string;
  content: string;
  normalizedContent?: string;
  severity?: AlertSeverity;
  confidence?: number;
  scenarioHints?: string[];
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ParentMessage {
  id: string;
  familyId: string;
  childId: string;
  senderName: string;
  senderId: string;
  message: string;
  timestamp: Date;
}

export interface EvidenceRecord extends MonitoringAlert {
  suspectUsername: string;
  conversationLog: ChatMessage[];
}

export interface CustomMode {
  id: string;
  name: string;
  color: string;
  icon: string;
  allowedApps: string[];
  allowedUrls: string[];
  blacklistedUrls: string[];
  cameraEnabled: boolean;
  micEnabled: boolean;
  isInternetCut: boolean;
  isScreenDimmed: boolean;
  isDeviceLocked: boolean;
  internetStartTime: string;
  internetEndTime: string;
  activeDays: number[];
  preferredVideoSource?: 'camera_front' | 'camera_back' | 'screen';
  preferredAudioSource?: 'mic' | 'system';
  autoStartLiveStream?: boolean;
  autoTakeScreenshot?: boolean;
  blackoutOnApply?: boolean;
  blackoutMessage?: string;
  enableWalkieTalkieOnApply?: boolean;
}

export interface PairingRequest {
  id: string;
  parentId: string;
  childName: string;
  model: string;
  os: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: Date | any;
  childDocumentId?: string;
}

export interface IncidentReport {
  incident_id: string;
  child_id: string;
  childName: string;
  device_id: string;
  incident_type: Category | string;
  severity: AlertSeverity | string;
  status: 'OPEN' | 'CONTAINED' | 'ESCALATED' | 'CLOSED';
  summary?: string;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  detected_at?: string;
  created_at: string;
  updated_at: string;
  legal_hold: boolean;
}

export interface EvidenceItem {
  evidence_id: string;
  family_id?: string;
  incident_id?: string;
  device_id?: string;
  child_id?: string;
  title?: string;
  summary: string;
  content_type: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'TEXT';
  severity: AlertSeverity;
  captured_at: string;
  status: 'active' | 'deleted' | 'archived';
  sha256_hex: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'LEGAL_HOLD';
  imageData?: string;
  mime_type?: string;
  size_bytes?: number;
  retention_days?: number;
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

export enum CommandPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface SystemPatch {
  id: string;
  vulnId: number;
  title: string;
  appliedBy: string;
  timestamp: Date;
  status: 'COMMITTED' | 'PENDING';
  codeSnippet: string;
}

export interface AutomatedAction {
  id: string;
  type:
    | 'LOCK_DEVICE'
    | 'BLOCK_APP'
    | 'NOTIFY_PARENTS'
    | 'SIREN'
    | 'QUARANTINE_NET'
    | 'DISABLE_HARDWARE'
    | 'LOCKSCREEN_BLACKOUT'
    | 'WALKIE_TALKIE_ENABLE'
    | 'LIVE_CAMERA_REQUEST'
    | 'SCREENSHOT_CAPTURE';
  isEnabled: boolean;
}

export interface SafetyPlaybook {
  id: string;
  name: string;
  category: Category;
  minSeverity: AlertSeverity;
  enabled: boolean;
  actions: AutomatedAction[];
}

export type AppPermission = string;

export interface AutoRule {
  rule_id: string;
  name: string;
  category: Category;
  min_severity: AlertSeverity;
  enabled: boolean;
  actions_json: string[];
}

export interface IncidentTimelineItem {
  t: string;
  kind: 'COMMAND' | 'EVIDENCE' | 'AUDIT' | 'AGENT_EVENT';
  data: any;
}

export interface PlatformMetric {
  apiLatency: string;
  wafDrops: number;
  activeSessions: number;
  dbIsolationStatus: string;
  rateLimitHits: number;
  bruteForceBlocked: number;
}

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

export interface IncidentExportMeta {
  incident_id: string;
  incident_sha256_hex: string;
  custody_chain_sha256_hex: string;
  policy_snapshot_sha256_hex?: string;
  exported_by?: string;
  exported_at: string;
  format: 'zip' | 'json';
}

export type CommandExecutionStatus =
  | 'queued'
  | 'sent'
  | 'acked'
  | 'done'
  | 'failed'
  | 'expired';

export interface DeviceCommandAudit {
  command_id: string;
  child_id: string;
  actor_user_id?: string;
  actor_role?: UserRole;
  command_type: string;
  payload?: Record<string, any>;
  status: CommandExecutionStatus;
  created_at: string;
  updated_at?: string;
  error_message?: string;
}

export interface StepUpSession {
  session_id: string;
  parent_id: string;
  reason: 'LOCKDOWN' | 'DELETE_EVIDENCE' | 'EXPORT_EVIDENCE' | 'SENSITIVE_SETTINGS';
  method: 'totp' | 'backup_code';
  status: 'pending' | 'verified' | 'expired' | 'revoked';
  issued_at: string;
  expires_at: string;
  verified_at?: string;
}
