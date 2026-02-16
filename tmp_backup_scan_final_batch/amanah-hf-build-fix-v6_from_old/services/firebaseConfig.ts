
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

// محاولة الحصول على متغيرات البيئة من process.env أو window.process.env
const env = (typeof process !== 'undefined' && process.env) ? process.env : (window as any).process?.env || {};

const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY || "AIzaSy_Placeholder",
  authDomain: env.FIREBASE_AUTH_DOMAIN || "amanah-ai.firebaseapp.com",
  projectId: env.FIREBASE_PROJECT_ID || "amanah-ai",
  storageBucket: env.FIREBASE_STORAGE_BUCKET || "amanah-ai.appspot.com",
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: env.FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

let app: FirebaseApp;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
  // Fail-safe initialization
  app = initializeApp(firebaseConfig);
}

// تصدير الخدمات بشكل مباشر ومؤمن
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
