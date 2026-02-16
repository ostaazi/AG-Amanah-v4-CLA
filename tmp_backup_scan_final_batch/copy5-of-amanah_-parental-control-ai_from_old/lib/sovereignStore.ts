
import { 
  EvidenceItem, 
  EvidenceCustody, 
  Protocol, 
  Category, 
  AlertSeverity,
  Classification,
  ContentType
} from '../types';

/**
 * Amanah Sovereign Store v1.0
 * محاكي قاعدة بيانات Firestore/Postgres في الذاكرة لضمان استقرار العروض التوضيحية
 */

type SovereignDB = {
  evidence: EvidenceItem[];
  custody: Map<string, EvidenceCustody[]>;
  protocols: Protocol[];
  notes: Map<string, string>;
  idempotencyKeys: Set<string>;
};

let _db: SovereignDB | null = null;

const buildMockProtocols = (): Protocol[] => [
  {
    protocol_id: 'pb-grooming',
    name: 'بروتوكول مكافحة الاستدراج (Luring Defense)',
    incident_type: Category.PREDATOR,
    enabled: true,
    min_severity: AlertSeverity.HIGH,
    actions: ['EVIDENCE_CREATE', 'ALERT_SEND', 'APP_KILL', 'NET_QUARANTINE', 'SCREENSHOT_CAPTURE', 'WALKIE_TALKIE_ENABLE'],
    export_allowed: true,
    delete_allowed: false,
    screenshot_interval_sec: 15,
    blackout_message: 'تم قفل الجهاز لدواعي أمنية. يرجى مراجعة الوالدين.',
    version: 1,
    status: 'PUBLISHED',
    updated_at: new Date().toISOString(),
  },
  {
    protocol_id: 'pb-bullying',
    name: 'بروتوكول مكافحة التنمر (Bullying Shield)',
    incident_type: Category.BULLYING,
    enabled: true,
    min_severity: AlertSeverity.MEDIUM,
    actions: ['EVIDENCE_CREATE', 'ALERT_SEND', 'SCREENSHOT_CAPTURE'],
    export_allowed: true,
    delete_allowed: false,
    screenshot_interval_sec: 45,
    blackout_message: 'وضع الحماية النشط مفعل حالياً.',
    version: 1,
    status: 'PUBLISHED',
    updated_at: new Date().toISOString(),
  }
];

export const getStore = (): SovereignDB => {
  if (_db) return _db;

  _db = {
    evidence: [], // سيتم ملؤه عبر التنبيهات
    custody: new Map(),
    protocols: buildMockProtocols(),
    notes: new Map(),
    idempotencyKeys: new Set()
  };
  
  return _db;
};

export const generateSHA256 = () => {
  return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
};
