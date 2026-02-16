
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
    limit 
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { Child, ParentAccount, FamilyMember, MonitoringAlert, EvidenceRecord, ActivityLog } from "../types";

const CHILDREN_COLLECTION = "children";
const PARENTS_COLLECTION = "parents";
const SUPERVISORS_COLLECTION = "supervisors";
const ALERTS_COLLECTION = "alerts";
const ACTIVITIES_COLLECTION = "activities";

/**
 * تسجيل نشاط جديد للمستخدم في النظام
 */
export const logUserActivity = async (parentId: string, activity: Partial<ActivityLog>) => {
    if (!db) return;
    try {
        await addDoc(collection(db, ACTIVITIES_COLLECTION), {
            ...activity,
            parentId,
            timestamp: Timestamp.now()
        });
    } catch (e) {
        console.error("Log Activity Error:", e);
    }
};

/**
 * الاشتراك في سجل الأنشطة (Real-time Activity Feed)
 */
export const subscribeToActivities = (parentId: string, callback: (logs: ActivityLog[]) => void) => {
    if (!db) return () => {};
    // ملاحظة: قد يحتاج لفهرس، لذا نستخدم الترتيب المحلي إذا فشل السيرفر
    const q = query(
        collection(db, ACTIVITIES_COLLECTION), 
        where("parentId", "==", parentId)
    );

    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(d => {
            const data = d.data();
            return { 
                id: d.id, 
                ...data,
                timestamp: data.timestamp?.toDate() || new Date()
            } as ActivityLog;
        });
        const sortedLogs = logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        callback(sortedLogs.slice(0, 20));
    });
};

export const syncParentProfile = async (uid: string, email: string | null, defaultData: any): Promise<{ profile: ParentAccount, library: string[] }> => {
    if (!db) throw new Error("Database not initialized");
    const parentRef = doc(db, PARENTS_COLLECTION, uid);
    const parentSnap = await getDoc(parentRef);

    if (parentSnap.exists()) {
        const data = parentSnap.data();
        return {
            profile: { id: uid, ...data } as any,
            library: data.avatarLibrary || []
        };
    } else {
        const newProfile = {
            name: email?.split('@')[0] || defaultData.name,
            email: email,
            avatar: defaultData.avatar,
            role: 'ADMIN',
            createdAt: Timestamp.now(),
            avatarLibrary: [],
            pushEnabled: true
        };
        await setDoc(parentRef, newProfile);
        return { profile: { id: uid, ...newProfile } as any, library: [] };
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

export const updateAlertStatus = async (alertId: string, status: 'SECURED' | 'ARCHIVED') => {
    if (!db) return;
    const alertRef = doc(db, ALERTS_COLLECTION, alertId);
    await updateDoc(alertRef, { status });
};

export const deleteAlertFromDB = async (alertId: string) => {
    if (!db) return;
    const alertRef = doc(db, ALERTS_COLLECTION, alertId);
    await deleteDoc(alertRef);
};

export const subscribeToAlerts = (parentId: string, callback: (alerts: MonitoringAlert[]) => void) => {
    if (!db) return () => {};
    const q = query(
        collection(db, ALERTS_COLLECTION), 
        where("parentId", "==", parentId)
    );

    return onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs.map(d => {
            const data = d.data();
            return { 
                id: d.id, 
                ...data,
                timestamp: data.timestamp?.toDate() || new Date()
            } as MonitoringAlert;
        });

        const sortedAlerts = alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        callback(sortedAlerts.slice(0, 50));
    });
};

export const subscribeToChildren = (parentId: string, callback: (children: Child[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, CHILDREN_COLLECTION), where("parentId", "==", parentId));
    return onSnapshot(q, (snapshot) => {
        const children = snapshot.docs.map(d => ({ 
            id: d.id, 
            ...d.data() 
        } as Child));
        callback(children);
    });
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
    return { id: docRef.id, ...payload } as any;
};

export const fetchSupervisors = async (parentId: string): Promise<FamilyMember[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, SUPERVISORS_COLLECTION), where("parentId", "==", parentId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    } catch (e) {
        console.error("Fetch Supervisors Error:", e);
        return [];
    }
};

export const updateMemberInDB = async (id: string, role: string, updates: any) => {
    if (!db) return;
    const coll = role === 'CHILD' ? CHILDREN_COLLECTION : (role === 'ADMIN' ? PARENTS_COLLECTION : SUPERVISORS_COLLECTION);
    await updateDoc(doc(db, coll, id), updates);
};

export const updateParentProfileInDB = async (id: string, updates: any) => {
    return updateMemberInDB(id, 'ADMIN', updates);
};

export const updateChildInDB = async (id: string, updates: any) => {
    return updateMemberInDB(id, 'CHILD', updates);
};

export const deleteMemberFromDB = async (id: string, role: string) => {
    if (!db) throw new Error("Database connection lost");
    const coll = role === 'CHILD' ? CHILDREN_COLLECTION : SUPERVISORS_COLLECTION;
    const docRef = doc(db, coll, id);
    await deleteDoc(docRef);
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
        appUsage: [
            { id: '1', appName: 'Instagram', icon: '📸', minutesUsed: 45, isBlocked: false },
            { id: '2', appName: 'TikTok', icon: '🎵', minutesUsed: 120, isBlocked: false },
            { id: '3', appName: 'WhatsApp', icon: '💬', minutesUsed: 30, isBlocked: false }
        ],
        psychProfile: {
            anxietyLevel: 25,
            moodScore: 85,
            dominantEmotion: 'هادئ',
            isolationRisk: 10,
            recentKeywords: []
        }
    };
    const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), payload);
    return { id: docRef.id, ...payload } as any;
};

export const fetchChildrenForParent = async (parentId: string): Promise<Child[]> => {
    if (!db) return [];
    const q = query(collection(db, CHILDREN_COLLECTION), where("parentId", "==", parentId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};
