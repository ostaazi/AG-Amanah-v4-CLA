
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * إعدادات Firebase
 * يتم جلب القيم من متغيرات البيئة (Environment Variables) المعرفة في Vercel
 */
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// تهيئة التطبيق بطريقة آمنة تمنع التكرار (Singleton)
let app;
if (!getApps().length) {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
  } else {
    console.warn("⚠️ Firebase API Key is missing. Check your Vercel Environment Variables.");
  }
} else {
  app = getApp();
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

export const checkConnection = async () => {
    return db ? "Connected" : "Not Configured"; 
};
