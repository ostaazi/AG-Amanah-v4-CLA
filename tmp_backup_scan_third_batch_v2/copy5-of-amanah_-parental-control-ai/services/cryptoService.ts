
/**
 * Amanah Forensic Encryption Engine
 * نظام تشفير AES-256-GCM متوافق مع معايير NIST.
 */

const MASTER_KEY_MATERIAL = "AMANAH_SECURE_VAULT_KEY_2024_SOVEREIGN";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encryptEvidence = async (plaintext: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MASTER_KEY_MATERIAL),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("AMANAH_SALT_v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
};

export const decryptEvidence = async (ciphertextB64: string, ivB64: string) => {
  const iv = new Uint8Array(atob(ivB64).split("").map(c => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(ciphertextB64).split("").map(c => c.charCodeAt(0)));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MASTER_KEY_MATERIAL),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("AMANAH_SALT_v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return decoder.decode(decrypted);
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
};

export const generateForensicHash = async (text: string): Promise<string> => {
  const msgUint8 = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Fix: Added encryptData
export const encryptData = async (data: string): Promise<string> => {
    const enc = await encryptEvidence(data);
    return JSON.stringify(enc);
};

// Fix: Added decryptData
export const decryptData = async (encryptedJson: string): Promise<string | null> => {
    try {
        const { ciphertext, iv } = JSON.parse(encryptedJson);
        return await decryptEvidence(ciphertext, iv);
    } catch {
        return null;
    }
};

// Fix: Added verifyEncryptionIntegrity
export const verifyEncryptionIntegrity = async (): Promise<boolean> => {
    const test = "integrity_check";
    const enc = await encryptEvidence(test);
    const dec = await decryptEvidence(enc.ciphertext, enc.iv);
    return test === dec;
};
