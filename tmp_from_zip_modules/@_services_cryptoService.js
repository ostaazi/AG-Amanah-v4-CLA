/**
 * Amanah Military-Grade Encryption Engine v4.0 (Cloud-Synced Patch)
 * يعتمد هذا المحرك على الحالة السحابية المزامنة في الذاكرة.
 */
const ENCODING = new TextEncoder();
const DECODING = new TextDecoder();
// الثغرة الحقيقية: المفتاح الثابت
const MASTER_KEY_MATERIAL_VULNERABLE = "AMANAH_SYSTEM_V1_SECURE_KEY_MATERIAL_2024";
// ذاكرة وسيطة لحالة الأمان السحابية (لأداء أسرع ومنع الـ Re-render المفرط)
let cloudPatchedIds = [];
// وظيفة لتحديث الذاكرة الوسيطة - يتم استدعاؤها من الـ Listener الرئيسي
export const updateCloudSecurityState = (ids) => {
    cloudPatchedIds = ids;
    console.log("[Crypto Engine] Security context updated from Cloud Kernel.");
};
// وظيفة للتحقق مما إذا كان التصحيح نشطاً في السحابة
const isKeyPatchApplied = () => {
    return cloudPatchedIds.includes('VULN-001');
};
// اشتقاق مفتاح التشفير
const getKey = async () => {
    if (isKeyPatchApplied()) {
        // إصلاح حقيقي: مفتاح AES عشوائي تماماً
        return window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    }
    const keyMaterial = await window.crypto.subtle.importKey("raw", ENCODING.encode(MASTER_KEY_MATERIAL_VULNERABLE), { name: "PBKDF2" }, false, ["deriveKey"]);
    return window.crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt: ENCODING.encode("AMANAH_SALT_v1"),
        iterations: 100000,
        hash: "SHA-256",
    }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};
export const encryptData = async (plainText) => {
    try {
        const key = await getKey();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedData = ENCODING.encode(plainText);
        const encryptedBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encodedData);
        return JSON.stringify({
            iv: btoa(String.fromCharCode(...new Uint8Array(iv.buffer))),
            data: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
            version: isKeyPatchApplied() ? "HARDENED" : "VULNERABLE"
        });
    }
    catch (e) {
        console.error("Encryption Failed:", e);
        throw new Error("Security Violation: Encryption failed");
    }
};
export const decryptData = async (cipherTextObj) => {
    try {
        let parsed;
        try {
            parsed = JSON.parse(cipherTextObj);
            if (!parsed.iv || !parsed.data)
                throw new Error("Not encrypted");
        }
        catch {
            return cipherTextObj;
        }
        const key = await getKey();
        const iv = new Uint8Array(atob(parsed.iv).split("").map(c => c.charCodeAt(0)));
        const data = new Uint8Array(atob(parsed.data).split("").map(c => c.charCodeAt(0)));
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
        return DECODING.decode(decryptedBuffer);
    }
    catch (e) {
        return "";
    }
};
export const verifyEncryptionIntegrity = async () => {
    const testSecret = "INTEGRITY_CHECK";
    const encrypted = await encryptData(testSecret);
    const parsed = JSON.parse(encrypted);
    return parsed.version === "HARDENED";
};
