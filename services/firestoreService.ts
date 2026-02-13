import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  Child,
  ParentAccount,
  FamilyMember,
  MonitoringAlert,
  EvidenceRecord,
  ActivityLog,
  UserRole,
} from '../types';
import { ValidationService } from './validationService';

const CHILDREN_COLLECTION = 'children';
const PARENTS_COLLECTION = 'parents';
const ALERTS_COLLECTION = 'alerts';
const ACTIVITIES_COLLECTION = 'activities';
const SUPERVISORS_COLLECTION = 'supervisors';

/**
 * Validate document ID to prevent path traversal attacks
 * Phase 1.3: Security hardening
 */
const validateDocumentId = (id: string, fieldName: string = 'ID'): void => {
  if (!id) {
    throw new Error(`${fieldName} is required`);
  }
  // Only allow alphanumeric, hyphens, and underscores (max 128 chars)
  const validIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
  if (!validIdPattern.test(id)) {
    throw new Error(
      `Invalid ${fieldName} format. ` +
      `Only alphanumeric characters, hyphens, and underscores are allowed. ` +
      `Attempted value: ${id.substring(0, 50)}`
    );
  }
  // Prevent path traversal attempts
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`${fieldName} contains invalid path characters: ${id.substring(0, 50)}`);
  }
};

/**
 * وظيفة تطهير البيانات العميقة لمنع أخطاء Circular Reference وتحويل التواريخ
 */
const sanitizeData = (data: any, seen = new WeakSet()): any => {
  if (data === null || data === undefined) return data;

  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  if (typeof data === 'object') {
    if (seen.has(data)) return '[Circular]';
    seen.add(data);

    if (Array.isArray(data)) {
      return data.map((item) => sanitizeData(item, seen));
    }

    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeData(data[key], seen);
      }
    }
    return sanitized;
  }

  return data;
};

/**
 * Send remote command to child device
 * Phase 1.3: Added childId validation to prevent command injection
 */
export const sendRemoteCommand = async (childId: string, command: string, value: any = true) => {
  if (!db) return;

  // Validate childId to prevent path traversal and command injection
  validateDocumentId(childId, 'childId');

  // Phase 3.2: Validate command payload
  const validation = ValidationService.validateCommand(command, value);
  if (!validation.valid) {
    console.error(`Command Validation Failed: ${validation.error}`);
    throw new Error(validation.error);
  }

  const childRef = doc(db, CHILDREN_COLLECTION, childId);
  await updateDoc(childRef, {
    [`commands.${command}`]: {
      value,
      timestamp: Timestamp.now(),
      status: 'PENDING',
    },
  });
};

export const rotatePairingKey = async (parentId: string): Promise<string> => {
  if (!db || !parentId) throw new Error('Database not initialized or invalid parentId');

  // Generate 6-digit random code
  const newKey = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000); // 10 minutes

  const parentRef = doc(db, PARENTS_COLLECTION, parentId);
  await updateDoc(parentRef, {
    pairingKey: newKey,
    pairingKeyExpiresAt: expiresAt,
  });

  return newKey;
};

export const saveAlertToDB = async (
  parentId: string,
  alert: Partial<MonitoringAlert | EvidenceRecord>
) => {
  if (!db) return;

  // Phase 3.2: Validate alert data
  const validation = ValidationService.validateAlert(alert);
  if (!validation.valid) {
    console.warn(`Alert Validation Failed: ${validation.error}`);
    return; // Drop invalid alerts silently or throw
  }

  try {
    const payload = {
      ...alert,
      parentId,
      status: 'NEW',
      timestamp: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, ALERTS_COLLECTION), payload);
    return docRef.id;
  } catch (e) {
    console.error('Save Alert Error:', e);
  }
};

export const subscribeToAlerts = (
  parentId: string,
  callback: (alerts: MonitoringAlert[]) => void
) => {
  if (!db || !parentId) return () => { };
  // جلب أحدث 100 تنبيه مرتبة زمنياً
  const q = query(
    collection(db, ALERTS_COLLECTION),
    where('parentId', '==', parentId),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  let unsubscribe: () => void = () => { };

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const alerts = snapshot.docs.map((d) => {
        const rawData = d.data();
        return {
          id: d.id,
          ...sanitizeData(rawData),
          timestamp: rawData.timestamp?.toDate() || new Date(),
        } as MonitoringAlert;
      });
      callback(alerts);
    },
    (err) => {
      console.warn('Firestore Alerts Error (Check Indexes):', err);
      // Fallback: Use simple query (no orderBy) and sort in client
      const simpleQ = query(collection(db, ALERTS_COLLECTION), where('parentId', '==', parentId));
      unsubscribe = onSnapshot(simpleQ, (snap) => {
        const fallbackAlerts = snap.docs
          .map((d) => ({ id: d.id, ...sanitizeData(d.data()) }) as any)
          .sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        callback(fallbackAlerts);
      });
    }
  );

  return () => unsubscribe();
};

export const subscribeToChildren = (parentId: string, callback: (children: Child[]) => void) => {
  if (!db || !parentId) return () => { };
  const q = query(collection(db, CHILDREN_COLLECTION), where('parentId', '==', parentId));
  return onSnapshot(q, (snapshot) => {
    const children = snapshot.docs.map(
      (d) =>
        ({
          id: d.id,
          ...sanitizeData(d.data()),
        }) as Child
    );
    callback(children);
  });
};

export const addChildToDB = async (parentId: string, childData: Partial<Child>): Promise<Child> => {
  if (!db) throw new Error('Database not initialized');
  const payload = {
    ...ValidationService.sanitizeInput(childData),
    parentId,
    status: 'online',
    createdAt: Timestamp.now(),
    batteryLevel: 100,
    signalStrength: 4,
    commands: {
      takeScreenshot: { value: false, timestamp: Timestamp.now() },
      lockDevice: { value: false, timestamp: Timestamp.now() },
      playSiren: { value: false, timestamp: Timestamp.now() },
    },
  };
  const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), payload);
  return { id: docRef.id, ...payload } as any;
};

export const syncParentProfile = async (
  uid: string,
  email: string | null,
  defaultData: any
): Promise<{ profile: ParentAccount; library: string[] }> => {
  if (!db) throw new Error('Database not initialized');
  const parentRef = doc(db, PARENTS_COLLECTION, uid);
  const parentSnap = await getDoc(parentRef);

  if (parentSnap.exists()) {
    const data = sanitizeData(parentSnap.data());
    return {
      profile: { id: uid, ...data } as ParentAccount,
      library: data.library || [],
    };
  } else {
    const newProfile = { ...defaultData, id: uid, email };
    await setDoc(parentRef, newProfile);
    return { profile: newProfile, library: [] };
  }
};

export const subscribeToActivities = (
  parentId: string,
  callback: (data: ActivityLog[]) => void
) => {
  if (!db || !parentId) return () => { };
  const q = query(
    collection(db, ACTIVITIES_COLLECTION),
    where('parentId', '==', parentId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  let unsubscribe: () => void = () => { };

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const activities = snapshot.docs.map(
        (d) =>
          ({
            id: d.id,
            ...sanitizeData(d.data()),
          }) as ActivityLog
      );
      callback(activities);
    },
    (err) => {
      console.warn('Activities Listener Error (Check Indexes):', err);
      // Fallback if index not ready
      const simpleQ = query(
        collection(db, ACTIVITIES_COLLECTION),
        where('parentId', '==', parentId)
      );
      unsubscribe = onSnapshot(simpleQ, (snap) => {
        const fallback = snap.docs
          .map((d) => ({ id: d.id, ...sanitizeData(d.data()) }) as any)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        callback(fallback);
      });
    }
  );

  return () => unsubscribe();
};

export const fetchSupervisors = async (parentId: string): Promise<FamilyMember[]> => {
  if (!db || !parentId) return [];
  const q = query(collection(db, SUPERVISORS_COLLECTION), where('parentId', '==', parentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...sanitizeData(d.data()) }) as FamilyMember);
};

export const updateMemberInDB = async (id: string, role: UserRole, updates: any): Promise<void> => {
  if (!db) return;
  const collectionName =
    role === 'CHILD'
      ? CHILDREN_COLLECTION
      : role === 'SUPERVISOR'
        ? SUPERVISORS_COLLECTION
        : PARENTS_COLLECTION;
  const ref = doc(db, collectionName, id);
  await updateDoc(ref, updates);
};

export const deleteMemberFromDB = async (id: string, role: UserRole): Promise<void> => {
  if (!db) return;
  const collectionName =
    role === 'CHILD'
      ? CHILDREN_COLLECTION
      : role === 'SUPERVISOR'
        ? SUPERVISORS_COLLECTION
        : PARENTS_COLLECTION;
  await deleteDoc(doc(db, collectionName, id));
};

export const logUserActivity = async (
  parentId: string,
  activity: Partial<ActivityLog>
): Promise<void> => {
  if (!db || !parentId) return;
  await addDoc(collection(db, ACTIVITIES_COLLECTION), {
    ...ValidationService.sanitizeInput(activity),
    parentId,
    timestamp: Timestamp.now(),
  });
};

export const inviteSupervisor = async (parentId: string, data: any): Promise<FamilyMember> => {
  if (!db) throw new Error('Database not initialized');
  const payload = {
    ...data,
    parentId,
    role: 'SUPERVISOR',
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, SUPERVISORS_COLLECTION), payload);
  return { id: docRef.id, ...payload } as FamilyMember;
};

export const deleteAlertFromDB = async (alertId: string): Promise<void> => {
  if (!db) return;
  await deleteDoc(doc(db, ALERTS_COLLECTION, alertId));
};

export const updateAlertStatus = async (alertId: string, status: string): Promise<void> => {
  if (!db) return;
  const alertRef = doc(db, ALERTS_COLLECTION, alertId);
  await updateDoc(alertRef, { status });
};
