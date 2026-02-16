
import { 
  EvidenceItem, 
  EvidenceCustody, 
  IncidentReport,
  ForensicExport
} from '../types';

export const sovereignApi = {
  // جلب قائمة الحوادث الأمنية النشطة
  listIncidents: async (familyId: string, status: string = 'OPEN'): Promise<IncidentReport[]> => {
    const res = await fetch(`/api/families/${familyId}/incidents?status=${status}`);
    if (!res.ok) throw new Error("Failed to fetch incidents");
    const data = await res.json();
    return data.items;
  },

  // جلب التفاصيل الكاملة لحادثة مع الأدلة
  getIncidentDetails: async (id: string) => {
    // محاكاة استجابة في بيئة التطوير إذا لم يتوفر backend حقيقي
    return {
      incident: {
        incident_id: id,
        childName: 'أحمد',
        device_id: 'DEV-NODE-01',
        incident_type: 'تواصل مشبوه',
        risk_level: 'critical',
        summary: 'رصد محاولة استدراج صريحة عبر تطبيق Instagram تتضمن طلب صور خاصة.',
        detected_at: new Date().toISOString(),
        status: 'OPEN',
        legal_hold: true
      },
      evidence: [
        { evidence_id: 'ev1', evidence_type: 'SCREENSHOT', storage_key: 'path/to/img1.png', mime_type: 'image/png', size_bytes: 450000, sha256_hex: 'a1b2c3...', captured_at: new Date().toISOString() }
      ]
    };
  },

  createExportBundle: async (incidentId: string): Promise<ForensicExport> => {
    // محاكاة POST /api/exports/create
    await new Promise(r => setTimeout(r, 2000));
    return {
      export_id: 'EXP-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      incident_id: incidentId,
      generated_at: new Date().toISOString(),
      sha256_hash: 'f2ca1bb6c7e907d06dafe4687e579fce76b3776e93bc4a0910c8c61ed02b4d73',
      status: 'READY',
      manifest_json: { incident_id: incidentId, version: "1.0-official" },
      metadata: {
        examiner: 'System Admin',
        classification: 'LEGAL_HOLD',
        // Fix: evidence_count and commands_count added to ForensicExport.metadata
        evidence_count: 5,
        commands_count: 3
      }
    };
  },

  getIncidentCustody: async (incidentId: string): Promise<EvidenceCustody[]> => {
    // محاكاة سجلات الحيازة
    return [
      { 
        custody_id: 'c1', 
        evidence_id: 'ev1', 
        // Fix: incident_id added to EvidenceCustody
        incident_id: incidentId, 
        actor: 'DEVICE_AGENT', 
        action: 'CREATE', 
        event_key: 'EVIDENCE_REGISTERED', 
        created_at: new Date().toISOString(), 
        hash_hex: 'h1', 
        prev_hash_hex: '0' 
      }
    ];
  },

  getIncidentCommands: async (incidentId: string) => {
    return {
      items: [
        { command_id: 'cmd1', command_type: 'LOCKSCREEN', status: 'ACKED', issued_at: new Date().toISOString() }
      ]
    };
  }
};
