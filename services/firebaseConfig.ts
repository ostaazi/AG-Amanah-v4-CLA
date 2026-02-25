import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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

const useFirestoreEmulator =
  String(import.meta.env.VITE_USE_FIRESTORE_EMULATOR || '').toLowerCase() === 'true';
const allowLiveMockMutations =
  String(import.meta.env.VITE_ALLOW_LIVE_MOCK_MUTATIONS || '').toLowerCase() === 'true';
const autoPurgeMockDataOnAppLoad =
  String(import.meta.env.VITE_AUTO_PURGE_MOCK_DATA || '').toLowerCase() === 'true';
const MOCK_RUNTIME_OVERRIDE_KEY = 'AMANAH_MOCK_DATA_RUNTIME_OVERRIDE';
const MOCK_CONFIG_CHANGED_EVENT = 'amanah:mock-config-changed';

const readMockRuntimeOverride = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  const raw = String(window.localStorage.getItem(MOCK_RUNTIME_OVERRIDE_KEY) || '').toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
};

let mockRuntimeOverride = readMockRuntimeOverride();

const resolveMockDataEnabled = (): boolean =>
  mockRuntimeOverride !== null
    ? mockRuntimeOverride
    : useFirestoreEmulator || allowLiveMockMutations;

const emitMockConfigChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MOCK_CONFIG_CHANGED_EVENT, {
      detail: {
        enabled: resolveMockDataEnabled(),
        override: mockRuntimeOverride,
        emulator: useFirestoreEmulator,
        envDefault: allowLiveMockMutations,
      },
    })
  );
};

let app: any;
let dbInstance: any = null;
let authInstance: any = null;
let emulatorConnected = false;

try {
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
  if (useFirestoreEmulator && dbInstance && !emulatorConnected) {
    const host = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
    connectFirestoreEmulator(dbInstance, host, port);
    emulatorConnected = true;
    console.log(`🧪 Amanah Kernel: Firestore Emulator Connected (${host}:${port})`);
  }
  console.log('🛡️ Amanah Kernel: Firebase Secure Connection Established');
} catch (error: any) {
  if (!/already exists/.test(error.message)) {
    console.error('Kernel Initialization Error:', error.stack);
  }
}

export const db = dbInstance;
export const auth = authInstance;
export const isFirestoreEmulatorEnabled = () => useFirestoreEmulator;
export const isLiveMockMutationsEnvEnabled = () => allowLiveMockMutations;
export const getMockDataRuntimeOverride = () => mockRuntimeOverride;
export const getMockDataConfigChangedEventName = () => MOCK_CONFIG_CHANGED_EVENT;
export const canUseMockData = () => resolveMockDataEnabled();
export const setMockDataRuntimeOverride = (value: boolean | null) => {
  mockRuntimeOverride = value;
  if (typeof window !== 'undefined') {
    if (value === null) {
      window.localStorage.removeItem(MOCK_RUNTIME_OVERRIDE_KEY);
    } else {
      window.localStorage.setItem(MOCK_RUNTIME_OVERRIDE_KEY, String(value));
    }
  }
  emitMockConfigChanged();
};
export const shouldAutoPurgeMockData = () => autoPurgeMockDataOnAppLoad;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== MOCK_RUNTIME_OVERRIDE_KEY) return;
    mockRuntimeOverride = readMockRuntimeOverride();
    emitMockConfigChanged();
  });
}

export const checkConnection = async () => {
  return dbInstance ? 'CONNECTED_SECURE' : 'DISCONNECTED';
};
