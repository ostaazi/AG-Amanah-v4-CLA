
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "./firebaseConfig";

export interface CloudUser {
    uid: string;
    email: string | null;
    isAnonymous: boolean;
}

export const loginParent = async (email: string, pass: string): Promise<CloudUser> => {
    if (!auth) throw new Error("Firebase Auth not initialized");
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        return {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            isAnonymous: userCredential.user.isAnonymous
        };
    } catch (error: any) {
        console.error("Login Error:", error.code);
        throw new Error(mapAuthError(error.code));
    }
};

export const registerParent = async (email: string, pass: string): Promise<CloudUser> => {
    if (!auth) throw new Error("Firebase Auth not initialized");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        return {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            isAnonymous: userCredential.user.isAnonymous
        };
    } catch (error: any) {
        console.error("Registration Error:", error.code);
        throw new Error(mapAuthError(error.code));
    }
};

export const resetPassword = async (email: string): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth not initialized");
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
        console.error("Reset Password Error:", error.code);
        throw new Error(mapAuthError(error.code));
    }
};

export const logoutUser = async () => {
    if (!auth) return;
    await signOut(auth);
};

export const subscribeToAuthChanges = (callback: (user: CloudUser | null) => void) => {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, (user: any) => {
        if (user) {
            callback({
                uid: user.uid,
                email: user.email,
                isAnonymous: user.isAnonymous
            });
        } else {
            callback(null);
        }
    });
};

const mapAuthError = (code: string) => {
    switch (code) {
        case 'auth/invalid-credential': 
            return 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات أو إنشاء حساب جديد.';
        case 'auth/user-not-found': 
            return 'لم يتم العثور على حساب بهذا البريد الإلكتروني.';
        case 'auth/wrong-password': 
            return 'كلمة المرور المدخلة غير صحيحة.';
        case 'auth/invalid-email': 
            return 'صيغة البريد الإلكتروني غير صحيحة.';
        case 'auth/email-already-in-use': 
            return 'هذا البريد الإلكتروني مسجل بالفعل في نظام أمانة.';
        case 'auth/weak-password': 
            return 'كلمة المرور ضعيفة جداً، يجب أن تتكون من 6 رموز على الأقل.';
        case 'auth/too-many-requests': 
            return 'محاولات دخول كثيرة خاطئة. تم حظر الدخول مؤقتاً لحمايتك.';
        default: 
            return 'فشل الاتصال بخادم الحماية. يرجى المحاولة لاحقاً.';
    }
};
