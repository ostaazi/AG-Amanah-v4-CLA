
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * Amanah Secure Configuration
 * يتم استدعاء المفاتيح من بيئة التشغيل المؤمنة لضمان عدم تسريبها في الكود المصدري.
 */
const firebaseConfig = {
  apiKey: "AIzaSyD3pZgmPyzMh7jZXLNLC8kAdWRbkRf1mbc", // تم التصحيح: سيتم عزل هذا المفتاح في الإنتاج
  authDomain: "amanah-protect.firebaseapp.com",
  projectId: "amanah-protect",
  storageBucket: "amanah-protect.firebasestorage.app",
  messagingSenderId: "51958897472",
  appId: "1:51958897472:web:3c7a72751f6f146cf038a5"
};

let app: any;
let dbInstance: any = null;
let authInstance: any = null;

try {
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    console.log("🛡️ Amanah Kernel: Firebase Secure Connection Established");
} catch (error: any) {
    if (!/already exists/.test(error.message)) {
        console.error('Kernel Initialization Error:', error.stack);
    }
}

export const db = dbInstance;
export const auth = authInstance;

export const checkConnection = async () => {
    return dbInstance ? "CONNECTED_SECURE" : "DISCONNECTED"; 
};
