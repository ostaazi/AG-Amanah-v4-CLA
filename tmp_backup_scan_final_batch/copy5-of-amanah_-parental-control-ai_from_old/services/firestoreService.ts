
import { db } from "./firebaseConfig";
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    where, 
    getDocs, 
    updateDoc, 
    doc,
    Timestamp,
    deleteDoc
} from "firebase/firestore";
import { 
    MonitoringAlert, 
    ActivityLog, 
    FamilyMember, 
    EvidenceItem, 
    UserRole, 
    CommandPriority 
} from '../types';

/**
 * Added subscribeToActivities: الرصد اللحظي للأنشطة
 */
export const subscribeToActivities = (parentId: string, callback: (activities: ActivityLog[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, "activities"), where("parentId", "==", parentId));
  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
    callback(activities);
  });
};

/**
 * Added fetchIncidents: جلب الحوادث
 */
export const fetchIncidents = async (parentId: string) => {
  if (!db) return [];
  const q = query(collection(db, "alerts"), where("parentId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Added saveAlertToDB: حفظ التنبيهات
 */
export const saveAlertToDB = async (parentId: string, alertData: any) => {
  if (!db) return;
  return await addDoc(collection(db, "alerts"), {
    ...alertData,
    parentId,
    timestamp: Timestamp.now()
  });
};

/**
 * Added fetchSupervisors: جلب المشرفين
 */
export const fetchSupervisors = async (parentId: string): Promise<FamilyMember[]> => {
  if (!db) return [];
  const q = query(collection(db, "parents"), where("familyId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember));
};

/**
 * Added updateMemberInDB: تحديث العضو
 */
export const updateMemberInDB = async (id: string, updates: any) => {
  if (!db) return;
  return await updateDoc(doc(db, "parents", id), updates);
};

/**
 * Added subscribeToAlerts: الرصد اللحظي للتنبيهات
 */
export const subscribeToAlerts = (parentId: string, callback: (alerts: MonitoringAlert[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, "alerts"), where("parentId", "==", parentId));
  return onSnapshot(q, (snapshot) => {
    const alerts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MonitoringAlert));
    callback(alerts);
  });
};

/**
 * Added fetchEvidenceItems: جلب الأدلة
 */
export const fetchEvidenceItems = async (familyId: string): Promise<EvidenceItem[]> => {
  if (!db) return [];
  const q = query(collection(db, "evidence"), where("family_id", "==", familyId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ evidence_id: d.id, ...d.data() } as EvidenceItem));
};

/**
 * Added setLegalHold: تفعيل الحجر القانوني
 */
export const setLegalHold = async (evidenceId: string, userId: string, reason: string) => {
  if (!db) return;
  return await updateDoc(doc(db, "evidence", evidenceId), {
    classification: 'LEGAL_HOLD',
    holdReason: reason,
    heldBy: userId,
    heldAt: Timestamp.now()
  });
};

/**
 * Added deleteEvidenceForensically: الحذف الجنائي
 */
export const deleteEvidenceForensically = async (evidenceId: string, userId: string) => {
  if (!db) return;
  return await updateDoc(doc(db, "evidence", evidenceId), {
    status: 'deleted',
    deletedBy: userId,
    deletedAt: Timestamp.now()
  });
};

/**
 * Added logEvidenceAccess: تسجيل الوصول للأدلة
 */
export const logEvidenceAccess = async (accessData: any) => {
  if (!db) return;
  return await addDoc(collection(db, "custody"), {
    ...accessData,
    created_at: Timestamp.now()
  });
};

/**
 * Added applySystemPatchCloud: حقن التصحيح السحابي
 */
export const applySystemPatchCloud = async (parentId: string, vulnId: string) => {
  if (!db) return;
  return await addDoc(collection(db, "patches"), {
    parentId,
    vulnId,
    appliedAt: Timestamp.now(),
    status: 'COMMITTED'
  });
};

/**
 * Added rollbackSystemPatchCloud: التراجع عن التصحيح
 */
export const rollbackSystemPatchCloud = async (parentId: string, vulnId: string) => {
  if (!db) return;
  const q = query(collection(db, "patches"), where("parentId", "==", parentId), where("vulnId", "==", vulnId));
  const snap = await getDocs(q);
  const deletePromises = snap.docs.map(d => deleteDoc(doc(db, "patches", d.id)));
  await Promise.all(deletePromises);
};

/**
 * Added createSovereignPairCode: إنشاء رمز ربط سيادي
 */
export const createSovereignPairCode = async (parentId: string, childId: string) => {
  if (!db) return null;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await addDoc(collection(db, "pair_codes"), {
    parentId,
    childId,
    code,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 180000))
  });
  return code;
};

/**
 * Added sendSovereignCommand: إرسال أمر سيادي
 */
export const sendSovereignCommand = async (parentId: string, childId: string, type: string, params: any, priority: CommandPriority, reason: string) => {
  if (!db) return;
  return await addDoc(collection(db, "commands"), {
    parentId,
    childId,
    type,
    params,
    priority,
    reason,
    issued_at: Timestamp.now(),
    status: 'queued'
  });
};

/**
 * Added sendRemoteCommand: إرسال أمر عن بعد (Enterprise)
 */
export const sendRemoteCommand = async (childId: string, command: string, payload: any) => {
    if (!db) return;
    
    const cmdRef = await addDoc(collection(db, "commands"), {
        device_id: childId,
        type: command,
        params: payload,
        issued_at: Timestamp.now(),
        status: 'queued',
        retry_count: 0
    });

    try {
      await fetch(`/api/families/current/devices/${childId}/commands/${cmdRef.id}/push`, { method: 'POST' });
    } catch (e) {
      console.warn("Push trigger failed, relying on polling fallback.");
    }

    return cmdRef;
};
