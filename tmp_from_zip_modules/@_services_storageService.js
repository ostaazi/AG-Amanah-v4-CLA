import { encryptData, decryptData } from '@/services/cryptoService';
/**
 * Amanah Local Storage Engine (IndexedDB Wrapper)
 * يتجاوز حدود localStorage (5MB) ويسمح بتخزين مكتبة صور ضخمة.
 * الإصدار v2.0: يدعم التشفير الكامل (Encryption-at-Rest).
 */
const DB_NAME = 'AmanahDB';
const DB_VERSION = 1;
const STORE_NAME = 'avatar_library';
export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            console.error("Database error: ", event);
            reject("Database error");
        };
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // إنشاء مخزن للكائنات مع مفتاح فريد تلقائي
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
};
export const saveImageToDB = async (dataUrl) => {
    const db = await initDB();
    // تشفير البيانات قبل الحفظ
    const encryptedPayload = await encryptData(dataUrl);
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        // حفظ البيانات المشفرة
        const request = store.put({ data: encryptedPayload, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Failed to save image");
    });
};
export const saveBulkImagesToDB = async (dataUrls) => {
    const db = await initDB();
    // تشفير الدفعة بالكامل
    const encryptionPromises = dataUrls.map(url => encryptData(url));
    const encryptedUrls = await Promise.all(encryptionPromises);
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        if (encryptedUrls.length === 0) {
            resolve();
            return;
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Bulk save failed");
        encryptedUrls.forEach(encUrl => {
            store.put({ data: encUrl, timestamp: Date.now() });
        });
    });
};
export const overrideLibraryDB = async (orderedUrls) => {
    const db = await initDB();
    // تشفير قبل الحفظ
    const encryptionPromises = orderedUrls.map(url => encryptData(url));
    const encryptedUrls = await Promise.all(encryptionPromises);
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
            encryptedUrls.forEach((encUrl, index) => {
                const time = Date.now() - index;
                store.put({ data: encUrl, timestamp: time });
            });
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Override failed");
    });
};
export const getImagesFromDB = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = async () => {
            const records = request.result;
            const sorted = records.sort((a, b) => b.timestamp - a.timestamp);
            // فك تشفير البيانات عند الاسترجاع
            try {
                const decryptionPromises = sorted.map(record => decryptData(record.data));
                const decryptedImages = await Promise.all(decryptionPromises);
                // تصفية أي صور فشل فك تشفيرها (سلاسل فارغة)
                resolve(decryptedImages.filter(img => img.length > 0));
            }
            catch (e) {
                console.error("Decryption pipeline failed", e);
                reject("Security Error: Decryption failed");
            }
        };
        request.onerror = () => reject("Failed to fetch images");
    });
};
export const deleteImageFromDB = async (targetDataUrl) => {
    const db = await initDB();
    // ملاحظة: الحذف يتطلب بحثاً. لأن البيانات مشفرة، لا يمكننا البحث عن URL مباشرة.
    // الحل الأمثل هو إعادة جلب الكل ومقارنة المفكك، ثم حذف الـ ID.
    // للتبسيط هنا، سنقوم بحذف العنصر الذي يطابق التشفير (وهو مستحيل لأن IV عشوائي).
    // لذا سنستخدم طريقة: جلب الكل -> فك تشفير -> إيجاد الـ ID -> حذف بالـ ID.
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll(); // جلب الكل أولاً
        request.onsuccess = async () => {
            const records = request.result;
            let idToDelete = null;
            for (const record of records) {
                const decrypted = await decryptData(record.data);
                if (decrypted === targetDataUrl) {
                    idToDelete = record.id;
                    break;
                }
            }
            if (idToDelete) {
                store.delete(idToDelete);
                resolve();
            }
            else {
                // لم يتم العثور عليه (قد يكون غير موجود أصلاً)
                resolve();
            }
        };
        request.onerror = () => reject("Delete failed");
    });
};
