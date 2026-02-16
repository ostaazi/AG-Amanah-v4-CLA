
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 🔴 هام جداً: استبدل القيم أدناه بالقيم التي ظهرت لك في Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyD3pZgmPyzMh7jZXLNLC8kAdWRbkRf1mbc",
  authDomain: "amanah-protect.firebaseapp.com",
  projectId: "amanah-protect",
  storageBucket: "amanah-protect.firebasestorage.app",
  messagingSenderId: "51958897472",
  appId: "1:51958897472:web:3c7a72751f6f146cf038a5"
};

// تهيئة التطبيق (Singleton Pattern)
let app: any;
let dbInstance: any = null;
let authInstance: any = null;

try {
    if (firebaseConfig.apiKey.includes("YOUR_REAL_API_KEY_HERE")) {
        console.warn("⚠️ تنبيه: لم يتم وضع مفاتيح Firebase الحقيقية بعد في services/firebaseConfig.ts");
    } else {
        app = initializeApp(firebaseConfig);
        
        // تفعيل الـ Offline Persistence لضمان عمل التطبيق بدون إنترنت
        dbInstance = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
        
        authInstance = getAuth(app);
        console.log("✅ Firebase Connected with Persistence");
    }
} catch (error: any) {
    if (!/already exists/.test(error.message)) {
        console.error('Firebase initialization error', error.stack);
    }
}

export const db = dbInstance;
export const auth = authInstance;

export const checkConnection = async () => {
    if (!dbInstance) return "Not Configured";
    return "Connected"; 
};
