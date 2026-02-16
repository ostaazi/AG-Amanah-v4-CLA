import { collection, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebaseConfig';

interface BackupEnvelope {
  version: 1;
  parentId: string;
  createdAt: string;
  payload: Record<string, Array<{ id: string; [key: string]: any }>>;
}

interface EncryptedBackupEnvelope {
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  iv: string;
  salt: string;
  data: string;
}

const COLLECTIONS_TO_BACKUP = [
  'children',
  'alerts',
  'activities',
  'supervisors',
  'playbooks',
  'auditLogs',
  'custody',
];

const toBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

const deriveKey = async (passphrase: string, salt: Uint8Array, iterations: number) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const collectBackupData = async (parentId: string): Promise<BackupEnvelope> => {
  const payload: BackupEnvelope['payload'] = {};
  for (const colName of COLLECTIONS_TO_BACKUP) {
    const snap = await getDocs(query(collection(db!, colName), where('parentId', '==', parentId)));
    payload[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return {
    version: 1,
    parentId,
    createdAt: new Date().toISOString(),
    payload,
  };
};

const downloadBackupBlob = (content: string, filename: string, mime = 'application/json') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const generateEncryptedBackup = async (
  parentId: string,
  passphrase: string
): Promise<boolean> => {
  if (!db || !parentId || !passphrase) return false;

  try {
    const plain = await collectBackupData(parentId);
    const text = new TextEncoder().encode(JSON.stringify(plain));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 120000;
    const key = await deriveKey(passphrase, salt, iterations);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, text);

    const envelope: EncryptedBackupEnvelope = {
      version: 1,
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations,
      iv: toBase64(iv),
      salt: toBase64(salt),
      data: toBase64(new Uint8Array(encrypted)),
    };

    downloadBackupBlob(
      JSON.stringify(envelope),
      `amanah_backup_${parentId}_${Date.now()}.vault`,
      'application/octet-stream'
    );
    return true;
  } catch (error) {
    console.error('generateEncryptedBackup failed:', error);
    return false;
  }
};

export const restoreFromEncryptedBackup = async (
  encryptedData: string,
  parentId: string,
  passphrase: string
): Promise<boolean> => {
  if (!db || !encryptedData || !parentId || !passphrase) return false;

  try {
    const envelope = JSON.parse(encryptedData) as EncryptedBackupEnvelope;
    const key = await deriveKey(passphrase, fromBase64(envelope.salt), envelope.iterations || 120000);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.data)
    );
    const backup = JSON.parse(new TextDecoder().decode(decrypted)) as BackupEnvelope;

    if (backup.parentId !== parentId) {
      throw new Error('Parent ID mismatch');
    }

    const batch = writeBatch(db);
    for (const [colName, docs] of Object.entries(backup.payload || {})) {
      for (const entry of docs || []) {
        const { id, ...data } = entry;
        batch.set(doc(db, colName, id), data, { merge: true });
      }
    }
    await batch.commit();
    return true;
  } catch (error) {
    console.error('restoreFromEncryptedBackup failed:', error);
    return false;
  }
};

export const exportPlainBackupJson = async (parentId: string): Promise<boolean> => {
  if (!db || !parentId) return false;
  try {
    const backup = await collectBackupData(parentId);
    downloadBackupBlob(
      JSON.stringify(backup, null, 2),
      `amanah_backup_plain_${parentId}_${Date.now()}.json`
    );
    return true;
  } catch (error) {
    console.error('exportPlainBackupJson failed:', error);
    return false;
  }
};
