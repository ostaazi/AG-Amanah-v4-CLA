
/**
 * Amanah Blob Storage Engine
 * يستخدم IndexedDB لتخزين الأدلة الجنائية الضخمة (الصور والفيديو) بأمان.
 */

const DB_NAME = "AmanahForensics";
const STORE_NAME = "blobs";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveBlob = async (id: string, data: any) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(data, id);
  return new Promise((resolve) => tx.oncomplete = resolve);
};

export const getBlob = async (id: string): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteBlob = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
};
