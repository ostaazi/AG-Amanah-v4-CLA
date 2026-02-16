import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * Runtime config resolution order:
 * 1) window.__ENV injected at container start (Hugging Face Spaces / Docker)
 * 2) import.meta.env (Vite local/dev builds with VITE_* variables)
 * 3) safe placeholders (dev-only)
 */
type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnv: RuntimeEnv =
  (typeof window !== "undefined" && (window as any).__ENV) ? (window as any).__ENV : {};

const viteEnv: RuntimeEnv =
  (typeof import.meta !== "undefined" && (import.meta as any).env) ? (import.meta as any).env : {};

const get = (key: string, viteKey?: string, fallback?: string) =>
  runtimeEnv[key] ??
  (viteKey ? viteEnv[viteKey] : undefined) ??
  fallback;

const firebaseConfig = {
  apiKey: get("FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY", "demo-api-key"),
  authDomain: get("FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN", "demo.firebaseapp.com"),
  projectId: get("FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID", "demo-project"),
  storageBucket: get("FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET", "demo.appspot.com"),
  messagingSenderId: get("FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID", "000000000000"),
  appId: get("FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID", "1:000000000000:web:demo"),
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
