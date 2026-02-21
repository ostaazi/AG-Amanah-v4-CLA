export interface OfflineUnlockParentKit {
  childId: string;
  version: string;
  totpSecret: string;
  backupCodes: string[];
  digits: number;
  periodSec: number;
  createdAt: string;
}

export interface OfflineUnlockProvisioningResult {
  parentKit: OfflineUnlockParentKit;
  commandPayload: {
    version: string;
    totpSecret: string;
    backupCodeHashes: string[];
    digits: number;
    periodSec: number;
    maxAttempts: number;
    cooldownSec: number;
    source: string;
  };
}

const STORAGE_KEY = 'amanah_offline_unlock_kits_v1';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const normalizeSecret = (raw: string): string =>
  raw
    .trim()
    .replace(/[\s-]+/g, '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');

const ensureCrypto = (): Crypto => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is not available in this environment.');
  }
  return globalThis.crypto;
};

const createBase32Secret = (length = 32): string => {
  const crypto = ensureCrypto();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return secret;
};

const createBackupCodes = (count = 8): string[] => {
  const crypto = ensureCrypto();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes)
      .map((b) => (b % 10).toString())
      .join('')
      .slice(0, 10);
    codes.push(code);
  }
  return codes;
};

const base32ToBytes = (secret: string): Uint8Array => {
  const cleaned = normalizeSecret(secret);
  let buffer = 0;
  let bitsLeft = 0;
  const out: number[] = [];

  for (const ch of cleaned) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val < 0) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      out.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return new Uint8Array(out);
};

const sha256Hex = async (value: string): Promise<string> => {
  const crypto = ensureCrypto();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const readAllKits = (): Record<string, OfflineUnlockParentKit> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeAllKits = (value: Record<string, OfflineUnlockParentKit>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage errors silently to avoid breaking command flow.
  }
};

export const saveParentOfflineUnlockKit = (kit: OfflineUnlockParentKit) => {
  const all = readAllKits();
  all[kit.childId] = kit;
  writeAllKits(all);
};

export const getParentOfflineUnlockKit = (
  childId: string
): OfflineUnlockParentKit | null => {
  const all = readAllKits();
  return all[childId] || null;
};

export const createOfflineUnlockProvisioning = async (
  childId: string,
  options?: {
    digits?: number;
    periodSec?: number;
    maxAttempts?: number;
    cooldownSec?: number;
    backupCodeCount?: number;
  }
): Promise<OfflineUnlockProvisioningResult> => {
  const digits = Math.min(10, Math.max(6, options?.digits ?? 8));
  const periodSec = Math.min(90, Math.max(15, options?.periodSec ?? 30));
  const maxAttempts = Math.min(12, Math.max(3, options?.maxAttempts ?? 6));
  const cooldownSec = Math.min(1800, Math.max(30, options?.cooldownSec ?? 300));
  const backupCodeCount = Math.min(16, Math.max(2, options?.backupCodeCount ?? 8));

  const totpSecret = createBase32Secret(32);
  const backupCodes = createBackupCodes(backupCodeCount);
  const backupCodeHashes = await Promise.all(
    backupCodes.map((code) => sha256Hex(code.toLowerCase()))
  );
  const version = `unlock-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  return {
    parentKit: {
      childId,
      version,
      totpSecret,
      backupCodes,
      digits,
      periodSec,
      createdAt,
    },
    commandPayload: {
      version,
      totpSecret,
      backupCodeHashes,
      digits,
      periodSec,
      maxAttempts,
      cooldownSec,
      source: 'parent_offline_unlock_provisioning',
    },
  };
};

export const generateOfflineUnlockCode = async (
  totpSecret: string,
  options?: { atMs?: number; digits?: number; periodSec?: number }
): Promise<string> => {
  const secret = normalizeSecret(totpSecret);
  if (!secret) throw new Error('Missing TOTP secret.');

  const digits = Math.min(10, Math.max(6, options?.digits ?? 8));
  const periodSec = Math.min(90, Math.max(15, options?.periodSec ?? 30));
  const atMs = options?.atMs ?? Date.now();
  const counter = Math.floor(atMs / 1000 / periodSec);

  const keyBytes = base32ToBytes(secret);
  if (!keyBytes.length) {
    throw new Error('Invalid TOTP secret.');
  }

  const crypto = ensureCrypto();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const msg = new Uint8Array(8);
  let value = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = value & 0xff;
    value = Math.floor(value / 256);
  }

  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binary % mod).padStart(digits, '0');
};

export const getOfflineUnlockCodeRemainingSec = (periodSec = 30): number => {
  const normalized = Math.min(90, Math.max(15, periodSec));
  const elapsed = Math.floor(Date.now() / 1000) % normalized;
  return normalized - elapsed;
};
