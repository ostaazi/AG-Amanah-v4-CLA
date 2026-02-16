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
import { auth, db } from './firebaseConfig';
import {
  Child,
  ParentAccount,
  FamilyMember,
  MonitoringAlert,
  EvidenceRecord,
  ActivityLog,
  UserRole,
  PairingRequest,
  SafetyPlaybook,
  EvidenceCustody,
  DeviceCommandAudit,
  SystemPatch,
} from '../types';
import { ValidationService } from './validationService';

const CHILDREN_COLLECTION = 'children';
const PARENTS_COLLECTION = 'parents';
const ALERTS_COLLECTION = 'alerts';
const ACTIVITIES_COLLECTION = 'activities';
const SUPERVISORS_COLLECTION = 'supervisors';
const PLAYBOOKS_COLLECTION = 'playbooks';
const CUSTODY_COLLECTION = 'custody';
const AUDIT_LOGS_COLLECTION = 'auditLogs';
const SYSTEM_PATCHES_COLLECTION = 'systemPatches';
const PAIRING_REQUESTS_SUBCOLLECTION = 'pairingRequests';
const PAIRING_KEYS_COLLECTION = 'pairingKeys';

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

const isPermissionDeniedError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === 'permission-denied' || message.includes('Missing or insufficient permissions');
};

const resolvePlaybookOwnerId = (parentId: string): string | undefined => {
  const authUid = auth?.currentUser?.uid;
  if (!authUid) return undefined;
  if (!parentId) return authUid;
  return authUid;
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
  const authUid = auth?.currentUser?.uid;
  if (!authUid) {
    throw new Error('Not authenticated');
  }
  const ownerId = authUid;

  // 1. Generate 6-digit random code
  const newKey = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000); // 10 minutes

  // 2. Update parent profile (for reference)
  const parentRef = doc(db, PARENTS_COLLECTION, ownerId);
  await setDoc(parentRef, {
    pairingKey: newKey,
    pairingKeyExpiresAt: expiresAt,
  }, { merge: true });

  // 3. Create a look-up document where the KEY is the ID
  // This avoids "PERMISSION_DENIED" on collection queries
  const keyRef = doc(db, PAIRING_KEYS_COLLECTION, newKey);
  await setDoc(keyRef, {
    parentId: ownerId,
    expiresAt,
    createdAt: Timestamp.now()
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
      lockscreenBlackout: {
        value: { enabled: false, message: '' },
        timestamp: Timestamp.now(),
      },
      playSiren: { value: false, timestamp: Timestamp.now() },
      cutInternet: { value: false, timestamp: Timestamp.now() },
      blockCameraAndMic: { value: false, timestamp: Timestamp.now() },
      notifyParent: { value: false, timestamp: Timestamp.now() },
      startLiveStream: { value: false, timestamp: Timestamp.now() },
      stopLiveStream: { value: false, timestamp: Timestamp.now() },
      setVideoSource: { value: 'screen', timestamp: Timestamp.now() },
      setAudioSource: { value: 'mic', timestamp: Timestamp.now() },
      pushToTalk: { value: { active: false, source: 'mic' }, timestamp: Timestamp.now() },
      walkieTalkieEnable: { value: { enabled: false, source: 'mic' }, timestamp: Timestamp.now() },
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
      // Keep canonical identity from Firebase Auth UID.
      profile: { ...data, id: uid } as ParentAccount,
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
  const q = query(collection(db, ACTIVITIES_COLLECTION), where('parentId', '==', parentId));
  return onSnapshot(
    q,
    (snapshot) => {
      const activities = snapshot.docs
        .map(
          (d) =>
            ({
              id: d.id,
              ...sanitizeData(d.data()),
            }) as ActivityLog
        )
        .sort((a, b) => new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime())
        .slice(0, 50);
      callback(activities);
    },
    (err) => {
      console.warn('Activities Listener Error:', err);
      callback([]);
    }
  );
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
export const subscribeToPairingRequests = (
  parentId: string,
  callback: (requests: PairingRequest[]) => void
) => {
  if (!db || !parentId) return () => { };
  const q = query(
    collection(db, PARENTS_COLLECTION, parentId, PAIRING_REQUESTS_SUBCOLLECTION),
    where('status', '==', 'PENDING')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map(
        (d) =>
          ({
            id: d.id,
            ...sanitizeData(d.data()),
          }) as PairingRequest
      );
      callback(requests);
    },
    (err) => {
      console.error('PairingRequests listener error:', err);
      callback([]);
    }
  );
};

export const approvePairingRequest = async (parentId: string, request: PairingRequest) => {
  if (!db || !parentId) return;

  // 1. Create the actual child document
  const childData: Partial<Child> = {
    name: request.childName,
    parentId: parentId,
    status: 'online',
    // Bind child document to the real device Firebase UID (request doc id)
    deviceOwnerUid: request.id,
  };
  const newChild = await addChildToDB(parentId, childData);

  // 2. Update the pairing request to APPROVED and link the child ID
  const requestRef = doc(db, PARENTS_COLLECTION, parentId, PAIRING_REQUESTS_SUBCOLLECTION, request.id);
  await updateDoc(requestRef, {
    status: 'APPROVED',
    childDocumentId: newChild.id,
  });
};

export const backfillChildDeviceOwnership = async (parentId: string): Promise<void> => {
  if (!db || !parentId) return;
  const approvedQ = query(
    collection(db, PARENTS_COLLECTION, parentId, PAIRING_REQUESTS_SUBCOLLECTION),
    where('status', '==', 'APPROVED')
  );
  const approvedSnap = await getDocs(approvedQ);

  for (const reqDoc of approvedSnap.docs) {
    try {
      const reqData = reqDoc.data() as any;
      const childDocumentId = reqData?.childDocumentId;
      if (!childDocumentId) continue;

      const childRef = doc(db, CHILDREN_COLLECTION, childDocumentId);
      const childSnap = await getDoc(childRef);
      if (!childSnap.exists()) continue;

      const childData = childSnap.data() as any;
      const currentOwner = childData?.deviceOwnerUid;
      const childParentId = childData?.parentId;

      // Skip inconsistent legacy records that do not belong to this parent.
      if (childParentId && childParentId !== parentId) continue;

      if (!currentOwner) {
        await updateDoc(childRef, { deviceOwnerUid: reqDoc.id });
      }
    } catch (error: any) {
      const code = error?.code || '';
      const message = String(error?.message || '');
      const isPermissionIssue =
        code === 'permission-denied' || message.includes('Missing or insufficient permissions');
      if (!isPermissionIssue) {
        console.warn('Backfill skipped one child due to unexpected error:', error);
      }
    }
  }
};

export const rejectPairingRequest = async (parentId: string, requestId: string) => {
  if (!db || !parentId) return;
  const requestRef = doc(db, PARENTS_COLLECTION, parentId, PAIRING_REQUESTS_SUBCOLLECTION, requestId);
  await updateDoc(requestRef, {
    status: 'REJECTED',
  });
};

/**
 * Playbooks storage
 */
export const savePlaybooks = async (parentId: string, playbooks: SafetyPlaybook[]): Promise<void> => {
  if (!db) return;
  const ownerId = resolvePlaybookOwnerId(parentId);
  if (!ownerId) return;

  const ref = doc(db, PLAYBOOKS_COLLECTION, ownerId);
  try {
    await setDoc(
      ref,
      {
        parentId: ownerId,
        playbooks: ValidationService.sanitizeInput(playbooks),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error: any) {
    if (isPermissionDeniedError(error)) return;
    console.warn('savePlaybooks failed, using graceful fallback:', error);
  }
};

export const fetchPlaybooks = async (parentId: string): Promise<SafetyPlaybook[]> => {
  if (!db) return [];
  const ownerId = resolvePlaybookOwnerId(parentId);
  if (!ownerId) return [];

  const ref = doc(db, PLAYBOOKS_COLLECTION, ownerId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const data = sanitizeData(snap.data());
    return Array.isArray((data as any).playbooks) ? ((data as any).playbooks as SafetyPlaybook[]) : [];
  } catch (error: any) {
    if (isPermissionDeniedError(error)) return [];
    console.warn('fetchPlaybooks failed, using default playbooks fallback:', error);
    return [];
  }
};

export const subscribeToPlaybooks = (
  parentId: string,
  callback: (playbooks: SafetyPlaybook[]) => void
) => {
  if (!db) return () => {};
  const ownerId = resolvePlaybookOwnerId(parentId);
  if (!ownerId) return () => {};

  const ref = doc(db, PLAYBOOKS_COLLECTION, ownerId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback([]);
        return;
      }
      const data = sanitizeData(snap.data());
      callback(Array.isArray((data as any).playbooks) ? ((data as any).playbooks as SafetyPlaybook[]) : []);
    },
    (error) => {
      if (isPermissionDeniedError(error)) {
        callback([]);
        return;
      }
      callback([]);
    }
  );
};

/**
 * Custody and audit storage
 */
export const logCustodyEventToDB = async (
  parentId: string,
  event: Partial<EvidenceCustody>
): Promise<string | undefined> => {
  if (!db || !parentId) return undefined;
  const docRef = await addDoc(collection(db, CUSTODY_COLLECTION), {
    ...ValidationService.sanitizeInput(event),
    parentId,
    created_at: event.created_at || new Date().toISOString(),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const fetchCustodyByIncident = async (
  parentId: string,
  incidentId: string
): Promise<EvidenceCustody[]> => {
  if (!db || !parentId || !incidentId) return [];
  const q = query(
    collection(db, CUSTODY_COLLECTION),
    where('parentId', '==', parentId),
    where('incident_id', '==', incidentId),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...sanitizeData(d.data()) } as any as EvidenceCustody));
};

export const logAuditEvent = async (
  parentId: string,
  event: Partial<DeviceCommandAudit>
): Promise<string | undefined> => {
  if (!db || !parentId) return undefined;
  const docRef = await addDoc(collection(db, AUDIT_LOGS_COLLECTION), {
    ...ValidationService.sanitizeInput(event),
    parentId,
    created_at: event.created_at || new Date().toISOString(),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const subscribeToAuditLogs = (
  parentId: string,
  callback: (logs: DeviceCommandAudit[]) => void
) => {
  if (!db || !parentId) return () => {};
  const q = query(
    collection(db, AUDIT_LOGS_COLLECTION),
    where('parentId', '==', parentId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({ id: d.id, ...sanitizeData(d.data()) } as any as DeviceCommandAudit))
      );
    },
    () => callback([])
  );
};

/**
 * Security patch cloud state (used by audit service)
 */
export const applySystemPatchCloud = async (parentId: string, vulnId: string): Promise<void> => {
  if (!db || !parentId || !vulnId) return;
  await setDoc(
    doc(db, SYSTEM_PATCHES_COLLECTION, `${parentId}_${vulnId}`),
    {
      parentId,
      vulnId,
      status: 'COMMITTED',
      timestamp: Timestamp.now(),
    },
    { merge: true }
  );
};

export const rollbackSystemPatchCloud = async (parentId: string, vulnId: string): Promise<void> => {
  if (!db || !parentId || !vulnId) return;
  await setDoc(
    doc(db, SYSTEM_PATCHES_COLLECTION, `${parentId}_${vulnId}`),
    {
      parentId,
      vulnId,
      status: 'PENDING',
      timestamp: Timestamp.now(),
    },
    { merge: true }
  );
};

export const fetchSystemPatches = async (parentId: string): Promise<SystemPatch[]> => {
  if (!db || !parentId) return [];
  const q = query(collection(db, SYSTEM_PATCHES_COLLECTION), where('parentId', '==', parentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const row = sanitizeData(d.data()) as any;
    return {
      id: d.id,
      vulnId: Number(String(row.vulnId || '').replace(/\D/g, '')) || 0,
      title: `Patch ${row.vulnId || 'Unknown'}`,
      appliedBy: row.parentId || parentId,
      timestamp: new Date(row.timestamp || row.createdAt || Date.now()),
      status: row.status === 'COMMITTED' ? 'COMMITTED' : 'PENDING',
      codeSnippet: row.codeSnippet || '',
    } satisfies SystemPatch;
  });
};
