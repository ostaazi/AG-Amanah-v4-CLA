

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
  // Fix: Removed duplicate PHISHING_LINK entry
  PHISHING_LINK = 'رابط مشبوه',
  SAFE = 'آمن'
}

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'CHILD';

export interface Device {
  id: string;
  model: string;
  os: string;
  lastActive: Date;
}

export interface FamilyMember {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  avatar: string;
  devices?: Device[];
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
  // Fix: Added missing recommendation property to PsychologicalProfile interface
  recommendation: string;
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

export interface Child extends FamilyMember {
  // Added parentId to fix reference errors in components
  parentId: string;
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
  appUsage: AppUsage[];
  location?: ChildLocation;
  psychProfile?: PsychologicalProfile;
}

export interface ParentAccount extends FamilyMember {
  pushEnabled?: boolean;
  twoFASecret?: string;
  biometricId?: string;
  backupCodes?: string[];
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

/**
 * CustomMode interface defines rules and restrictions for a specific operational mode
 */
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