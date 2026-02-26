/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AlertSeverity, Category } from '../types';
import { auth, canUseMockData, db } from './firebaseConfig';

export type MockDataDomain =
  | 'children'
  | 'devices'
  | 'eventsAlerts'
  | 'timings'
  | 'supervisors'
  | 'psychPulse'
  | 'operations';

export const MOCK_DATA_DOMAINS: MockDataDomain[] = [
  'children',
  'devices',
  'eventsAlerts',
  'timings',
  'supervisors',
  'psychPulse',
  'operations',
];

export type MockDataVerificationReport = {
  counts: Record<MockDataDomain, number>;
  total: number;
  clean: boolean;
  inaccessible: MockDataDomain[];
  checkedAt: string;
};

const MOCK_TAG = 'AMANAH_FAKE_DATA';
const mockDataNoticeCache = new Set<string>();

const buildEmptyDomainCounts = (): Record<MockDataDomain, number> => ({
  children: 0,
  devices: 0,
  eventsAlerts: 0,
  timings: 0,
  supervisors: 0,
  psychPulse: 0,
  operations: 0,
});

const isMockRecord = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  return data.mockTag === MOCK_TAG || data.isMock === true;
};

const logMockDataNoticeOnce = (key: string, message: string) => {
  if (mockDataNoticeCache.has(key)) return;
  mockDataNoticeCache.add(key);
  console.info(`[MockData] ${message}`);
};

const ensureMockOpsAllowed = (context: string) => {
  if (canUseMockData()) return;
  logMockDataNoticeOnce(`mock-disabled:${context}`, `${context}: blocked because mock operations are disabled.`);
  throw new Error('MOCK_DATA_DISABLED');
};

const resolveMockOwnerId = (requestedParentId: string): string => {
  const requested = String(requestedParentId || '').trim();
  const authUid = String(auth?.currentUser?.uid || '').trim();
  if (!authUid) return requested;

  if (requested && requested !== authUid) {
    logMockDataNoticeOnce(
      `mock-owner-remap:${requested}:${authUid}`,
      `mock scope remapped to auth uid (${authUid}).`
    );
  }
  return authUid;
};

const isPermissionDeniedError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const raw = String(error || '');
  return (
    code === 'permission-denied' ||
    message.includes('Missing or insufficient permissions') ||
    raw.includes('Missing or insufficient permissions') ||
    raw.includes('permission-denied')
  );
};

const runMutationBatch = async (
  mutations: Array<() => Promise<unknown>>,
  context: string
): Promise<number> => {
  if (mutations.length === 0) return 0;
  const settled = await Promise.allSettled(mutations.map((mutation) => mutation()));

  let success = 0;
  const hardFailures: any[] = [];

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      success += 1;
      continue;
    }

    if (isPermissionDeniedError(result.reason)) {
      logMockDataNoticeOnce(
        `mutation-permission-denied:${context}`,
        `${context}: skipped one mutation due to permission-denied.`
      );
      continue;
    }

    hardFailures.push(result.reason);
  }

  if (hardFailures.length > 0) {
    throw hardFailures[0];
  }

  return success;
};

const safeGetDocs = async (queryRef: any, context: string) => {
  try {
    return await getDocs(queryRef);
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      logMockDataNoticeOnce(
        `read-permission-denied:${context}`,
        `${context}: skipped read due to permission-denied.`
      );
      return { docs: [] } as any;
    }
    throw error;
  }
};

const safeGetDoc = async (docRef: any, context: string) => {
  try {
    return await getDoc(docRef);
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      logMockDataNoticeOnce(
        `read-permission-denied:${context}`,
        `${context}: skipped read due to permission-denied.`
      );
      return { exists: () => false, data: () => undefined } as any;
    }
    throw error;
  }
};

const safeGetDocsWithStatus = async (
  queryRef: any,
  context: string
): Promise<{ docs: any[]; denied: boolean }> => {
  try {
    const snap = await getDocs(queryRef);
    return { docs: snap.docs || [], denied: false };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      logMockDataNoticeOnce(
        `read-permission-denied:${context}`,
        `${context}: skipped read due to permission-denied.`
      );
      return { docs: [], denied: true };
    }
    throw error;
  }
};

const safeGetDocWithStatus = async (
  docRef: any,
  context: string
): Promise<{ exists: boolean; data: any; denied: boolean }> => {
  try {
    const snap = await getDoc(docRef);
    return { exists: snap.exists(), data: snap.data?.(), denied: false };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      logMockDataNoticeOnce(
        `read-permission-denied:${context}`,
        `${context}: skipped read due to permission-denied.`
      );
      return { exists: false, data: undefined, denied: true };
    }
    throw error;
  }
};

const MOCK_CHILD_TEMPLATES = [
  {
    name: 'سارة - تجريبي',
    age: 12,
    avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png',
  },
  {
    name: 'عمر - تجريبي',
    age: 15,
    avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
  },
];

const MOCK_SUPERVISORS = [
  {
    name: 'مشرف تجريبي 1',
    email: 'mock.supervisor1@amanah.local',
    avatar:
      'https://img.freepik.com/premium-vector/hijab-woman-avatar-illustration-vector-woman-hijab-profile-icon_671746-348.jpg',
  },
  {
    name: 'مشرف تجريبي 2',
    email: 'mock.supervisor2@amanah.local',
    avatar:
      'https://img.freepik.com/premium-vector/hijab-woman-avatar-illustration-vector-woman-hijab-profile-icon_671746-348.jpg',
  },
];

const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MOCK_SCENARIO_PRESETS: Array<{
  id:
    | 'bullying'
    | 'threat_exposure'
    | 'gaming'
    | 'inappropriate_content'
    | 'cyber_crime'
    | 'crypto_scams'
    | 'phishing_links';
  keywords: string[];
  recommendation: string;
  signals: Array<{
    title: string;
    severity: AlertSeverity;
    reason: string;
    suggestedAction: string;
  }>;
}> = [
  {
    id: 'bullying',
    keywords: ['تنمر', 'تعليقات جارحة', 'عزلة'],
    recommendation:
      'ابدأ حوارًا داعمًا بلا لوم، ثم فعّل الحظر والإبلاغ مع متابعة نفسية قصيرة خلال 72 ساعة.',
    signals: [
      {
        title: 'مؤشر مضايقات رقمية',
        severity: AlertSeverity.HIGH,
        reason: 'رسائل سلبية متكررة مع حذف سريع للمحادثات.',
        suggestedAction: 'توثيق الأدلة + تعديل الخصوصية + تواصل مدرسي إذا لزم.',
      },
      {
        title: 'تراجع في الثقة',
        severity: AlertSeverity.MEDIUM,
        reason: 'انخفاض ملحوظ في التفاعل بعد الاستخدام.',
        suggestedAction: 'جلسة حوار يومية قصيرة مع تعزيز الدعم الأسري.',
      },
    ],
  },
  {
    id: 'threat_exposure',
    keywords: ['تهديد', 'ابتزاز', 'خوف'],
    recommendation:
      'فعّل خطة 10 دقائق: لا تفاوض، لا دفع، حفظ الأدلة، تأمين الحساب، ثم الإبلاغ الرسمي.',
    signals: [
      {
        title: 'احتمال ابتزاز مباشر',
        severity: AlertSeverity.CRITICAL,
        reason: 'مفردات تهديد واضحة مرتبطة بطلب مالي/صور.',
        suggestedAction: 'إيقاف التواصل فورًا + حماية الحساب + تصعيد قانوني.',
      },
      {
        title: 'قلق حاد عند الإشعارات',
        severity: AlertSeverity.HIGH,
        reason: 'استجابة خوف متكررة من جهة تواصل بعينها.',
        suggestedAction: 'حظر فوري ومراجعة أمن الجهاز.',
      },
    ],
  },
  {
    id: 'gaming',
    keywords: ['سهر', 'إدمان', 'لعب'],
    recommendation:
      'اعتمد تدخلًا تدريجيًا 4 أسابيع: ضبط النوم، خفض الوقت، مكافآت التزام، ومراجعة أسبوعية.',
    signals: [
      {
        title: 'استخدام ليلي مفرط',
        severity: AlertSeverity.HIGH,
        reason: 'تمدد اللعب بعد منتصف الليل بشكل متكرر.',
        suggestedAction: 'تفعيل Bedtime + قفل التطبيقات عالية الاستهلاك.',
      },
      {
        title: 'توتر عند الإيقاف',
        severity: AlertSeverity.MEDIUM,
        reason: 'عصبية واضحة عند انتهاء مدة اللعب.',
        suggestedAction: 'استراتيجية خفض تدريجي بدل المنع المفاجئ.',
      },
    ],
  },
  {
    id: 'inappropriate_content',
    keywords: ['محتوى صادم', 'إباحية', 'فضول'],
    recommendation:
      'شدد الفلترة حسب العمر، وأضف حوارًا آمنًا: أغلق وبلّغ دون عقوبة أو تخويف.',
    signals: [
      {
        title: 'محاولات وصول لمحتوى محجوب',
        severity: AlertSeverity.HIGH,
        reason: 'تكرار وصول لتصنيفات غير مناسبة للعمر.',
        suggestedAction: 'تقوية SafeSearch وفلترة DNS ومراجعة المتصفح.',
      },
      {
        title: 'استخدام تصفح خفي متكرر',
        severity: AlertSeverity.MEDIUM,
        reason: 'تنقل مكثف بين روابط خارجية غير موثوقة.',
        suggestedAction: 'مراجعة الإعدادات وتفعيل قيود البحث الآمن.',
      },
    ],
  },
  {
    id: 'cyber_crime',
    keywords: ['اختراق', 'سكربت', 'تجاوز'],
    recommendation:
      'حوّل الفضول التقني إلى مسار قانوني (تعلم أمني أخلاقي) مع توضيح العواقب الجنائية.',
    signals: [
      {
        title: 'ميل سلوكي هجومي',
        severity: AlertSeverity.HIGH,
        reason: 'اهتمام متكرر بأدوات تعطيل/اختراق.',
        suggestedAction: 'منع الأدوات المجهولة + توجيه تعليمي قانوني.',
      },
      {
        title: 'إخفاء الهوية المفرط',
        severity: AlertSeverity.MEDIUM,
        reason: 'استخدام قنوات إخفاء دون مبرر واضح.',
        suggestedAction: 'مراجعة الاستخدام وتعريف الحدود القانونية.',
      },
    ],
  },
  {
    id: 'crypto_scams',
    keywords: ['ربح سريع', 'تحويل', 'قنوات استثمار'],
    recommendation:
      'فعّل مراجعة أسرية لأي معاملة مالية رقمية، وامنع القنوات غير الموثوقة فورًا.',
    signals: [
      {
        title: 'اندفاع مالي عالي المخاطرة',
        severity: AlertSeverity.HIGH,
        reason: 'محاولات تحويل متكررة لجهات مجهولة.',
        suggestedAction: 'تعطيل المدفوعات غير المعتمدة ومراجعة ولي الأمر.',
      },
      {
        title: 'تأثر بتوصيات مضللة',
        severity: AlertSeverity.MEDIUM,
        reason: 'تفاعل مع قنوات تعد بأرباح مضمونة.',
        suggestedAction: 'توعية مالية أساسية وحظر المصادر الاحتيالية.',
      },
    ],
  },
  {
    id: 'phishing_links',
    keywords: ['تصيد', 'رابط مشبوه', 'otp', 'phishing'],
    recommendation:
      'فعّل خطة مضاد التصيد فوراً: عزل الروابط، تغيير كلمات المرور، تفعيل المصادقة الثنائية (2FA)، ومراجعة جلسات الدخول النشطة.',
    signals: [
      {
        title: 'رابط تصيد نشط',
        severity: AlertSeverity.CRITICAL,
        reason: 'تم رصد رابط مختصر يطلب بيانات دخول أو رمز تحقق.',
        suggestedAction: 'منع الرابط + تغيير كلمة المرور + غلق الجلسات + إبلاغ المنصة.',
      },
      {
        title: 'مؤشرات سرقة حساب',
        severity: AlertSeverity.HIGH,
        reason: 'طلبات متكررة لرموز OTP أو صفحات دخول غير معروفة.',
        suggestedAction: 'تفعيل المصادقة الثنائية (2FA) وتدقيق أجهزة تسجيل الدخول فوراً.',
      },
    ],
  },
];

const createMockPsychProfile = () => {
  const emotions = ['هادئ', 'قلق', 'متوتر', 'منعزل', 'سعيد'];
  const anxiety = 35 + Math.floor(Math.random() * 60);
  const scenario = randomFrom(MOCK_SCENARIO_PRESETS);
  const mood = Math.max(20, 100 - anxiety + Math.floor(Math.random() * 20) - 10);
  const isolation = Math.min(100, Math.max(15, anxiety - 10 + Math.floor(Math.random() * 25)));

  return {
    anxietyLevel: anxiety,
    moodScore: mood,
    dominantEmotion: randomFrom(emotions),
    isolationRisk: isolation,
    recentKeywords: scenario.keywords,
    recommendation: scenario.recommendation,
    priorityScenario: scenario.id,
    incidentReadinessScore: 45 + Math.floor(Math.random() * 50),
    riskSignals: scenario.signals.map((signal, idx) => ({
      id: `signal-${scenario.id}-${idx + 1}`,
      ...signal,
    })),
    weeklyTrend: [
      { label: 'الإثنين', value: 48 + Math.floor(Math.random() * 40) },
      { label: 'الثلاثاء', value: 45 + Math.floor(Math.random() * 42) },
      { label: 'الأربعاء', value: 50 + Math.floor(Math.random() * 38) },
      { label: 'الخميس', value: 52 + Math.floor(Math.random() * 35) },
      { label: 'الجمعة', value: 47 + Math.floor(Math.random() * 43) },
    ],
  };
};

const listChildrenByParent = async (parentId: string) => {
  const q = query(collection(db!, 'children'), where('parentId', '==', parentId));
  return safeGetDocs(q, 'list mock children');
};

const listSupervisorsByParent = async (parentId: string) => {
  const q = query(collection(db!, 'supervisors'), where('parentId', '==', parentId));
  return safeGetDocs(q, 'list mock supervisors');
};

const listAlertsByParent = async (parentId: string) => {
  const q = query(collection(db!, 'alerts'), where('parentId', '==', parentId));
  return safeGetDocs(q, 'list mock alerts');
};

const listActivitiesByParent = async (parentId: string) => {
  const q = query(collection(db!, 'activities'), where('parentId', '==', parentId));
  return safeGetDocs(q, 'list mock activities');
};

const ensureMockChildren = async (parentId: string, minCount: number) => {
  const snap = await listChildrenByParent(parentId);
  const mockDocs = snap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);

  let created = 0;
  const missing = Math.max(0, minCount - mockDocs.length);

  for (let i = 0; i < missing; i++) {
    const template = MOCK_CHILD_TEMPLATES[i % MOCK_CHILD_TEMPLATES.length];
    try {
      await addDoc(collection(db!, 'children'), {
        parentId,
        role: 'CHILD',
        mockTag: MOCK_TAG,
        isMock: true,
        name: `${template.name} ${Date.now().toString().slice(-4)}`,
        age: template.age,
        avatar: template.avatar,
        status: 'offline',
        batteryLevel: 100,
        signalStrength: 4,
        appUsage: [],
        screenTimeLimit: 180,
        currentScreenTime: 0,
        deviceLocked: false,
        cameraBlocked: false,
        micBlocked: false,
        preventAppInstall: false,
        preventDeviceLock: false,
        createdAt: Timestamp.now(),
      });
      created++;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        logMockDataNoticeOnce(
          'mutation-permission-denied:inject-children',
          'inject mock children skipped due to permission-denied.'
        );
        break;
      }
      throw error;
    }
  }

  const refreshed = await listChildrenByParent(parentId);
  const docs = refreshed.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);
  return { docs, created };
};

const ensureMockSupervisors = async (parentId: string, minCount: number) => {
  const snap = await listSupervisorsByParent(parentId);
  const mockDocs = snap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);

  let created = 0;
  const missing = Math.max(0, minCount - mockDocs.length);

  for (let i = 0; i < missing; i++) {
    const item = MOCK_SUPERVISORS[i % MOCK_SUPERVISORS.length];
    try {
      await addDoc(collection(db!, 'supervisors'), {
        ...item,
        parentId,
        role: 'SUPERVISOR',
        mockTag: MOCK_TAG,
        isMock: true,
        createdAt: Timestamp.now(),
      });
      created++;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        logMockDataNoticeOnce(
          'mutation-permission-denied:inject-supervisors',
          'inject mock supervisors skipped due to permission-denied.'
        );
        break;
      }
      throw error;
    }
  }

  return { created };
};

export const injectSelectedMockData = async (
  parentId: string,
  domains: MockDataDomain[]
): Promise<Record<MockDataDomain, number>> => {
  const ownerId = resolveMockOwnerId(parentId);
  if (!db || !ownerId) {
    return {
      children: 0,
      devices: 0,
      eventsAlerts: 0,
      timings: 0,
      supervisors: 0,
      psychPulse: 0,
      operations: 0,
    };
  }
  ensureMockOpsAllowed('inject mock data');

  const selected = new Set(domains);
  const result: Record<MockDataDomain, number> = {
    children: 0,
    devices: 0,
    eventsAlerts: 0,
    timings: 0,
    supervisors: 0,
    psychPulse: 0,
    operations: 0,
  };

  let mockChildren = (await ensureMockChildren(ownerId, selected.has('children') ? 2 : 0)).docs;
  result.children = selected.has('children') ? 0 : 0;

  if (selected.has('children')) {
    const ensure = await ensureMockChildren(ownerId, 2);
    mockChildren = ensure.docs;
    result.children = ensure.created;
  }

  const needsChildren = selected.has('devices') || selected.has('timings') || selected.has('psychPulse') || selected.has('eventsAlerts');
  if (needsChildren && mockChildren.length === 0) {
    const ensure = await ensureMockChildren(ownerId, 1);
    mockChildren = ensure.docs;
    result.children += ensure.created;
  }

  if (selected.has('devices')) {
    result.devices = await runMutationBatch(
      mockChildren.map(
        (childDoc: any, idx: number) => () =>
          updateDoc(doc(db, 'children', childDoc.id), {
            status: idx % 2 === 0 ? 'online' : 'offline',
            batteryLevel: 20 + (idx * 17) % 75,
            signalStrength: 1 + (idx % 4),
            deviceNickname: idx % 2 === 0 ? 'Android Mock' : 'iPhone Mock',
            deviceOwnerUid: `mock-device-${childDoc.id}`,
            appUsage: [
              {
                id: `mock-app-1-${idx}`,
                appName: 'TikTok',
                icon: 'MOCK',
                minutesUsed: 120 + idx * 10,
                isBlocked: false,
              },
              {
                id: `mock-app-2-${idx}`,
                appName: 'Discord',
                icon: 'MOCK',
                minutesUsed: 45 + idx * 8,
                isBlocked: idx % 2 === 0,
              },
            ],
          })
      ),
      'inject mock device fields'
    );
  }

  if (selected.has('timings')) {
    result.timings = await runMutationBatch(
      mockChildren.map(
        (childDoc: any, idx: number) => () =>
          updateDoc(doc(db, 'children', childDoc.id), {
            screenTimeLimit: 90 + idx * 30,
            currentScreenTime: 15 + idx * 10,
          })
      ),
      'inject mock timing fields'
    );
  }

  if (selected.has('psychPulse')) {
    result.psychPulse = await runMutationBatch(
      mockChildren.map(
        (childDoc: any) => () =>
          updateDoc(doc(db, 'children', childDoc.id), {
            psychProfile: createMockPsychProfile(),
          })
      ),
      'inject mock psych profile'
    );
  }

  if (selected.has('eventsAlerts')) {
    const alertMutations: Array<() => Promise<unknown>> = [];
    for (const childDoc of mockChildren) {
      const childName = String(childDoc.data()?.name || 'Mock Child');
      alertMutations.push(() =>
        addDoc(collection(db, 'alerts'), {
          parentId: ownerId,
          childName,
          platform: 'Instagram',
          content: 'Mock: potential bullying language detected in direct message.',
          category: Category.BULLYING,
          severity: AlertSeverity.HIGH,
          aiAnalysis: 'Mock analysis: repeated harmful language pattern.',
          status: 'NEW',
          mockTag: MOCK_TAG,
          isMock: true,
          timestamp: Timestamp.now(),
        })
      );
      alertMutations.push(() =>
        addDoc(collection(db, 'alerts'), {
          parentId: ownerId,
          childName,
          platform: 'Discord',
          content: 'Mock: direct threat intent detected.',
          category: Category.BLACKMAIL,
          severity: AlertSeverity.CRITICAL,
          aiAnalysis: 'Mock analysis: explicit threat keyword sequence.',
          status: 'NEW',
          mockTag: MOCK_TAG,
          isMock: true,
          timestamp: Timestamp.now(),
        })
      );
    }

    const activityMutations: Array<() => Promise<unknown>> = [
      () =>
        addDoc(collection(db, 'activities'), {
          parentId: ownerId,
          action: 'Mock Activity',
          details: 'Injected demo alerts/events package',
          type: 'SUCCESS',
          mockTag: MOCK_TAG,
          isMock: true,
          timestamp: Timestamp.now(),
        }),
      () =>
        addDoc(collection(db, 'activities'), {
          parentId: ownerId,
          action: 'Mock Sync',
          details: 'Device heartbeat timings randomized for test run',
          type: 'INFO',
          mockTag: MOCK_TAG,
          isMock: true,
          timestamp: Timestamp.now(),
        }),
    ];

    const createdAlerts = await runMutationBatch(alertMutations, 'inject mock alerts');
    const createdActivities = await runMutationBatch(activityMutations, 'inject mock activities');
    result.eventsAlerts = createdAlerts + createdActivities;
  }

  if (selected.has('supervisors')) {
    const ensure = await ensureMockSupervisors(ownerId, 2);
    result.supervisors = ensure.created;
  }

  if (selected.has('operations')) {
    try {
      const advanced = await injectAdvancedOperationalMockData(ownerId);
      result.operations = advanced.playbooks + advanced.custody + advanced.auditLogs;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        logMockDataNoticeOnce(
          'mutation-permission-denied:inject-operations',
          'inject advanced operations skipped due to permission-denied.'
        );
        result.operations = 0;
      } else {
        throw error;
      }
    }
  }

  return result;
};

export const clearSelectedMockData = async (
  parentId: string,
  domains: MockDataDomain[]
): Promise<Record<MockDataDomain, number>> => {
  const ownerId = resolveMockOwnerId(parentId);
  if (!db || !ownerId) {
    return {
      children: 0,
      devices: 0,
      eventsAlerts: 0,
      timings: 0,
      supervisors: 0,
      psychPulse: 0,
      operations: 0,
    };
  }
  ensureMockOpsAllowed('clear mock data');

  const selected = new Set(domains);
  const result: Record<MockDataDomain, number> = {
    children: 0,
    devices: 0,
    eventsAlerts: 0,
    timings: 0,
    supervisors: 0,
    psychPulse: 0,
    operations: 0,
  };

  const childrenSnap = await listChildrenByParent(ownerId);
  const mockChildren = childrenSnap.docs.filter((d: any) => isMockRecord(d.data?.()));

  if (selected.has('children')) {
    result.children = await runMutationBatch(
      mockChildren.map((d: any) => () => deleteDoc(doc(db, 'children', d.id))),
      'clear mock children'
    );
  } else {
    if (selected.has('devices')) {
      result.devices = await runMutationBatch(
        mockChildren.map(
          (d: any) => () =>
            updateDoc(doc(db, 'children', d.id), {
              deviceNickname: deleteField(),
              deviceOwnerUid: deleteField(),
              appUsage: [],
              batteryLevel: 100,
              signalStrength: 4,
              status: 'offline',
            })
        ),
        'clear mock device fields'
      );
    }

    if (selected.has('timings')) {
      result.timings = await runMutationBatch(
        mockChildren.map(
          (d: any) => () =>
            updateDoc(doc(db, 'children', d.id), {
              screenTimeLimit: 0,
              currentScreenTime: 0,
            })
        ),
        'clear mock timing fields'
      );
    }

    if (selected.has('psychPulse')) {
      result.psychPulse = await runMutationBatch(
        mockChildren.map(
          (d: any) => () =>
            updateDoc(doc(db, 'children', d.id), {
              psychProfile: deleteField(),
            })
        ),
        'clear mock psych profile'
      );
    }
  }

  if (selected.has('eventsAlerts')) {
    const alertsSnap = await listAlertsByParent(ownerId);
    const mockAlerts = alertsSnap.docs.filter((d: any) => isMockRecord(d.data?.()));
    const removedAlerts = await runMutationBatch(
      mockAlerts.map((d: any) => () => deleteDoc(doc(db, 'alerts', d.id))),
      'clear mock alerts'
    );

    const activitiesSnap = await listActivitiesByParent(ownerId);
    const mockActivities = activitiesSnap.docs.filter((d: any) => isMockRecord(d.data?.()));
    const removedActivities = await runMutationBatch(
      mockActivities.map((d: any) => () => deleteDoc(doc(db, 'activities', d.id))),
      'clear mock activities'
    );

    result.eventsAlerts = removedAlerts + removedActivities;
  }

  if (selected.has('supervisors')) {
    const supervisorsSnap = await listSupervisorsByParent(ownerId);
    const mockSup = supervisorsSnap.docs.filter((d: any) => isMockRecord(d.data?.()));
    result.supervisors = await runMutationBatch(
      mockSup.map((d: any) => () => deleteDoc(doc(db, 'supervisors', d.id))),
      'clear mock supervisors'
    );
  }

  if (selected.has('operations')) {
    let removed = 0;

    const playbookRef = doc(db, 'playbooks', ownerId);
    const playbookSnap = await safeGetDoc(playbookRef, 'read mock playbook');
    if (playbookSnap.exists() && isMockRecord(playbookSnap.data?.())) {
      try {
        await updateDoc(playbookRef, {
          mockTag: deleteField(),
          isMock: deleteField(),
          playbooks: deleteField(),
          updatedAt: deleteField(),
        });
        removed += 1;
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          logMockDataNoticeOnce(
            'mutation-permission-denied:clear-playbook',
            'clear playbook mock payload skipped due to permission-denied.'
          );
        } else {
          throw error;
        }
      }
    }

    const custodyQ = query(collection(db, 'custody'), where('parentId', '==', ownerId));
    const custodySnap = await safeGetDocs(custodyQ, 'list mock custody');
    const mockCustody = custodySnap.docs.filter((d: any) => isMockRecord(d.data?.()));
    removed += await runMutationBatch(
      mockCustody.map((d: any) => () => deleteDoc(doc(db, 'custody', d.id))),
      'clear mock custody'
    );

    const auditQ = query(collection(db, 'auditLogs'), where('parentId', '==', ownerId));
    const auditSnap = await safeGetDocs(auditQ, 'list mock audit logs');
    const mockAudit = auditSnap.docs.filter((d: any) => isMockRecord(d.data?.()));
    removed += await runMutationBatch(
      mockAudit.map((d: any) => () => deleteDoc(doc(db, 'auditLogs', d.id))),
      'clear mock audit logs'
    );

    result.operations = removed;
  }

  return result;
};

export const verifyMockDataCleanup = async (
  parentId: string,
  domains: MockDataDomain[] = [...MOCK_DATA_DOMAINS]
): Promise<MockDataVerificationReport> => {
  const ownerId = resolveMockOwnerId(parentId);
  const counts = buildEmptyDomainCounts();
  const selected = new Set(domains);
  const inaccessible = new Set<MockDataDomain>();

  if (!db || !ownerId) {
    return {
      counts,
      total: 0,
      clean: true,
      inaccessible: [],
      checkedAt: new Date().toISOString(),
    };
  }

  const markInaccessible = (domain: MockDataDomain) => {
    if (selected.has(domain)) inaccessible.add(domain);
  };

  const needsChildRead =
    selected.has('children') ||
    selected.has('devices') ||
    selected.has('timings') ||
    selected.has('psychPulse');

  if (needsChildRead) {
    const childQ = query(collection(db, 'children'), where('parentId', '==', ownerId));
    const childrenSnap = await safeGetDocsWithStatus(childQ, 'verify mock children');
    if (childrenSnap.denied) {
      markInaccessible('children');
      markInaccessible('devices');
      markInaccessible('timings');
      markInaccessible('psychPulse');
    } else {
      const mockChildren = childrenSnap.docs.filter((d: any) => isMockRecord(d.data?.()));
      if (selected.has('children')) counts.children = mockChildren.length;
      if (selected.has('devices')) counts.devices = mockChildren.length;
      if (selected.has('timings')) counts.timings = mockChildren.length;
      if (selected.has('psychPulse')) counts.psychPulse = mockChildren.length;
    }
  }

  if (selected.has('eventsAlerts')) {
    const alertsQ = query(collection(db, 'alerts'), where('parentId', '==', ownerId));
    const alertsSnap = await safeGetDocsWithStatus(alertsQ, 'verify mock alerts');

    const activitiesQ = query(collection(db, 'activities'), where('parentId', '==', ownerId));
    const activitiesSnap = await safeGetDocsWithStatus(activitiesQ, 'verify mock activities');

    if (alertsSnap.denied || activitiesSnap.denied) {
      markInaccessible('eventsAlerts');
    } else {
      const mockAlerts = alertsSnap.docs.filter((d: any) => isMockRecord(d.data?.())).length;
      const mockActivities = activitiesSnap.docs.filter((d: any) => isMockRecord(d.data?.())).length;
      counts.eventsAlerts = mockAlerts + mockActivities;
    }
  }

  if (selected.has('supervisors')) {
    const supervisorsQ = query(collection(db, 'supervisors'), where('parentId', '==', ownerId));
    const supervisorsSnap = await safeGetDocsWithStatus(supervisorsQ, 'verify mock supervisors');
    if (supervisorsSnap.denied) {
      markInaccessible('supervisors');
    } else {
      counts.supervisors = supervisorsSnap.docs.filter((d: any) => isMockRecord(d.data?.())).length;
    }
  }

  if (selected.has('operations')) {
    let operationsDenied = false;
    let operationsCount = 0;

    const playbookRef = doc(db, 'playbooks', ownerId);
    const playbookSnap = await safeGetDocWithStatus(playbookRef, 'verify mock playbook');
    if (playbookSnap.denied) {
      operationsDenied = true;
    } else if (playbookSnap.exists && isMockRecord(playbookSnap.data)) {
      operationsCount += 1;
    }

    const custodyQ = query(collection(db, 'custody'), where('parentId', '==', ownerId));
    const custodySnap = await safeGetDocsWithStatus(custodyQ, 'verify mock custody');
    if (custodySnap.denied) {
      operationsDenied = true;
    } else {
      operationsCount += custodySnap.docs.filter((d: any) => isMockRecord(d.data?.())).length;
    }

    const auditQ = query(collection(db, 'auditLogs'), where('parentId', '==', ownerId));
    const auditSnap = await safeGetDocsWithStatus(auditQ, 'verify mock audit logs');
    if (auditSnap.denied) {
      operationsDenied = true;
    } else {
      operationsCount += auditSnap.docs.filter((d: any) => isMockRecord(d.data?.())).length;
    }

    if (operationsDenied) {
      markInaccessible('operations');
    } else {
      counts.operations = operationsCount;
    }
  }

  const total = Object.values(counts).reduce((acc, n) => acc + n, 0);
  const inaccessibleDomains = Array.from(inaccessible);

  return {
    counts,
    total,
    clean: total === 0 && inaccessibleDomains.length === 0,
    inaccessible: inaccessibleDomains,
    checkedAt: new Date().toISOString(),
  };
};

/**
 * Legacy: inject comprehensive test suite
 */
export const injectMockSuite = async (parentId: string) => {
  ensureMockOpsAllowed('inject mock suite');
  await injectSelectedMockData(parentId, [...MOCK_DATA_DOMAINS]);
};

/**
 * Purge user data (legacy behavior)
 */
export const clearAllUserData = async (_parentId: string) => {
  throw new Error('clearAllUserData is disabled. Use clearSelectedMockData instead.');
};

/**
 * Legacy: randomize psych profile for all children
 */
export const randomizePsychProfiles = async (parentId: string) => {
  ensureMockOpsAllowed('randomize psych profiles');
  const ownerId = resolveMockOwnerId(parentId);
  if (!db || !ownerId) return;
  const q = query(collection(db, 'children'), where('parentId', '==', ownerId));
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(doc(db, 'children', d.id), {
        psychProfile: createMockPsychProfile(),
      })
    )
  );
};

/**
 * Advanced operational mock package used by recovered modules (playbooks/audit/custody).
 * This function is intentionally separate from domain toggles to avoid breaking current UI.
 */
export const injectAdvancedOperationalMockData = async (parentId: string): Promise<{
  playbooks: number;
  custody: number;
  auditLogs: number;
}> => {
  ensureMockOpsAllowed('inject advanced operational mock data');
  const ownerId = resolveMockOwnerId(parentId);
  if (!db || !ownerId) return { playbooks: 0, custody: 0, auditLogs: 0 };

  const playbookDocRef = doc(db, 'playbooks', ownerId);
  await updateDoc(playbookDocRef, {
    parentId: ownerId,
    mockTag: MOCK_TAG,
    updatedAt: Timestamp.now(),
    playbooks: [
      {
        id: 'mock-pb-bullying',
        name: 'درع التنمر',
        category: Category.BULLYING,
        minSeverity: AlertSeverity.HIGH,
        enabled: true,
        actions: [
          { id: 'a1', type: 'LOCK_DEVICE', isEnabled: true },
          { id: 'a5', type: 'LOCKSCREEN_BLACKOUT', isEnabled: true },
          { id: 'a2', type: 'NOTIFY_PARENTS', isEnabled: true },
        ],
      },
      {
        id: 'mock-pb-threat',
        name: 'بروتوكول التهديد المباشر',
        category: Category.BLACKMAIL,
        minSeverity: AlertSeverity.CRITICAL,
        enabled: true,
        actions: [
          { id: 'a3', type: 'SIREN', isEnabled: true },
          { id: 'a6', type: 'WALKIE_TALKIE_ENABLE', isEnabled: true },
          { id: 'a4', type: 'BLOCK_APP', isEnabled: true },
        ],
      },
    ],
  }).catch(async () => {
    await setDoc(playbookDocRef, {
      parentId: ownerId,
      mockTag: MOCK_TAG,
      updatedAt: Timestamp.now(),
      playbooks: [
        {
          id: 'mock-pb-bullying',
          name: 'درع التنمر',
          category: Category.BULLYING,
          minSeverity: AlertSeverity.HIGH,
          enabled: true,
          actions: [
            { id: 'a1', type: 'LOCK_DEVICE', isEnabled: true },
            { id: 'a5', type: 'LOCKSCREEN_BLACKOUT', isEnabled: true },
            { id: 'a2', type: 'NOTIFY_PARENTS', isEnabled: true },
          ],
        },
      ],
    });
  });

  const custodyRef = await addDoc(collection(db, 'custody'), {
    parentId: ownerId,
    mockTag: MOCK_TAG,
    incident_id: 'mock-incident-1',
    evidence_id: 'mock-evidence-1',
    actor: 'SYSTEM:AMANAH',
    action: 'CREATE',
    event_key: 'MOCK_EVIDENCE_CAPTURED',
    created_at: new Date().toISOString(),
    hash_hex: 'mockhash-1',
    prev_hash_hex: 'GENESIS_BLOCK',
    createdAt: Timestamp.now(),
  });

  const auditRef = await addDoc(collection(db, 'auditLogs'), {
    parentId: ownerId,
    mockTag: MOCK_TAG,
    command_id: 'mock-cmd-1',
    child_id: 'mock-child-1',
    command_type: 'lockDevice',
    status: 'done',
    created_at: new Date().toISOString(),
    createdAt: Timestamp.now(),
  });

  return {
    playbooks: 1,
    custody: custodyRef?.id ? 1 : 0,
    auditLogs: auditRef?.id ? 1 : 0,
  };
};
