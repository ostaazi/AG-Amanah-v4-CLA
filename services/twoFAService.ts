/**
 * Amanah 2FA Security Service - Strict TOTP Implementation
 * ========================================================
 *
 * Algorithm: TOTP (RFC 6238) using HMAC-SHA1
 *
 * Phase 1.4: 2FA Secret Isolation
 * - Secrets stored in separate 'twoFactorSecrets' collection (not parent document)
 * - Secrets encrypted with user-specific encryption
 * - Backup codes also encrypted
 * - Access controlled by Firestore rules (owner-only)
 */

import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { encryptData, decryptData, getSessionPassword } from './cryptoService';

const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32ToHex = (base32: string) => {
  let bits = '';
  let hex = '';
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) continue; // تخطي المسافات أو الحروف غير الصحيحة
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substring(i, i + 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }
  return hex;
};

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

export const generate2FASecret = () => {
  let secret = '';
  const randomValues = new Uint8Array(16);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < 16; i++) {
    secret += base32chars.charAt(randomValues[i] % base32chars.length);
  }
  return secret;
};

export const getQRCodeUrl = (email: string, secret: string) => {
  const issuer = 'AmanahAI';
  const label = `${issuer}:${email}`;
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(otpauthUrl)}`;
};

/**
 * التحقق الحقيقي من كود TOTP مع سماحية وقت (Time Window)
 */
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  try {
    // التحقق من الوقت الحالي والنافذة السابقة واللاحقة لضمان الاستقرار (30 ثانية لكل نافذة)
    const now = Math.floor(Date.now() / 1000 / 30);
    const windows = [now, now - 1, now + 1]; // سماحية 30 ثانية تأخير أو تقديم

    for (const time of windows) {
      const calculated = await calculateTOTP(secret, time);
      if (calculated === code) return true;
    }
    return false;
  } catch (e) {
    console.error('2FA Verification Logic Error', e);
    return false;
  }
}

async function calculateTOTP(secret: string, time: number): Promise<string> {
  const key = hexToBytes(base32ToHex(secret));
  const msg = new Uint8Array(8);
  let v = time;
  for (let i = 7; i >= 0; i--) {
    msg[i] = v & 0xff;
    v = v >> 8;
  }

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const hmac = await window.crypto.subtle.sign('HMAC', cryptoKey, msg);
  const hmacArray = new Uint8Array(hmac);
  const offset = hmacArray[hmacArray.length - 1] & 0xf;

  const binary =
    ((hmacArray[offset] & 0x7f) << 24) |
    ((hmacArray[offset + 1] & 0xff) << 16) |
    ((hmacArray[offset + 2] & 0xff) << 8) |
    (hmacArray[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, '0');
}

export const verifyTOTPCode = (code: string): boolean => {
  return /^\d{6}$/.test(code);
};

/**
 * Generate backup codes for 2FA recovery
 * Phase 1.4: Returns 10 random 8-digit codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const randomBytes = new Uint8Array(4);
    window.crypto.getRandomValues(randomBytes);
    const code = Array.from(randomBytes)
      .map((b) => b.toString().padStart(3, '0'))
      .join('')
      .substring(0, 8);
    codes.push(code);
  }
  return codes;
}

/**
 * Enable 2FA for a parent account
 * Phase 1.4: Stores encrypted secret in separate collection
 *
 * @param parentId Parent's user ID
 * @param secret TOTP secret (base32)
 * @param encryptionSalt User's encryption salt (from parent profile)
 * @returns Backup codes for recovery
 */
export async function enable2FA(
  parentId: string,
  secret: string,
  encryptionSalt: string
): Promise<string[]> {
  if (!db) throw new Error('Firestore not initialized');

  const password = getSessionPassword();
  if (!password) {
    throw new Error('Session expired. Please log in again to enable 2FA.');
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  // Encrypt secret and backup codes
  const encryptedSecret = await encryptData(secret, password, encryptionSalt);
  const encryptedBackupCodes = await Promise.all(
    backupCodes.map((code) => encryptData(code, password, encryptionSalt))
  );

  // Store in separate twoFactorSecrets collection
  const twoFAData = {
    parentId,
    secretEncrypted: encryptedSecret,
    backupCodesEncrypted: encryptedBackupCodes,
    backupCodesUsed: [], // Track which codes have been used
    enabled: true,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  await setDoc(doc(db, 'twoFactorSecrets', parentId), twoFAData);

  return backupCodes; // Return plaintext codes for user to save
}

/**
 * Verify 2FA code (TOTP or backup code)
 * Phase 1.4: Retrieves encrypted secret from separate collection
 *
 * @param parentId Parent's user ID
 * @param code 6-digit TOTP code or 8-digit backup code
 * @param encryptionSalt User's encryption salt
 * @returns true if code is valid
 */
export async function verify2FACode(
  parentId: string,
  code: string,
  encryptionSalt: string
): Promise<boolean> {
  if (!db) throw new Error('Firestore not initialized');

  const password = getSessionPassword();
  if (!password) {
    throw new Error('Session expired. Please log in again.');
  }

  // Retrieve encrypted 2FA data
  const twoFADoc = await getDoc(doc(db, 'twoFactorSecrets', parentId));
  if (!twoFADoc.exists() || !twoFADoc.data().enabled) {
    throw new Error('2FA not enabled for this account');
  }

  const twoFAData = twoFADoc.data();

  // Check if it's a 6-digit TOTP code
  if (/^\d{6}$/.test(code)) {
    // Decrypt secret
    const secret = await decryptData(twoFAData.secretEncrypted, password);

    // Verify TOTP code
    const isValid = await verifyTOTP(secret, code);

    if (isValid) {
      // Update last used timestamp
      await updateDoc(doc(db, 'twoFactorSecrets', parentId), {
        lastUsedAt: new Date().toISOString(),
      });
    }

    return isValid;
  }

  // Check if it's an 8-digit backup code
  if (/^\d{8}$/.test(code)) {
    const backupCodesEncrypted = twoFAData.backupCodesEncrypted || [];
    const backupCodesUsed = twoFAData.backupCodesUsed || [];

    // Decrypt all backup codes
    const backupCodes = await Promise.all(
      backupCodesEncrypted.map((encrypted) => decryptData(encrypted, password))
    );

    // Find matching backup code
    const index = backupCodes.indexOf(code);
    if (index === -1) {
      return false; // Code not found
    }

    if (backupCodesUsed.includes(index)) {
      return false; // Code already used
    }

    // Mark code as used
    await updateDoc(doc(db, 'twoFactorSecrets', parentId), {
      backupCodesUsed: [...backupCodesUsed, index],
      lastUsedAt: new Date().toISOString(),
    });

    return true;
  }

  return false; // Invalid code format
}

/**
 * Disable 2FA for a parent account
 * Phase 1.4: Deletes from twoFactorSecrets collection
 */
export async function disable2FA(parentId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  await deleteDoc(doc(db, 'twoFactorSecrets', parentId));
}

/**
 * Check if 2FA is enabled for a parent
 */
export async function is2FAEnabled(parentId: string): Promise<boolean> {
  if (!db) return false;

  const twoFADoc = await getDoc(doc(db, 'twoFactorSecrets', parentId));
  return twoFADoc.exists() && twoFADoc.data().enabled === true;
}
