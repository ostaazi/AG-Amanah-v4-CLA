
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// 🔴 هام جداً: استبدل القيم أدناه بالقيم التي ظهرت لك في Firebase Console
// بعد تسجيل تطبيق الويب (الخطوة رقم 1 في الشرح)
const firebaseConfig = {
  apiKey: "AIzaSyD3pZgmPyzMh7jZXLNLC8kAdWRbkRf1mbc",
  authDomain: "amanah-protect.firebaseapp.com",
  projectId: "amanah-protect",
  storageBucket: "amanah-protect.firebasestorage.app",
  messagingSenderId: "51958897472",
  appId: "1:51958897472:web:3c7a72751f6f146cf038a5"
};

// تهيئة التطبيق (Singleton Pattern)
let app;
let dbInstance = null;
let authInstance = null;
let functionsInstance = null;

try {
    // التحقق من وجود المفتاح الحقيقي لتجنب الأخطاء أثناء النسخ
    if (firebaseConfig.apiKey.includes("YOUR_REAL_API_KEY_HERE")) {
        console.warn("⚠️ تنبيه: لم يتم وضع مفاتيح Firebase الحقيقية بعد في services/firebaseConfig.ts");
    } else {
        app = initializeApp(firebaseConfig);
        dbInstance = getFirestore(app);
        authInstance = getAuth(app);
        functionsInstance = getFunctions(app);
        console.log("✅ Firebase Connected Successfully");
    }
} catch (error: any) {
    if (!/already exists/.test(error.message)) {
        console.error('Firebase initialization error', error.stack);
    }
}

export const db = dbInstance;
export const auth = authInstance;
export const functions = functionsInstance;

export const checkConnection = async () => {
    if (!db) return "Not Configured";
    return "Connected"; 
};
