import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

/**
 * Runtime + build-time env support:
 * - Hugging Face Docker Spaces inject ENV at runtime (container start), not at build.
 * - Vite exposes variables prefixed with VITE_ at build-time via import.meta.env.
 * We support both:
 *   1) window.__ENV__ (runtime-config.js generated at container start)
 *   2) import.meta.env (VITE_* during local/dev builds)
 */
type EnvDict = Record<string, string | undefined>;

const runtimeEnv: EnvDict =
  typeof window !== "undefined" && (window as any).__ENV__
    ? ((window as any).__ENV__ as EnvDict)
    : {};

const viteEnv: EnvDict = ((import.meta as any).env || {}) as EnvDict;

function pick(name: string, fallback?: string) {
  // Prefer runtime (Docker/Spaces), then Vite build-time (VITE_*), then fallback.
  return runtimeEnv[name] ?? viteEnv[`VITE_${name}`] ?? viteEnv[name] ?? fallback;
}

const firebaseConfig = {
  apiKey: pick("FIREBASE_API_KEY", ""),
  authDomain: pick("FIREBASE_AUTH_DOMAIN", ""),
  projectId: pick("FIREBASE_PROJECT_ID", ""),
  storageBucket: pick("FIREBASE_STORAGE_BUCKET", ""),
  messagingSenderId: pick("FIREBASE_MESSAGING_SENDER_ID", ""),
  appId: pick("FIREBASE_APP_ID", ""),
};

// Guard: show a clear console warning if config is missing.
// (Firebase web config isn't a secret, but missing values will break auth.)
const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, v]) => !v)
  .map(([k]) => k);

if (missingKeys.length) {
  console.warn(
    "[Amanah] Missing Firebase config keys:",
    missingKeys.join(", "),
    "\nSet them in Hugging Face Space Variables/Secrets OR provide VITE_* variables for Vite."
  );
}

let app: FirebaseApp;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase Init Error:", e);
  // Last resort: try initialize again (will still fail if config invalid)
  app = initializeApp(firebaseConfig);
}

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
