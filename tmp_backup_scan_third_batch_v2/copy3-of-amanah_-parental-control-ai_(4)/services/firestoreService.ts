
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    getDocs, 
    getDoc, 
    setDoc, 
    onSnapshot, 
    Timestamp, 
    orderBy, 
    limit,
    getDocFromCache,
    getDocFromServer
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { Child, ParentAccount, FamilyMember, MonitoringAlert, EvidenceRecord, ActivityLog, UserRole } from "../types";

const CHILDREN_COLLECTION = "children";
const PARENTS_COLLECTION = "parents";
const ALERTS_COLLECTION = "alerts";
const ACTIVITIES_COLLECTION = "activities";
const SUPERVISORS_COLLECTION = "supervisors";

/**
 * وظيفة تطهير البيانات العميقة لمنع أخطاء Circular Reference
 */
const sanitizeData = (data: any, seen = new WeakSet()): any => {
    if (data === null || data === undefined) return data;
    
    if (data instanceof Timestamp) {
        return data.toDate();
    }
    if (typeof data.toDate === 'function') {
        return data.toDate();
    }

    if (typeof data === 'object') {
        if (seen.has(data)) return "[Circular]";
        seen.add(data);

        if (Array.isArray(data)) {
            return data.map(item => sanitizeData(item, seen));
        }

        const sanitized: any = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                sanitized[key] = sanitizeData(data[key], seen);
            }
        }
        return sanitized;
    }

    return data;
};

export const sendRemoteCommand = async (childId: string, command: string, value: any = true) => {
    if (!db) return;
    try {
        const childRef = doc(db, CHILDREN_COLLECTION, childId);
        await updateDoc(childRef, {
            [`commands.${command}`]: {
                value,
                timestamp: Timestamp.now(),
                status: 'PENDING'
            }
        });
    } catch (e) {
        console.error("Failed to send command (offline)", e);
    }
};

export const updatePairingKeyInDB = async (parentId: string, key: string) => {
    if (!db) return;
    try {
        const parentRef = doc(db, PARENTS_COLLECTION, parentId);
        await setDoc(parentRef, { pairingKey: key.replace('-', '') }, { merge: true });
    } catch (e) {
        console.error("Failed to update pairing key", e);
    }
};

export const saveAlertToDB = async (parentId: string, alert: Partial<MonitoringAlert | EvidenceRecord>) => {
    if (!db) return;
    try {
        const payload = {
            ...alert,
            parentId,
            status: 'NEW',
            timestamp: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, ALERTS_COLLECTION), payload);
        return docRef.id;
    } catch (e) {
        console.error("Save Alert Error:", e);
    }
};

export const subscribeToAlerts = (parentId: string, callback: (alerts: MonitoringAlert[]) => void) => {
    if (!db) return () => {};
    const q = query(
        collection(db, ALERTS_COLLECTION), 
        where("parentId", "==", parentId),
        limit(100) 
    );

    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        const alerts = snapshot.docs.map(d => ({ 
            id: d.id, 
            ...sanitizeData(d.data())
        } as MonitoringAlert))
        .sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
            return timeB - timeA;
        });

        callback(alerts);
    });
};

export const subscribeToChildren = (parentId: string, callback: (children: Child[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, CHILDREN_COLLECTION), where("parentId", "==", parentId));
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        const children = snapshot.docs.map(d => ({ 
            id: d.id, 
            ...sanitizeData(d.data())
        } as Child));
        callback(children);
    });
};

export const addChildToDB = async (parentId: string, childData: Partial<Child>): Promise<Child> => {
    if (!db) throw new Error("Database not initialized");
    const payload = { 
        ...childData, 
        parentId, 
        status: 'online', 
        createdAt: Timestamp.now(), 
        batteryLevel: 100, 
        signalStrength: 4, 
        commands: {
            takeScreenshot: { value: false, timestamp: Timestamp.now() },
            lockDevice: { value: false, timestamp: Timestamp.now() },
            playSiren: { value: false, timestamp: Timestamp.now() }
        }
    };
    const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), payload);
    return { id: docRef.id, ...payload } as any;
};

export const syncParentProfile = async (uid: string, email: string | null, defaultData: any): Promise<{ profile: ParentAccount, library: string[] }> => {
    if (!db) throw new Error("Database not initialized");
    const parentRef = doc(db, PARENTS_COLLECTION, uid);
    
    try {
        // محاولة جلب البيانات من السيرفر أولاً، وإذا فشل نستخدم الكاش
        let parentSnap;
        try {
            parentSnap = await getDoc(parentRef);
        } catch (serverError) {
            parentSnap = await getDocFromCache(parentRef);
        }

        if (parentSnap.exists()) {
            const data = sanitizeData(parentSnap.data());
            return { 
                profile: { id: uid, ...data } as ParentAccount, 
                library: data.library || [] 
            };
        } else {
            const newProfile = { ...defaultData, id: uid, email };
            await setDoc(parentRef, newProfile);
            return { profile: newProfile, library: [] };
        }
    } catch (e) {
        console.warn("Firestore sync failed (client offline). Returning defaults.");
        return { profile: { ...defaultData, id: uid, email }, library: [] };
    }
};

export const subscribeToActivities = (parentId: string, callback: (data: ActivityLog[]) => void) => {
    if (!db) return () => {};
    const q = query(
        collection(db, ACTIVITIES_COLLECTION), 
        where("parentId", "==", parentId),
        limit(50)
    );
    return onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(d => ({ 
            id: d.id, 
            ...sanitizeData(d.data())
        } as ActivityLog))
        .sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
            return timeB - timeA;
        });
        callback(activities);
    });
};

export const fetchSupervisors = async (parentId: string): Promise<FamilyMember[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, SUPERVISORS_COLLECTION), where("parentId", "==", parentId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...sanitizeData(d.data()) } as FamilyMember));
    } catch (e) {
        console.error("Fetch supervisors failed", e);
        return [];
    }
};

export const updateMemberInDB = async (id: string, role: UserRole, updates: any): Promise<void> => {
    if (!db) return;
    const collectionName = role === 'CHILD' ? CHILDREN_COLLECTION : (role === 'SUPERVISOR' ? SUPERVISORS_COLLECTION : PARENTS_COLLECTION);
    const ref = doc(db, collectionName, id);
    await updateDoc(ref, updates);
};

export const deleteMemberFromDB = async (id: string, role: UserRole): Promise<void> => {
    if (!db) return;
    const collectionName = role === 'CHILD' ? CHILDREN_COLLECTION : (role === 'SUPERVISOR' ? SUPERVISORS_COLLECTION : PARENTS_COLLECTION);
    await deleteDoc(doc(db, collectionName, id));
};

export const logUserActivity = async (parentId: string, activity: Partial<ActivityLog>): Promise<void> => {
    if (!db) return;
    try {
        await addDoc(collection(db, ACTIVITIES_COLLECTION), {
            ...activity,
            parentId,
            timestamp: Timestamp.now()
        });
    } catch (e) {}
};

export const inviteSupervisor = async (parentId: string, data: any): Promise<FamilyMember> => {
    if (!db) throw new Error("Database not initialized");
    const payload = { 
        ...data, 
        parentId, 
        role: 'SUPERVISOR',
        createdAt: Timestamp.now() 
    };
    const docRef = await addDoc(collection(db, SUPERVISORS_COLLECTION), payload);
    return { id: docRef.id, ...payload } as FamilyMember;
};

export const deleteAlertFromDB = async (alertId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, ALERTS_COLLECTION, alertId));
};

export const updateAlertStatus = async (alertId: string, status: string): Promise<void> => {
    if (!db) return;
    const alertRef = doc(db, ALERTS_COLLECTION, alertId);
    await updateDoc(alertRef, { status });
};
