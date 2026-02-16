
/**
 * Amanah Local Storage Engine (IndexedDB Wrapper)
 * يتجاوز حدود localStorage (5MB) ويسمح بتخزين مكتبة صور ضخمة.
 */

const DB_NAME = 'AmanahDB';
const DB_VERSION = 1;
const STORE_NAME = 'avatar_library';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Database error: ", event);
      reject("Database error");
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // إنشاء مخزن للكائنات مع مفتاح فريد تلقائي
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const saveImageToDB = async (dataUrl: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // حفظ مع طابع زمني
    const request = store.put({ data: dataUrl, timestamp: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Failed to save image");
  });
};

export const saveBulkImagesToDB = async (dataUrls: string[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    if (dataUrls.length === 0) {
        resolve();
        return;
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("Bulk save failed");

    dataUrls.forEach(url => {
        store.put({ data: url, timestamp: Date.now() });
    });
  });
};

// --- دالة جديدة لإعادة كتابة المكتبة بالترتيب الجديد ---
export const overrideLibraryDB = async (orderedUrls: string[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // 1. مسح المكتبة القديمة
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
        // 2. إضافة الصور بالترتيب الجديد
        // نستخدم timestamps متتالية لضمان الترتيب عند الاسترجاع
        orderedUrls.forEach((url, index) => {
            // نعكس التوقيت لأن الاسترجاع يرتب من الأحدث للأقدم
            // نريد العنصر الأول (index 0) يكون الأحدث (أكبر timestamp)
            const time = Date.now() - index; 
            store.put({ data: url, timestamp: time });
        });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("Override failed");
  });
};

export const getImagesFromDB = async (): Promise<string[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result;
      // ترتيب الصور من الأحدث للأقدم (بناءً على التايم ستامب الذي نتحكم به في overrideLibraryDB)
      const sorted = records.sort((a, b) => b.timestamp - a.timestamp);
      resolve(sorted.map(record => record.data));
    };
    request.onerror = () => reject("Failed to fetch images");
  });
};

export const deleteImageFromDB = async (dataUrl: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const cursorRequest = store.openCursor();
    
    cursorRequest.onsuccess = (e: any) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.data === dataUrl) {
          cursor.delete();
          resolve();
        } else {
          cursor.continue();
        }
      } else {
        resolve();
      }
    };
    cursorRequest.onerror = () => reject("Delete failed");
  });
};
