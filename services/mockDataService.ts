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
    name: 'Ø³Ø§Ø±Ø© - ØªØ¬Ø±ÙŠØ¨ÙŠ',
    age: 12,
    avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png',
  },
  {
    name: 'Ø¹Ù…Ø± - ØªØ¬Ø±ÙŠØ¨ÙŠ',
    age: 15,
    avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
  },
];

const MOCK_SUPERVISORS = [
  {
    name: 'Ù…Ø´Ø±Ù ØªØ¬Ø±ÙŠØ¨ÙŠ 1',
    email: 'mock.supervisor1@amanah.local',
    avatar:
      'https://img.freepik.com/premium-vector/hijab-woman-avatar-illustration-vector-woman-hijab-profile-icon_671746-348.jpg',
  },
  {
    name: 'Ù…Ø´Ø±Ù ØªØ¬Ø±ÙŠØ¨ÙŠ 2',
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
    keywords: ['ØªÙ†Ù…Ø±', 'ØªØ¹Ù„ÙŠÙ‚Ø§Øª Ø¬Ø§Ø±Ø­Ø©', 'Ø¹Ø²Ù„Ø©'],
    recommendation:
      'Ø§Ø¨Ø¯Ø£ Ø­ÙˆØ§Ø±Ù‹Ø§ Ø¯Ø§Ø¹Ù…Ù‹Ø§ Ø¨Ù„Ø§ Ù„ÙˆÙ…ØŒ Ø«Ù… ÙØ¹Ù‘Ù„ Ø§Ù„Ø­Ø¸Ø± ÙˆØ§Ù„Ø¥Ø¨Ù„Ø§Øº Ù…Ø¹ Ù…ØªØ§Ø¨Ø¹Ø© Ù†ÙØ³ÙŠØ© Ù‚ØµÙŠØ±Ø© Ø®Ù„Ø§Ù„ 72 Ø³Ø§Ø¹Ø©.',
    signals: [
      {
        title: 'Ù…Ø¤Ø´Ø± Ù…Ø¶Ø§ÙŠÙ‚Ø§Øª Ø±Ù‚Ù…ÙŠØ©',
        severity: AlertSeverity.HIGH,
        reason: 'Ø±Ø³Ø§Ø¦Ù„ Ø³Ù„Ø¨ÙŠØ© Ù…ØªÙƒØ±Ø±Ø© Ù…Ø¹ Ø­Ø°Ù Ø³Ø±ÙŠØ¹ Ù„Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª.',
        suggestedAction: 'ØªÙˆØ«ÙŠÙ‚ Ø§Ù„Ø£Ø¯Ù„Ø© + ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ø®ØµÙˆØµÙŠØ© + ØªÙˆØ§ØµÙ„ Ù…Ø¯Ø±Ø³ÙŠ Ø¥Ø°Ø§ Ù„Ø²Ù….',
      },
      {
        title: 'ØªØ±Ø§Ø¬Ø¹ ÙÙŠ Ø§Ù„Ø«Ù‚Ø©',
        severity: AlertSeverity.MEDIUM,
        reason: 'Ø§Ù†Ø®ÙØ§Ø¶ Ù…Ù„Ø­ÙˆØ¸ ÙÙŠ Ø§Ù„ØªÙØ§Ø¹Ù„ Ø¨Ø¹Ø¯ Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù….',
        suggestedAction: 'Ø¬Ù„Ø³Ø© Ø­ÙˆØ§Ø± ÙŠÙˆÙ…ÙŠØ© Ù‚ØµÙŠØ±Ø© Ù…Ø¹ ØªØ¹Ø²ÙŠØ² Ø§Ù„Ø¯Ø¹Ù… Ø§Ù„Ø£Ø³Ø±ÙŠ.',
      },
    ],
  },
  {
    id: 'threat_exposure',
    keywords: ['ØªÙ‡Ø¯ÙŠØ¯', 'Ø§Ø¨ØªØ²Ø§Ø²', 'Ø®ÙˆÙ'],
    recommendation:
      'ÙØ¹Ù‘Ù„ Ø®Ø·Ø© 10 Ø¯Ù‚Ø§Ø¦Ù‚: Ù„Ø§ ØªÙØ§ÙˆØ¶ØŒ Ù„Ø§ Ø¯ÙØ¹ØŒ Ø­ÙØ¸ Ø§Ù„Ø£Ø¯Ù„Ø©ØŒ ØªØ£Ù…ÙŠÙ† Ø§Ù„Ø­Ø³Ø§Ø¨ØŒ Ø«Ù… Ø§Ù„Ø¥Ø¨Ù„Ø§Øº Ø§Ù„Ø±Ø³Ù…ÙŠ.',
    signals: [
      {
        title: 'Ø§Ø­ØªÙ…Ø§Ù„ Ø§Ø¨ØªØ²Ø§Ø² Ù…Ø¨Ø§Ø´Ø±',
        severity: AlertSeverity.CRITICAL,
        reason: 'Ù…ÙØ±Ø¯Ø§Øª ØªÙ‡Ø¯ÙŠØ¯ ÙˆØ§Ø¶Ø­Ø© Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø·Ù„Ø¨ Ù…Ø§Ù„ÙŠ/ØµÙˆØ±.',
        suggestedAction: 'Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„ØªÙˆØ§ØµÙ„ ÙÙˆØ±Ù‹Ø§ + Ø­Ù…Ø§ÙŠØ© Ø§Ù„Ø­Ø³Ø§Ø¨ + ØªØµØ¹ÙŠØ¯ Ù‚Ø§Ù†ÙˆÙ†ÙŠ.',
      },
      {
        title: 'Ù‚Ù„Ù‚ Ø­Ø§Ø¯ Ø¹Ù†Ø¯ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª',
        severity: AlertSeverity.HIGH,
        reason: 'Ø§Ø³ØªØ¬Ø§Ø¨Ø© Ø®ÙˆÙ Ù…ØªÙƒØ±Ø±Ø© Ù…Ù† Ø¬Ù‡Ø© ØªÙˆØ§ØµÙ„ Ø¨Ø¹ÙŠÙ†Ù‡Ø§.',
        suggestedAction: 'Ø­Ø¸Ø± ÙÙˆØ±ÙŠ ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© Ø£Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø².',
      },
    ],
  },
  {
    id: 'gaming',
    keywords: ['Ø³Ù‡Ø±', 'Ø¥Ø¯Ù…Ø§Ù†', 'Ù„Ø¹Ø¨'],
    recommendation:
      'Ø§Ø¹ØªÙ…Ø¯ ØªØ¯Ø®Ù„Ù‹Ø§ ØªØ¯Ø±ÙŠØ¬ÙŠÙ‹Ø§ 4 Ø£Ø³Ø§Ø¨ÙŠØ¹: Ø¶Ø¨Ø· Ø§Ù„Ù†ÙˆÙ…ØŒ Ø®ÙØ¶ Ø§Ù„ÙˆÙ‚ØªØŒ Ù…ÙƒØ§ÙØ¢Øª Ø§Ù„ØªØ²Ø§Ù…ØŒ ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© Ø£Ø³Ø¨ÙˆØ¹ÙŠØ©.',
    signals: [
      {
        title: 'Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù„ÙŠÙ„ÙŠ Ù…ÙØ±Ø·',
        severity: AlertSeverity.HIGH,
        reason: 'ØªÙ…Ø¯Ø¯ Ø§Ù„Ù„Ø¹Ø¨ Ø¨Ø¹Ø¯ Ù…Ù†ØªØµÙ Ø§Ù„Ù„ÙŠÙ„ Ø¨Ø´ÙƒÙ„ Ù…ØªÙƒØ±Ø±.',
        suggestedAction: 'ØªÙØ¹ÙŠÙ„ Bedtime + Ù‚ÙÙ„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ.',
      },
      {
        title: 'ØªÙˆØªØ± Ø¹Ù†Ø¯ Ø§Ù„Ø¥ÙŠÙ‚Ø§Ù',
        severity: AlertSeverity.MEDIUM,
        reason: 'Ø¹ØµØ¨ÙŠØ© ÙˆØ§Ø¶Ø­Ø© Ø¹Ù†Ø¯ Ø§Ù†ØªÙ‡Ø§Ø¡ Ù…Ø¯Ø© Ø§Ù„Ù„Ø¹Ø¨.',
        suggestedAction: 'Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ© Ø®ÙØ¶ ØªØ¯Ø±ÙŠØ¬ÙŠ Ø¨Ø¯Ù„ Ø§Ù„Ù…Ù†Ø¹ Ø§Ù„Ù…ÙØ§Ø¬Ø¦.',
      },
    ],
  },
  {
    id: 'inappropriate_content',
    keywords: ['Ù…Ø­ØªÙˆÙ‰ ØµØ§Ø¯Ù…', 'Ø¥Ø¨Ø§Ø­ÙŠØ©', 'ÙØ¶ÙˆÙ„'],
    recommendation:
      'Ø´Ø¯Ø¯ Ø§Ù„ÙÙ„ØªØ±Ø© Ø­Ø³Ø¨ Ø§Ù„Ø¹Ù…Ø±ØŒ ÙˆØ£Ø¶Ù Ø­ÙˆØ§Ø±Ù‹Ø§ Ø¢Ù…Ù†Ù‹Ø§: Ø£ØºÙ„Ù‚ ÙˆØ¨Ù„Ù‘Øº Ø¯ÙˆÙ† Ø¹Ù‚ÙˆØ¨Ø© Ø£Ùˆ ØªØ®ÙˆÙŠÙ.',
    signals: [
      {
        title: 'Ù…Ø­Ø§ÙˆÙ„Ø§Øª ÙˆØµÙˆÙ„ Ù„Ù…Ø­ØªÙˆÙ‰ Ù…Ø­Ø¬ÙˆØ¨',
        severity: AlertSeverity.HIGH,
        reason: 'ØªÙƒØ±Ø§Ø± ÙˆØµÙˆÙ„ Ù„ØªØµÙ†ÙŠÙØ§Øª ØºÙŠØ± Ù…Ù†Ø§Ø³Ø¨Ø© Ù„Ù„Ø¹Ù…Ø±.',
        suggestedAction: 'ØªÙ‚ÙˆÙŠØ© SafeSearch ÙˆÙÙ„ØªØ±Ø© DNS ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù…ØªØµÙØ­.',
      },
      {
        title: 'Ø§Ø³ØªØ®Ø¯Ø§Ù… ØªØµÙØ­ Ø®ÙÙŠ Ù…ØªÙƒØ±Ø±',
        severity: AlertSeverity.MEDIUM,
        reason: 'ØªÙ†Ù‚Ù„ Ù…ÙƒØ«Ù Ø¨ÙŠÙ† Ø±ÙˆØ§Ø¨Ø· Ø®Ø§Ø±Ø¬ÙŠØ© ØºÙŠØ± Ù…ÙˆØ«ÙˆÙ‚Ø©.',
        suggestedAction: 'Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆØªÙØ¹ÙŠÙ„ Ù‚ÙŠÙˆØ¯ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø¢Ù…Ù†.',
      },
    ],
  },
  {
    id: 'cyber_crime',
    keywords: ['Ø§Ø®ØªØ±Ø§Ù‚', 'Ø³ÙƒØ±Ø¨Øª', 'ØªØ¬Ø§ÙˆØ²'],
    recommendation:
      'Ø­ÙˆÙ‘Ù„ Ø§Ù„ÙØ¶ÙˆÙ„ Ø§Ù„ØªÙ‚Ù†ÙŠ Ø¥Ù„Ù‰ Ù…Ø³Ø§Ø± Ù‚Ø§Ù†ÙˆÙ†ÙŠ (ØªØ¹Ù„Ù… Ø£Ù…Ù†ÙŠ Ø£Ø®Ù„Ø§Ù‚ÙŠ) Ù…Ø¹ ØªÙˆØ¶ÙŠØ­ Ø§Ù„Ø¹ÙˆØ§Ù‚Ø¨ Ø§Ù„Ø¬Ù†Ø§Ø¦ÙŠØ©.',
    signals: [
      {
        title: 'Ù…ÙŠÙ„ Ø³Ù„ÙˆÙƒÙŠ Ù‡Ø¬ÙˆÙ…ÙŠ',
        severity: AlertSeverity.HIGH,
        reason: 'Ø§Ù‡ØªÙ…Ø§Ù… Ù…ØªÙƒØ±Ø± Ø¨Ø£Ø¯ÙˆØ§Øª ØªØ¹Ø·ÙŠÙ„/Ø§Ø®ØªØ±Ø§Ù‚.',
        suggestedAction: 'Ù…Ù†Ø¹ Ø§Ù„Ø£Ø¯ÙˆØ§Øª Ø§Ù„Ù…Ø¬Ù‡ÙˆÙ„Ø© + ØªÙˆØ¬ÙŠÙ‡ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù‚Ø§Ù†ÙˆÙ†ÙŠ.',
      },
      {
        title: 'Ø¥Ø®ÙØ§Ø¡ Ø§Ù„Ù‡ÙˆÙŠØ© Ø§Ù„Ù…ÙØ±Ø·',
        severity: AlertSeverity.MEDIUM,
        reason: 'Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù‚Ù†ÙˆØ§Øª Ø¥Ø®ÙØ§Ø¡ Ø¯ÙˆÙ† Ù…Ø¨Ø±Ø± ÙˆØ§Ø¶Ø­.',
        suggestedAction: 'Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… ÙˆØªØ¹Ø±ÙŠÙ Ø§Ù„Ø­Ø¯ÙˆØ¯ Ø§Ù„Ù‚Ø§Ù†ÙˆÙ†ÙŠØ©.',
      },
    ],
  },
  {
    id: 'crypto_scams',
    keywords: ['Ø±Ø¨Ø­ Ø³Ø±ÙŠØ¹', 'ØªØ­ÙˆÙŠÙ„', 'Ù‚Ù†ÙˆØ§Øª Ø§Ø³ØªØ«Ù…Ø§Ø±'],
    recommendation:
      'ÙØ¹Ù‘Ù„ Ù…Ø±Ø§Ø¬Ø¹Ø© Ø£Ø³Ø±ÙŠØ© Ù„Ø£ÙŠ Ù…Ø¹Ø§Ù…Ù„Ø© Ù…Ø§Ù„ÙŠØ© Ø±Ù‚Ù…ÙŠØ©ØŒ ÙˆØ§Ù…Ù†Ø¹ Ø§Ù„Ù‚Ù†ÙˆØ§Øª ØºÙŠØ± Ø§Ù„Ù…ÙˆØ«ÙˆÙ‚Ø© ÙÙˆØ±Ù‹Ø§.',
    signals: [
      {
        title: 'Ø§Ù†Ø¯ÙØ§Ø¹ Ù…Ø§Ù„ÙŠ Ø¹Ø§Ù„ÙŠ Ø§Ù„Ù…Ø®Ø§Ø·Ø±Ø©',
        severity: AlertSeverity.HIGH,
        reason: 'Ù…Ø­Ø§ÙˆÙ„Ø§Øª ØªØ­ÙˆÙŠÙ„ Ù…ØªÙƒØ±Ø±Ø© Ù„Ø¬Ù‡Ø§Øª Ù…Ø¬Ù‡ÙˆÙ„Ø©.',
        suggestedAction: 'ØªØ¹Ø·ÙŠÙ„ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª ØºÙŠØ± Ø§Ù„Ù…Ø¹ØªÙ…Ø¯Ø© ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© ÙˆÙ„ÙŠ Ø§Ù„Ø£Ù…Ø±.',
      },
      {
        title: 'ØªØ£Ø«Ø± Ø¨ØªÙˆØµÙŠØ§Øª Ù…Ø¶Ù„Ù„Ø©',
        severity: AlertSeverity.MEDIUM,
        reason: 'ØªÙØ§Ø¹Ù„ Ù…Ø¹ Ù‚Ù†ÙˆØ§Øª ØªØ¹Ø¯ Ø¨Ø£Ø±Ø¨Ø§Ø­ Ù…Ø¶Ù…ÙˆÙ†Ø©.',
        suggestedAction: 'ØªÙˆØ¹ÙŠØ© Ù…Ø§Ù„ÙŠØ© Ø£Ø³Ø§Ø³ÙŠØ© ÙˆØ­Ø¸Ø± Ø§Ù„Ù…ØµØ§Ø¯Ø± Ø§Ù„Ø§Ø­ØªÙŠØ§Ù„ÙŠØ©.',
      },
    ],
  },
  {
    id: 'phishing_links',
    keywords: ['ØªØµÙŠØ¯', 'Ø±Ø§Ø¨Ø· Ù…Ø´Ø¨ÙˆÙ‡', 'otp', 'phishing'],
    recommendation:
      'ÙØ¹Ù‘Ù„ Ø®Ø·Ø© Ù…Ø¶Ø§Ø¯ Ø§Ù„ØªØµÙŠØ¯ ÙÙˆØ±Ø§Ù‹: Ø¹Ø²Ù„ Ø§Ù„Ø±ÙˆØ§Ø¨Ø·ØŒ ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø§Øª Ø§Ù„Ù…Ø±ÙˆØ±ØŒ ØªÙØ¹ÙŠÙ„ Ø§Ù„Ù…ØµØ§Ø¯Ù‚Ø© Ø§Ù„Ø«Ù†Ø§Ø¦ÙŠØ© (2FA)ØŒ ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© Ø¬Ù„Ø³Ø§Øª Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø§Ù„Ù†Ø´Ø·Ø©.',
    signals: [
      {
        title: 'Ø±Ø§Ø¨Ø· ØªØµÙŠØ¯ Ù†Ø´Ø·',
        severity: AlertSeverity.CRITICAL,
        reason: 'ØªÙ… Ø±ØµØ¯ Ø±Ø§Ø¨Ø· Ù…Ø®ØªØµØ± ÙŠØ·Ù„Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª Ø¯Ø®ÙˆÙ„ Ø£Ùˆ Ø±Ù…Ø² ØªØ­Ù‚Ù‚.',
        suggestedAction: 'Ù…Ù†Ø¹ Ø§Ù„Ø±Ø§Ø¨Ø· + ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± + ØºÙ„Ù‚ Ø§Ù„Ø¬Ù„Ø³Ø§Øª + Ø¥Ø¨Ù„Ø§Øº Ø§Ù„Ù…Ù†ØµØ©.',
      },
      {
        title: 'Ù…Ø¤Ø´Ø±Ø§Øª Ø³Ø±Ù‚Ø© Ø­Ø³Ø§Ø¨',
        severity: AlertSeverity.HIGH,
        reason: 'Ø·Ù„Ø¨Ø§Øª Ù…ØªÙƒØ±Ø±Ø© Ù„Ø±Ù…ÙˆØ² OTP Ø£Ùˆ ØµÙØ­Ø§Øª Ø¯Ø®ÙˆÙ„ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙØ©.',
        suggestedAction: 'ØªÙØ¹ÙŠÙ„ Ø§Ù„Ù…ØµØ§Ø¯Ù‚Ø© Ø§Ù„Ø«Ù†Ø§Ø¦ÙŠØ© (2FA) ÙˆØªØ¯Ù‚ÙŠÙ‚ Ø£Ø¬Ù‡Ø²Ø© ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ ÙÙˆØ±Ø§Ù‹.',
      },
    ],
  },
];

const createMockPsychProfile = () => {
  const emotions = ['Ù‡Ø§Ø¯Ø¦', 'Ù‚Ù„Ù‚', 'Ù…ØªÙˆØªØ±', 'Ù…Ù†Ø¹Ø²Ù„', 'Ø³Ø¹ÙŠØ¯'];
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
      { label: 'Ø§Ù„Ø¥Ø«Ù†ÙŠÙ†', value: 48 + Math.floor(Math.random() * 40) },
      { label: 'Ø§Ù„Ø«Ù„Ø§Ø«Ø§Ø¡', value: 45 + Math.floor(Math.random() * 42) },
      { label: 'Ø§Ù„Ø£Ø±Ø¨Ø¹Ø§Ø¡', value: 50 + Math.floor(Math.random() * 38) },
      { label: 'Ø§Ù„Ø®Ù…ÙŠØ³', value: 52 + Math.floor(Math.random() * 35) },
      { label: 'Ø§Ù„Ø¬Ù…Ø¹Ø©', value: 47 + Math.floor(Math.random() * 43) },
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
  const mockChildren = childrenSnap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);

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
    const mockAlerts = alertsSnap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);
    const removedAlerts = await runMutationBatch(
      mockAlerts.map((d: any) => () => deleteDoc(doc(db, 'alerts', d.id))),
      'clear mock alerts'
    );

    const activitiesSnap = await listActivitiesByParent(ownerId);
    const mockActivities = activitiesSnap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);
    const removedActivities = await runMutationBatch(
      mockActivities.map((d: any) => () => deleteDoc(doc(db, 'activities', d.id))),
      'clear mock activities'
    );

    result.eventsAlerts = removedAlerts + removedActivities;
  }

  if (selected.has('supervisors')) {
    const supervisorsSnap = await listSupervisorsByParent(ownerId);
    const mockSup = supervisorsSnap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);
    result.supervisors = await runMutationBatch(
      mockSup.map((d: any) => () => deleteDoc(doc(db, 'supervisors', d.id))),
      'clear mock supervisors'
    );
  }

  if (selected.has('operations')) {
    let removed = 0;

    const playbookRef = doc(db, 'playbooks', ownerId);
    const playbookSnap = await safeGetDoc(playbookRef, 'read mock playbook');
    if (playbookSnap.exists() && playbookSnap.data()?.mockTag === MOCK_TAG) {
      try {
        await updateDoc(playbookRef, {
          mockTag: deleteField(),
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
    const mockCustody = custodySnap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);
    removed += await runMutationBatch(
      mockCustody.map((d: any) => () => deleteDoc(doc(db, 'custody', d.id))),
      'clear mock custody'
    );

    const auditQ = query(collection(db, 'auditLogs'), where('parentId', '==', ownerId));
    const auditSnap = await safeGetDocs(auditQ, 'list mock audit logs');
    const mockAudit = auditSnap.docs.filter((d: any) => d.data()?.mockTag === MOCK_TAG);
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
        name: 'Ø¯Ø±Ø¹ Ø§Ù„ØªÙ†Ù…Ø±',
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
        name: 'Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„ Ø§Ù„ØªÙ‡Ø¯ÙŠØ¯ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±',
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
          name: 'Ø¯Ø±Ø¹ Ø§Ù„ØªÙ†Ù…Ø±',
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

