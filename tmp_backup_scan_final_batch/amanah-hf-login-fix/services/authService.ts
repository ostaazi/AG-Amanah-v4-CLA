
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail, // Import added
    User 
} from "firebase/auth";
import { auth } from "./firebaseConfig";

// واجهة المستخدم الأساسية
export interface CloudUser {
    uid: string;
    email: string | null;
    isAnonymous: boolean;
}

/**
 * تسجيل الدخول الفعلي (للوالدين)
 */
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

/**
 * تسجيل حساب جديد (للوالدين)
 */
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

/**
 * إرسال رابط استعادة كلمة المرور
 */
export const resetPassword = async (email: string): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth not initialized");
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
        console.error("Reset Password Error:", error.code);
        throw new Error(mapAuthError(error.code));
    }
};

/**
 * تسجيل خروج
 */
export const logoutUser = async () => {
    if (!auth) return;
    await signOut(auth);
};

/**
 * مراقب الحالة (Auth Listener)
 */
export const subscribeToAuthChanges = (callback: (user: CloudUser | null) => void) => {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, (user) => {
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

// مترجم أخطاء Firebase للعربية
const mapAuthError = (code: string) => {
    switch (code) {
        case 'auth/invalid-email': return 'البريد الإلكتروني غير صالح.';
        case 'auth/user-disabled': return 'تم تعطيل هذا الحساب.';
        case 'auth/user-not-found': return 'لم يتم العثور على مستخدم بهذا البريد.';
        case 'auth/wrong-password': return 'كلمة المرور غير صحيحة.';
        case 'auth/invalid-credential': return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
        case 'auth/email-already-in-use': return 'هذا البريد مسجل مسبقاً.';
        case 'auth/weak-password': return 'كلمة المرور ضعيفة جداً (6 أحرف على الأقل).';
        case 'auth/missing-email': return 'يرجى إدخال البريد الإلكتروني.';
        case 'auth/too-many-requests': return 'محاولات كثيرة جداً. يرجى الانتظار قليلاً.';
        case 'auth/network-request-failed': return 'فشل الاتصال بالشبكة. تحقق من الإنترنت وأعد المحاولة.';
        case 'auth/operation-not-allowed': return 'طريقة تسجيل الدخول هذه غير مفعلة في Firebase.';
        case 'auth/unauthorized-domain': return 'الدومين غير مُصرّح به في إعدادات Firebase (Authorized domains).';
        case 'auth/app-not-authorized': return 'التطبيق غير مُصرّح به. راجع إعدادات Firebase.';
        case 'auth/invalid-api-key': 
        case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
            return 'مفاتيح Firebase غير صحيحة أو غير مكتملة.';
        default: return `حدث خطأ أثناء تسجيل الدخول. ${code ? `(رمز: ${code})` : ''}`.trim();
    }
};

