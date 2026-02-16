
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
import { Child, ParentAccount } from "../types";

const CHILDREN_COLLECTION = "children";
const PARENTS_COLLECTION = "parents";

// --- وظائف الأطفال (موجودة سابقاً) ---

const mapDocToChild = (doc: any): Child => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        location: data.location ? { ...data.location, lastUpdated: data.location.lastUpdated?.toDate() || new Date() } : undefined,
        appUsage: data.appUsage?.map((app: any) => ({ ...app, lastUsed: app.lastUsed?.toDate() || new Date() })) || [],
        callLogs: data.callLogs?.map((call: any) => ({ ...call, timestamp: call.timestamp?.toDate() || new Date() })) || [],
        psychProfile: data.psychProfile ? { ...data.psychProfile, lastAnalysisDate: data.psychProfile.lastAnalysisDate?.toDate() || new Date() } : undefined
    };
};

export const fetchChildrenForParent = async (parentId: string): Promise<Child[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, CHILDREN_COLLECTION), where("parentId", "==", parentId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(mapDocToChild);
    } catch (error) {
        console.error("Error fetching children:", error);
        throw error;
    }
};

export const addChildToDB = async (parentId: string, childData: Partial<Child>): Promise<Child> => {
    if (!db) throw new Error("Database not initialized");
    
    const newChildPayload = {
        parentId,
        name: childData.name,
        age: childData.age,
        avatar: childData.avatar,
        status: 'offline',
        deviceModel: 'Not Connected',
        batteryLevel: 100,
        signalStrength: 0,
        screenTimeLimit: 120,
        currentScreenTime: 0,
        deviceLocked: false,
        cameraBlocked: false,
        micBlocked: false,
        preventAppInstall: false,
        appUsage: [],
        callLogs: [],
        createdAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), newChildPayload);
    
    return {
        id: docRef.id,
        ...newChildPayload,
        appUsage: [],
        callLogs: []
    } as unknown as Child;
};

export const updateChildInDB = async (childId: string, updates: Partial<Child>) => {
    if (!db) return;
    const childRef = doc(db, CHILDREN_COLLECTION, childId);
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    try {
        await updateDoc(childRef, cleanUpdates);
    } catch (error) {
        console.error("Error updating child:", error);
        throw error;
    }
};

export const deleteChildFromDB = async (childId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, CHILDREN_COLLECTION, childId));
};

// --- 🆕 وظائف الأب (Parent Profile) ---

/**
 * جلب ملف الأب، أو إنشاؤه إذا كان تسجيل دخول لأول مرة
 */
export const syncParentProfile = async (uid: string, email: string | null, defaultData: ParentAccount): Promise<{ profile: ParentAccount, library: string[] }> => {
    if (!db) throw new Error("Database not initialized");

    const parentRef = doc(db, PARENTS_COLLECTION, uid);
    const parentSnap = await getDoc(parentRef);

    if (parentSnap.exists()) {
        const data = parentSnap.data();
        return {
            profile: {
                id: uid,
                name: data.name || defaultData.name,
                role: 'ADMIN',
                avatar: data.avatar || defaultData.avatar
            },
            library: data.avatarLibrary || []
        };
    } else {
        // إنشاء ملف جديد
        const newProfile = {
            name: email?.split('@')[0] || defaultData.name,
            email: email,
            avatar: defaultData.avatar,
            createdAt: Timestamp.now(),
            avatarLibrary: [] // مكتبة فارغة مبدئياً
        };
        await setDoc(parentRef, newProfile);
        return {
            profile: { id: uid, role: 'ADMIN', name: newProfile.name, avatar: newProfile.avatar },
            library: []
        };
    }
};

/**
 * تحديث بيانات الأب (الاسم، الصورة، المكتبة)
 */
export const updateParentProfileInDB = async (uid: string, updates: { name?: string, avatar?: string, avatarLibrary?: string[] }) => {
    if (!db) return;
    const parentRef = doc(db, PARENTS_COLLECTION, uid);
    try {
        await updateDoc(parentRef, updates);
    } catch (error) {
        console.error("Error updating parent profile:", error);
        throw error;
    }
};
