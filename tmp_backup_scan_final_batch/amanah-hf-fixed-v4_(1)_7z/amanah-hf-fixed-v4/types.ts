
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
  SAFE = 'آمن',
  OTHER = 'أخرى'
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

// Added missing AppUsage interface
export interface AppUsage {
  id: string;
  appName: string;
  icon: string;
  minutesUsed: number;
  isBlocked: boolean;
}

// Added missing ChildLocation interface
export interface ChildLocation {
  lat: number;
  lng: number;
  address: string;
  lastUpdated: Date;
}

// Added missing PsychologicalProfile interface
export interface PsychologicalProfile {
  anxietyLevel: number;
  moodScore: number;
  dominantEmotion: string;
  isolationRisk: number;
  recentKeywords: string[];
}

// Added missing CallRecord interface
export interface CallRecord {
  id: string;
  contactName: string;
  duration: string;
  timestamp: Date;
  type: 'INCOMING' | 'OUTGOING' | 'MISSED';
}

// Added missing CustomMode interface
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

export interface Child extends FamilyMember {
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
  appUsage: AppUsage[]; // Changed from any[] to AppUsage[]
  location?: ChildLocation; // Changed from any to ChildLocation
  psychProfile?: PsychologicalProfile; // Changed from any to PsychologicalProfile
}

export interface ParentAccount extends FamilyMember {
  pushEnabled?: boolean;
  twoFASecret?: string;
  biometricId?: string;
}

// Keep existing helper types
export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
  isSuspect: boolean;
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
  suspectId?: string; // Added for EmergencyOverlay and Evidence consistency
}

// Added missing EvidenceRecord interface
export interface EvidenceRecord extends MonitoringAlert {
  suspectUsername: string;
  conversationLog: ChatMessage[];
}
