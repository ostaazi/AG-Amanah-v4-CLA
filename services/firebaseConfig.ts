
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * Amanah Secure Configuration
 * Firebase credentials loaded from environment variables (.env file)
 * NEVER commit .env to version control
 */

// Validate environment variables at runtime
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

for (const envVar of requiredEnvVars) {
  if (!import.meta.env[envVar]) {
    throw new Error(
      `Missing required environment variable: ${envVar}\n` +
      `Please ensure .env file exists and contains all required Firebase credentials.\n` +
      `See .env.example for reference.`
    );
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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
