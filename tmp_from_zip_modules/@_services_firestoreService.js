import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, getDoc, setDoc, onSnapshot, Timestamp, orderBy, limit, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/services/firebaseConfig";
// Fix: Added ContentType to imports from types.ts
import { Classification, ContentType } from "@/types";
const CHILDREN_COLLECTION = "children";
const PARENTS_COLLECTION = "parents";
const ALERTS_COLLECTION = "alerts";
const ACTIVITIES_COLLECTION = "activities";
const SUPERVISORS_COLLECTION = "supervisors";
const SYSTEM_CONFIG_COLLECTION = "system_configs";
const PAIR_CODES_COLLECTION = "pair_codes";
const INCIDENTS_COLLECTION = "incidents";
const COMMANDS_COLLECTION = "commands";
const CUSTODY_COLLECTION = "custody_logs";
/**
 * وظيفة تطهير البيانات العميقة لمنع أخطاء Circular Reference وتحويل التواريخ
 */
const sanitizeData = (data, seen = new WeakSet()) => {
    if (data === null || data === undefined)
        return data;
    if (data instanceof Timestamp)
        return data.toDate().toISOString();
    if (typeof data.toDate === 'function')
        return data.toDate().toISOString();
    if (typeof data === 'object') {
        if (seen.has(data))
            return "[Circular]";
        seen.add(data);
        if (Array.isArray(data))
            return data.map(item => sanitizeData(item, seen));
        const sanitized = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                sanitized[key] = sanitizeData(data[key], seen);
            }
        }
        return sanitized;
    }
    return data;
};
// --- إدارة الأدلة الجنائية المتقدمة (Advanced Forensics Management) ---
export const getCustodyLogs = async (evidenceId) => {
    if (!db)
        return [];
    try {
        const q = query(collection(db, CUSTODY_COLLECTION), where("evidence_id", "==", evidenceId), orderBy("created_at", "asc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ custody_id: d.id, ...sanitizeData(d.data()) }));
    }
    catch (e) {
        console.error("Failed to fetch custody logs", e);
        return [];
    }
};
export const updateEvidenceClassification = async (evidenceId, newClass, actorId, reason) => {
    if (!db)
        return;
    const ref = doc(db, ALERTS_COLLECTION, evidenceId);
    await updateDoc(ref, { classification: newClass });
    // تسجيل الحدث في سلسلة العهدة لضمان النزاهة
    await addDoc(collection(db, CUSTODY_COLLECTION), {
        evidence_id: evidenceId,
        actor_id: actorId,
        actorName: "مسؤول السيادة",
        action: 'hold',
        reason: reason,
        created_at: Timestamp.now()
    });
};
export const deleteEvidenceSecurely = async (evidenceId, actorId, reason) => {
    if (!db)
        return;
    // تسجيل محاولة الحذف قبل تنفيذها الفعلي (Audit Before Destroy)
    await addDoc(collection(db, CUSTODY_COLLECTION), {
        evidence_id: evidenceId,
        actor_id: actorId,
        actorName: "مسؤول السيادة",
        action: 'delete_attempt',
        reason: reason,
        created_at: Timestamp.now()
    });
    const ref = doc(db, ALERTS_COLLECTION, evidenceId);
    await deleteDoc(ref);
};
// --- تنفيذ الأوامر السيادية (Sovereign Command Protocol) ---
export const sendSovereignCommand = async (parentId, childId, type, params = {}, priority = 'med', reason) => {
    if (!db || !parentId)
        return;
    const commandPayload = {
        family_id: parentId,
        device_id: childId,
        issued_by: parentId,
        issued_at: Timestamp.now(),
        expires_at: Timestamp.fromDate(new Date(Date.now() + 600000)), // صلاحية 10 دقائق
        type,
        params,
        priority,
        reason: reason || null,
        nonce: Math.random().toString(36).substr(2, 16),
        idempotency_key: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        status: 'PENDING'
    };
    const docRef = await addDoc(collection(db, COMMANDS_COLLECTION), commandPayload);
    // تحديث مؤشر الأمر النشط في وثيقة الطفل للـ Polling السريع من الـ SDK
    await updateDoc(doc(db, CHILDREN_COLLECTION, childId), {
        activeCommand: { id: docRef.id, ...commandPayload }
    });
    return docRef.id;
};
// --- إدارة الحوادث السيادية (Family Incident Response) ---
export const fetchIncidents = async (parentId) => {
    if (!db || !parentId)
        return [];
    try {
        const q = query(collection(db, INCIDENTS_COLLECTION), where("parentId", "==", parentId), orderBy("startTime", "desc"), limit(10));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({
            id: d.id,
            ...sanitizeData(d.data()),
            startTime: d.data().startTime?.toDate() || new Date()
        }));
    }
    catch (e) {
        return [];
    }
};
export const createSovereignPairCode = async (parentId, childId) => {
    if (!db || !parentId)
        return null;
    const code = Math.random().toString(36).substr(2, 8).toUpperCase().replace(/(.{4})/, '$1-');
    await addDoc(collection(db, PAIR_CODES_COLLECTION), {
        familyId: parentId,
        childId: childId,
        pairCode: code,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 180000)), // صلاحية 3 دقائق حسب الوثيقة
        issuedBy: parentId,
        createdAt: Timestamp.now()
    });
    return code;
};
export const subscribeToChildren = (parentId, callback) => {
    if (!db || !parentId)
        return () => { };
    const q = query(collection(db, CHILDREN_COLLECTION), where("parentId", "==", parentId));
    return onSnapshot(q, (snapshot) => {
        const children = snapshot.docs.map(d => ({ id: d.id, ...sanitizeData(d.data()) }));
        callback(children);
    });
};
export const subscribeToAlerts = (parentId, callback) => {
    if (!db || !parentId)
        return () => { };
    const q = query(collection(db, ALERTS_COLLECTION), where("parentId", "==", parentId), orderBy("timestamp", "desc"), limit(100));
    return onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs.map(d => ({
            evidence_id: d.id,
            ...sanitizeData(d.data()),
            created_at: d.data().timestamp?.toDate().toISOString() || new Date().toISOString(),
            content_type: d.data().imageData ? ContentType.IMAGE : ContentType.TEXT,
            classification: d.data().classification || Classification.NORMAL,
            sha256: d.data().sha256 || 'SHA-PENDING-' + d.id.substr(0, 8),
            tags: d.data().tags || []
        }));
        callback(alerts);
    });
};
export const syncParentProfile = async (uid, email, defaultData) => {
    if (!db)
        throw new Error("Database not initialized");
    const parentRef = doc(db, PARENTS_COLLECTION, uid);
    const parentSnap = await getDoc(parentRef);
    if (parentSnap.exists()) {
        return { profile: { id: uid, ...sanitizeData(parentSnap.data()) } };
    }
    else {
        const newProfile = { ...defaultData, id: uid, email };
        await setDoc(parentRef, newProfile);
        return { profile: newProfile };
    }
};
export const subscribeToActivities = (parentId, callback) => {
    if (!db || !parentId)
        return () => { };
    const q = query(collection(db, ACTIVITIES_COLLECTION), where("parentId", "==", parentId), orderBy("timestamp", "desc"), limit(50));
    return onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(d => ({ id: d.id, ...sanitizeData(d.data()) }));
        callback(activities);
    });
};
export const updateMemberInDB = async (id, role, updates) => {
    if (!db)
        return;
    const collectionName = role === 'CHILD' ? CHILDREN_COLLECTION : (role === 'SUPERVISOR' ? SUPERVISORS_COLLECTION : PARENTS_COLLECTION);
    await updateDoc(doc(db, collectionName, id), updates);
};
export const logUserActivity = async (parentId, activity) => {
    if (!db || !parentId)
        return;
    await addDoc(collection(db, ACTIVITIES_COLLECTION), { ...activity, parentId, timestamp: Timestamp.now() });
};
export const saveAlertToDB = async (parentId, alertData) => {
    if (!db || !parentId)
        return;
    return await addDoc(collection(db, ALERTS_COLLECTION), {
        ...alertData,
        parentId,
        timestamp: Timestamp.now()
    });
};
export const fetchSupervisors = async (parentId) => {
    if (!db || !parentId)
        return [];
    const q = query(collection(db, SUPERVISORS_COLLECTION), where("parentId", "==", parentId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...sanitizeData(d.data()) }));
};
export const sendRemoteCommand = async (childId, command, payload) => {
    if (!db)
        return;
    const commandPayload = {
        device_id: childId,
        type: command,
        params: payload,
        issued_at: Timestamp.now(),
        status: 'PENDING'
    };
    return await addDoc(collection(db, COMMANDS_COLLECTION), commandPayload);
};
export const applySystemPatchCloud = async (parentId, vulnId) => {
    if (!db)
        return;
    const patchRef = doc(db, SYSTEM_CONFIG_COLLECTION, "patches");
    await setDoc(patchRef, { active_patches: arrayUnion(vulnId) }, { merge: true });
};
export const rollbackSystemPatchCloud = async (parentId, vulnId) => {
    if (!db)
        return;
    const patchRef = doc(db, SYSTEM_CONFIG_COLLECTION, "patches");
    await setDoc(patchRef, { active_patches: arrayRemove(vulnId) }, { merge: true });
};
