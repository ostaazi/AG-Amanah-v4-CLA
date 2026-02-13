/**
 * Amanah User-Specific Encryption Service
 * ========================================
 *
 * Security Model (Phase 1.2):
 * - Each user's data encrypted with a key derived from their password
 * - Uses PBKDF2-SHA256 with 100,000 iterations
 * - Random salt per user (stored in Firestore)
 * - Application pepper from environment (defense-in-depth)
 * - AES-256-GCM for encryption (authenticated encryption)
 *
 * Migration from Legacy:
 * - Legacy encryption used shared master key (INSECURE)
 * - Migration happens on first login after Phase 1.2 deployment
 * - Legacy decrypt function kept for 30 days for compatibility
 */

const ENCODING = new TextEncoder();
const DECODING = new TextDecoder();

// PBKDF2 Configuration
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12; // GCM standard

/**
 * Encrypted data structure
 */
interface EncryptedPayload {
  ciphertext: string; // Base64-encoded encrypted data
  iv: string; // Base64-encoded initialization vector
  salt: string; // Base64-encoded user salt (for key derivation)
  version: number; // Encryption version (1 = legacy, 2 = user-specific)
}

/**
 * Session storage for current user's password
 *
 * SECURITY NOTE:
 * - Password stored in memory only (not localStorage or sessionStorage)
 * - Cleared on logout or page refresh
 * - Required for encrypting/decrypting during session
 */
let sessionPassword: string | null = null;

/**
 * Store user password in session memory
 * Called after successful login/registration
 */
export function setSessionPassword(password: string): void {
  sessionPassword = password;
}

/**
 * Clear session password
 * Called on logout or session expiry
 */
export function clearSessionPassword(): void {
  sessionPassword = null;
}

/**
 * Get session password (internal use)
 */
export function getSessionPassword(): string | null {
  return sessionPassword;
}

/**
 * Generate random salt for new user
 * Called during registration
 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  return arrayBufferToBase64(salt);
}

/**
 * Derive encryption key from user password using PBKDF2
 *
 * @param password User's password (not stored anywhere)
 * @param salt User's unique salt (stored in Firestore)
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // Get application pepper from environment
  const pepper = import.meta.env.VITE_APP_PEPPER || '';
  if (!pepper || pepper.includes('change_in_production')) {
    console.warn('SECURITY WARNING: Application pepper not configured or using default value');
  }

  // Combine password with pepper for defense-in-depth
  const passwordWithPepper = password + pepper;

  // Import password as key material
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    ENCODING.encode(passwordWithPepper),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with user's password-derived key
 *
 * @param plaintext Data to encrypt
 * @param userPassword User's password (from session)
 * @param saltBase64 User's salt (from Firestore)
 * @returns JSON string containing encrypted payload
 */
export async function encryptData(
  plaintext: string,
  userPassword?: string,
  saltBase64?: string
): Promise<string> {
  try {
    // Use provided password or session password
    const password = userPassword || sessionPassword;
    if (!password) {
      throw new Error('No password available for encryption. User must be logged in.');
    }

    // Use provided salt or throw error
    if (!saltBase64) {
      throw new Error('Encryption salt not provided. User profile may be corrupted.');
    }

    const salt = base64ToUint8Array(saltBase64);
    const key = await deriveKeyFromPassword(password, salt);

    // Generate random IV (never reuse!)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

    // Encrypt plaintext
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ENCODING.encode(plaintext)
    );

    // Create payload
    const payload: EncryptedPayload = {
      ciphertext: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv),
      salt: saltBase64,
      version: 2, // Version 2 = user-specific encryption
    };

    return JSON.stringify(payload);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Security violation: Encryption failed');
  }
}

/**
 * Decrypt data with user's password-derived key
 *
 * @param cipherTextObj Encrypted payload JSON string
 * @param userPassword User's password (from session)
 * @returns Decrypted plaintext
 */
export async function decryptData(cipherTextObj: string, userPassword?: string): Promise<string> {
  try {
    // Try to parse as encrypted payload
    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(cipherTextObj);
      if (!payload.iv || !payload.ciphertext) {
        throw new Error('Invalid encrypted payload');
      }
    } catch {
      // If parsing fails, might be plaintext or legacy format
      return await decryptDataLegacy(cipherTextObj);
    }

    // Handle legacy encryption (version 1 or missing version)
    if (!payload.version || payload.version === 1) {
      return await decryptDataLegacy(cipherTextObj);
    }

    // Version 2: User-specific encryption
    const password = userPassword || sessionPassword;
    if (!password) {
      throw new Error('Password required for decryption. Please log in again.');
    }

    const salt = base64ToUint8Array(payload.salt);
    const iv = base64ToUint8Array(payload.iv);
    const ciphertext = base64ToUint8Array(payload.ciphertext);

    const key = await deriveKeyFromPassword(password, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    return DECODING.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Decryption failed: Invalid password or corrupted data');
  }
}

/**
 * Legacy decryption using shared master key
 *
 * SECURITY WARNING: This uses the old insecure shared key.
 * Only used for migration of existing data.
 * Will be removed 30 days after Phase 1.2 deployment.
 *
 * @deprecated Use user-specific encryption instead
 */
async function decryptDataLegacy(cipherTextObj: string): Promise<string> {
  console.warn('Using legacy decryption with shared master key. Data should be migrated.');

  try {
    // Check if it's plaintext (backwards compatibility)
    let parsed: any;
    try {
      parsed = JSON.parse(cipherTextObj);
      if (!parsed.iv || !parsed.data) {
        // Not encrypted, return as-is
        return cipherTextObj;
      }
    } catch {
      // Not JSON, return as plaintext
      return cipherTextObj;
    }

    // Legacy shared master key (INSECURE - for migration only)
    const MASTER_KEY_MATERIAL = 'AMANAH_SYSTEM_V1_SECURE_KEY_MATERIAL_2024';
    const LEGACY_SALT = 'AMANAH_SALT_v1';

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      ENCODING.encode(MASTER_KEY_MATERIAL),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: ENCODING.encode(LEGACY_SALT),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const iv = base64ToArrayBuffer(parsed.iv);
    const data = base64ToArrayBuffer(parsed.data);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      data
    );

    return DECODING.decode(decryptedBuffer);
  } catch (error) {
    console.error('Legacy decryption failed:', error);
    return ''; // Return empty string on failure (matches old behavior)
  }
}

/**
 * Helper: Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert Base64 to ArrayBuffer (legacy)
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Helper: Convert Base64 to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}
