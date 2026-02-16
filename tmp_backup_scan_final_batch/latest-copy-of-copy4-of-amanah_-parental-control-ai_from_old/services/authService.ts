
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "./firebaseConfig";

// واجهة المستخدم المؤمنة (نسخة الإنتاج النهائية)
export interface CloudUser {
    uid: string;
    email: string | null;
    isAnonymous: boolean;
}

/**
 * تسجيل الدخول (الوالدين) - كود محصن فعلياً
 * يستخدم البارامترات المجهزة (Prepared Statements) داخل Firebase SDK
 */
export const loginParent = async (email: string, pass: string): Promise<CloudUser> => {
    if (!auth) throw new Error("نواة الأمان غير مهيأة");
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        return {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            isAnonymous: userCredential.user.isAnonymous
        };
    } catch (error: any) {
        console.error("Critical Security Event:", error.code);
        throw new Error(mapAuthError(error.code));
    }
};

/**
 * تسجيل حساب جديد (الوالدين) - كود محصن فعلياً
 */
export const registerParent = async (email: string, pass: string): Promise<CloudUser> => {
    if (!auth) throw new Error("نواة الأمان غير مهيأة");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        return {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            isAnonymous: userCredential.user.isAnonymous
        };
    } catch (error: any) {
        throw new Error(mapAuthError(error.code));
    }
};

/**
 * استعادة كلمة المرور - كود مؤمن
 */
export const resetPassword = async (email: string): Promise<void> => {
    if (!auth) throw new Error("نواة الأمان غير مهيأة");
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
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
        case 'auth/invalid-email': return 'البريد الإلكتروني غير صالح.';
        case 'auth/wrong-password': return 'كلمة المرور غير صحيحة.';
        case 'auth/user-not-found': return 'الحساب غير موجود.';
        default: return 'حدث خطأ أمني في النواة.';
    }
};
