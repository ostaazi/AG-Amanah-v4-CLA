
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
    Timestamp 
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { Child, ParentAccount, FamilyMember } from "../types";

const CHILDREN_COLLECTION = "children";
const PARENTS_COLLECTION = "parents";
const TOKENS_COLLECTION = "pairing_tokens";

/**
 * توليد كود توأمة مؤقت للأمان العالي
 */
export const generatePairingToken = async (parentId: string): Promise<string> => {
    if (!db) throw new Error("Database not connected");
    const token = Math.floor(100000 + Math.random() * 900000).toString(); // كود من 6 أرقام
    const tokenRef = doc(db, TOKENS_COLLECTION, token);
    
    await setDoc(tokenRef, {
        parentId,
        createdAt: Timestamp.now(),
        expiresAt: new Timestamp(Timestamp.now().seconds + 600, 0) // صالح لـ 10 دقائق
    });
    
    return token;
};

/**
 * التحقق من كود التوأمة وربط الجهاز
 */
export const validatePairingToken = async (token: string): Promise<string | null> => {
    if (!db) return null;
    const tokenRef = doc(db, TOKENS_COLLECTION, token);
    const snap = await getDoc(tokenRef);
    
    if (snap.exists()) {
        const data = snap.data();
        if (data.expiresAt.toDate() > new Date()) {
            return data.parentId;
        }
    }
    return null;
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

export const addChildToDB = async (parentId: string, childData: Partial<Child>): Promise<Child> => {
    if (!db) throw new Error("Database not initialized");
    const payload = { ...childData, parentId, status: 'offline', createdAt: Timestamp.now(), batteryLevel: 100, signalStrength: 4, appUsage: [] };
    const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), payload);
    return { id: docRef.id, ...payload } as any;
};

export const fetchChildrenForParent = async (parentId: string): Promise<Child[]> => {
    if (!db) return [];
    const q = query(collection(db, CHILDREN_COLLECTION), where("parentId", "==", parentId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};

export const updateChildInDB = async (id: string, updates: any) => {
    if (!db) return;
    await updateDoc(doc(db, CHILDREN_COLLECTION, id), updates);
};

export const updateParentProfileInDB = async (id: string, updates: any) => {
    if (!db) return;
    await updateDoc(doc(db, PARENTS_COLLECTION, id), updates);
};

export const updateMemberInDB = async (id: string, role: string, updates: any) => {
    if (!db) return;
    const coll = role === 'CHILD' ? CHILDREN_COLLECTION : PARENTS_COLLECTION;
    await updateDoc(doc(db, coll, id), updates);
};

export const deleteMemberFromDB = async (id: string, role: string) => {
    if (!db) return;
    const coll = role === 'CHILD' ? CHILDREN_COLLECTION : PARENTS_COLLECTION;
    await deleteDoc(doc(db, coll, id));
};

export const inviteSupervisor = async (parentId: string, data: any): Promise<FamilyMember> => {
    if (!db) throw new Error("Database not initialized");
    const payload = { ...data, parentId, role: 'SUPERVISOR' as any, createdAt: Timestamp.now() };
    const docRef = await addDoc(collection(db, "supervisors"), payload);
    return { id: docRef.id, ...payload } as any;
};
