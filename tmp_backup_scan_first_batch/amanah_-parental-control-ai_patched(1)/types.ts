
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

export type SensitivityLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'CHILD';

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
  isSuspect: boolean;
}

export interface CustomMode {
  id: string;
  name: string;
  color: string;
  icon: string;
  allowedApps: string[];
  allowedUrls: string[];
  blacklistedUrls: string[]; // القائمة السوداء
  cameraEnabled: boolean;
  micEnabled: boolean;
  isInternetCut: boolean;
  isScreenDimmed: boolean;
  isDeviceLocked: boolean;
  internetStartTime: string;
  internetEndTime: string;
  activeDays: number[];
  geofenceRadius?: number; // تفعيل الوضع بناءً على التواجد في مكان ما
}

export interface EvidenceRecord {
  id: string;
  suspectUsername: string;
  platform: string;
  childName: string;
  severity: AlertSeverity;
  encryptionKey: string;
  conversationLog: ChatMessage[];
  timestamp: Date;
}

export interface CallRecord {
  id: string;
  callerName: string;
  phoneNumber: string;
  durationSeconds: number;
  timestamp: Date;
  type: 'incoming' | 'outgoing' | 'missed';
}

export interface ChildLocation {
  lat: number;
  lng: number;
  address: string;
  lastUpdated: Date;
}

export interface AppUsage {
  id: string;
  appName: string;
  icon: string;
  minutesUsed: number;
  isBlocked: boolean;
  category: 'games' | 'social' | 'education' | 'entertainment' | 'other';
  lastUsed: Date;
}

export interface PsychologicalProfile {
  moodScore: number;
  dominantEmotion: string;
  anxietyLevel: number;
  isolationRisk: number;
  futurePrediction: string;
  recentKeywords: string[];
  recommendation: string;
  lastAnalysisDate: Date;
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
  latency?: string; // زمن الرصد
  suspectId?: string; // معرف المشتبه به
}

export interface Child {
  id: string;
  name: string;
  avatar: string;
  age: number;
  status: 'online' | 'offline';
  deviceModel: string;
  batteryLevel: number; // نبض الجهاز
  signalStrength: number; // نبض الجهاز
  screenTimeLimit: number;
  currentScreenTime: number;
  location?: ChildLocation;
  appUsage: AppUsage[];
  callLogs: CallRecord[];
  deviceLocked: boolean;
  cameraBlocked: boolean;
  micBlocked: boolean;
  preventAppInstall: boolean;
  psychProfile?: PsychologicalProfile;
}

export interface ParentAccount {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}
