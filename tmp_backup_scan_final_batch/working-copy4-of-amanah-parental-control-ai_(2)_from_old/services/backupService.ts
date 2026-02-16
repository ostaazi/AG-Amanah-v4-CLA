
import { encryptData, decryptData } from './cryptoService';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Amanah Sovereignty Backup Engine v1.0
 * يقوم بتصدير واستيراد قواعد البيانات بتشفير عسكري
 */

export const generateEncryptedBackup = async (parentId: string) => {
  if (!db) return null;

  try {
    const collectionsToBackup = ['children', 'alerts', 'activities', 'parents'];
    const backupData: any = {
      timestamp: new Date().toISOString(),
      parentId,
      payload: {}
    };

    for (const colName of collectionsToBackup) {
      const snap = await getDocs(collection(db, colName));
      // فلترة البيانات لتخص هذا المستخدم فقط لزيادة الأمان
      backupData.payload[colName] = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((d: any) => d.parentId === parentId || d.id === parentId);
    }

    const jsonString = JSON.stringify(backupData);
    const encryptedBlob = await encryptData(jsonString);
    
    // إنشاء ملف للتحميل
    const blob = new Blob([encryptedBlob], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `amanah_backup_${new Date().getTime()}.vault`;
    link.click();
    
    return true;
  } catch (e) {
    console.error("Backup Generation Failed:", e);
    return false;
  }
};

export const restoreFromEncryptedBackup = async (encryptedData: string, parentId: string) => {
  if (!db) return false;

  try {
    const decryptedJson = await decryptData(encryptedData);
    if (!decryptedJson) throw new Error("Decryption failed or invalid key");

    const backup = JSON.parse(decryptedJson);
    if (backup.parentId !== parentId) throw new Error("Security Violation: Parent ID mismatch");

    const batch = writeBatch(db);

    // استرجاع المجموعات (ملاحظة: هذا يضيف البيانات المفقودة ولا يحذف الحالي لضمان السلامة)
    for (const colName in backup.payload) {
      const items = backup.payload[colName];
      for (const item of items) {
        const { id, ...data } = item;
        const ref = doc(db, colName, id);
        batch.set(ref, data, { merge: true });
      }
    }

    await batch.commit();
    return true;
  } catch (e) {
    console.error("Restore Failed:", e);
    throw e;
  }
};
