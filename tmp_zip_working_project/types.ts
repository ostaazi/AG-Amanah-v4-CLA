

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum Category {
  BULLYING = 'تنمر إلكتروني',
  SELF_HARM = 'إيذاء النفس',
  ADULT_CONTENT = 'محتوى للبالغين',
  SCAM = 'احتيال',
  PREDATOR = 'تواصل مشبوه',
  VIOLENCE = 'تحريض على العنف',
  BLACKMAIL = 'ابتزاز',
  SEXUAL_EXPLOITATION = 'استغلال جنسي',
  PHISHING_LINK = 'رابط مشبوه',
  SAFE = 'آمن'
}

/**
 * منظومة الرتب السيادية والاجتماعية في أمانة
 */
export type UserRole = 
  // --- أدوار الأسرة (Family Scope) ---
  | 'ADMIN'             // الأب (Family Owner)
  | 'SUPERVISOR'        // الأم (Family Co-Admin)
  | 'FAMILY_AUDITOR'    // مراقب أسري (Read-only)
  | 'CHILD'             // الطفل (Managed Profile)
  
  // --- أدوار السيادة التقنية (Sovereign Staff Scope) ---
  | 'RELEASE_MANAGER'   // مدير الإصدارات
  | 'DEVELOPER'         // مطور النظام
  | 'SOC_ANALYST'       // محلل أمني (Incident Responder)
  | 'SRE'               // مدير النظام (Infra/SRE)
  | 'PLATFORM_ADMIN';   // مدير المنصة العام (Platform Super Admin)

/**
 * رسالة في محادثة
 */
export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
  isSuspect: boolean;
}

/**
 * سجل النشاط
 */
export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'DANGER';
  timestamp: Date;
  parentId: string;
}

/**
 * استخدام التطبيق
 */
export interface AppUsage {
  id: string;
  appName: string;
  icon: string;
  minutesUsed: number;
  isBlocked: boolean;
}

/**
 * الموقع الجغرافي للطفل
 */
export interface ChildLocation {
  lat: number;
  lng: number;
  address: string;
  lastUpdated: Date;
}

export interface SystemPatch {
  id: string;
  vulnId: number;
  title: string;
  appliedBy: string;
  timestamp: Date;
  status: 'TESTING' | 'COMMITTED' | 'ROLLED_BACK';
  codeSnippet: string;
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
  sirenType: 'DEFAULT' | 'VOICE_RECORD' | 'POLICE' | 'URGENT';
  voiceRecordUrl?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  avatar: string;
}

export interface Child extends FamilyMember {
  parentId: string;
  age: number;
  status: 'online' | 'offline';
  batteryLevel: number;
  signalStrength: number;
  deviceLocked: boolean;
  cameraBlocked: boolean;
  micBlocked: boolean;
  preventAppInstall: boolean;
  preventDeviceLock: boolean;
  deviceNickname?: string;
  appUsage: AppUsage[];
  location?: ChildLocation;
  psychProfile?: any;
  defenseConfig?: ProactiveDefenseConfig;
}

export interface ParentAccount extends FamilyMember {
  pairingKey?: string;
}

export interface MonitoringAlert {
  id: string;
  childName: string;
  platform: string;
  content: string;
  imageData?: string; 
  category: Category;
  severity: AlertSeverity;
  timestamp: Date;
  aiAnalysis: string;
  actionTaken?: string;
  latency?: string;
  suspectId?: string;
  status?: string;
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
}
