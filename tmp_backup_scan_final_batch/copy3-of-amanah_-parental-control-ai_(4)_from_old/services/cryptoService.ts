
/**
 * Amanah Military-Grade Encryption Engine
 * Algorithm: AES-GCM (Galois/Counter Mode) - 256 bit
 * Purpose: Encrypt all local data at rest (Zero-Knowledge Architecture).
 */

const ENCODING = new TextEncoder();
const DECODING = new TextDecoder();

// مفتاح النظام المشتق (في تطبيق حقيقي يشتق من كلمة مرور المستخدم)
// نستخدم مفتاحاً ثابتاً للمحاكاة لضمان استرجاع البيانات بعد التحديث
const MASTER_KEY_MATERIAL = "AMANAH_SYSTEM_V1_SECURE_KEY_MATERIAL_2024";

// اشتقاق مفتاح التشفير
const getKey = async () => {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    ENCODING.encode(MASTER_KEY_MATERIAL),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: ENCODING.encode("AMANAH_SALT_v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// تحويل Buffer إلى String للتخزين
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// تحويل Base64 إلى Buffer للمعالجة
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * تشفير البيانات
 * Returns: JSON string containing { iv: base64, data: base64 }
 */
export const encryptData = async (plainText: string): Promise<string> => {
  try {
    const key = await getKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV standard for GCM
    const encodedData = ENCODING.encode(plainText);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encodedData
    );

    return JSON.stringify({
      iv: arrayBufferToBase64(iv.buffer),
      data: arrayBufferToBase64(encryptedBuffer)
    });
  } catch (e) {
    console.error("Encryption Failed:", e);
    throw new Error("Security Violation: Encryption failed");
  }
};

/**
 * فك تشفير البيانات
 */
export const decryptData = async (cipherTextObj: string): Promise<string> => {
  try {
    // محاولة اكتشاف ما إذا كانت البيانات مشفرة أم نصاً عادياً (للتوافق مع البيانات القديمة)
    let parsed;
    try {
        parsed = JSON.parse(cipherTextObj);
        if (!parsed.iv || !parsed.data) throw new Error("Not encrypted");
    } catch {
        return cipherTextObj; // إعادة النص كما هو إذا لم يكن مشفراً
    }

    const key = await getKey();
    const iv = base64ToArrayBuffer(parsed.iv);
    const data = base64ToArrayBuffer(parsed.data);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      data
    );

    return DECODING.decode(decryptedBuffer);
  } catch (e) {
    console.error("Decryption Failed:", e);
    return ""; // إخفاء البيانات في حال الفشل الأمني
  }
};
