/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { getApps, initializeApp } from 'firebase/app';
import {
  ActionCodeSettings,
  ApplicationVerifier,
  Auth,
  PhoneAuthProvider,
  getAuth,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
import { auth, canUseMockData, db } from './firebaseConfig';
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
  ParentMessage,
  ChildSignalEvent,
} from '../types';
import { ValidationService } from './validationService';
import { isLockCommand, isLockEnableRequest } from './lockCommandPolicy';

export type ContactVerificationChannel = 'email' | 'phone';
export type ContactVerificationDelivery =
  | 'EMAIL_LINK'
  | 'PASSWORD_RESET'
  | 'CUSTOM_EMAIL'
  | 'FIREBASE_PHONE_AUTH'
  | 'SMS_GATEWAY'
  | 'DEV_FALLBACK';

export interface ContactVerificationDispatch {
  channel: ContactVerificationChannel;
  target: string;
  code: string;
  verificationId?: string;
  sentAt: number;
  expiresAt: number;
  delivery: ContactVerificationDelivery;
}

export interface ContactVerificationOptions {
  phoneAppVerifier?: ApplicationVerifier;
}

const CHILDREN_COLLECTION = 'children';
const PARENTS_COLLECTION = 'parents';
const ALERTS_COLLECTION = 'alerts';
const ACTIVITIES_COLLECTION = 'activities';
const SUPERVISORS_COLLECTION = 'supervisors';
const PLAYBOOKS_COLLECTION = 'playbooks';
const CUSTODY_COLLECTION = 'custody';
const AUDIT_LOGS_COLLECTION = 'auditLogs';
const SYSTEM_PATCHES_COLLECTION = 'systemPatches';
const CHILD_SIGNAL_EVENTS_COLLECTION = 'childSignalEvents';
const PSYCH_FORECAST_SNAPSHOTS_COLLECTION = 'psychForecastSnapshots';
const PAIRING_REQUESTS_SUBCOLLECTION = 'pairingRequests';
const PAIRING_KEYS_COLLECTION = 'pairingKeys';
const PARENT_MESSAGES_COLLECTION = 'parentMessages';

export interface PsychForecastSnapshotInput {
  childId: string;
  childIds?: string[];
  childName: string;
  generatedAt: string;
  sevenDayTop?: {
    scenarioId: string;
    riskScore: number;
    probability: number;
    confidence: number;
    trend: 'rising' | 'stable' | 'cooling';
    explanationAr: string;
    explanationEn: string;
  };
  thirtyDayTop?: {
    scenarioId: string;
    riskScore: number;
    probability: number;
    confidence: number;
    trend: 'rising' | 'stable' | 'cooling';
    explanationAr: string;
    explanationEn: string;
  };
  contextSummary: {
    analyzedMessages: number;
    analyzedAlerts: number;
    recencyWeight: number;
    escalationIndex: number;
    pressureIndex: number;
    repeatedTerms: string[];
    topPatternIds: string[];
  };
  sourceCoverage?: {
    sourceCount: number;
    depthScore: number;
    counts: Record<string, number>;
    topDriversEn: string[];
  };
}

/** Retry helper with exponential backoff for transient network failures */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 1000
): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const code = String(error?.code || '');
      const isRetryable =
        code === 'auth/network-request-failed' ||
        code === 'auth/too-many-requests' ||
        code === 'auth/internal-error';
      if (!isRetryable || attempt === maxRetries) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Retry exhausted');
};

const isLocalInviteHost = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;

  try {
    const parsed = new URL(normalized.includes('://') ? normalized : `https://${normalized}`);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    );
  } catch {
    return (
      normalized.includes('localhost') ||
      normalized.includes('127.0.0.1') ||
      normalized.includes('::1')
    );
  }
};

const ensureTrailingSlash = (value: string): string => (value.endsWith('/') ? value : `${value}/`);

const appendVerificationCodeToContinueUrl = (
  code: string,
  channel: ContactVerificationChannel
): string => {
  const base = resolveCoParentInviteContinueUrl();
  try {
    const url = new URL(base);
    url.searchParams.set('vc', code);
    url.searchParams.set('vch', channel);
    url.searchParams.set('purpose', 'profile_contact_update');
    return url.toString();
  } catch {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}vc=${encodeURIComponent(code)}&vch=${encodeURIComponent(channel)}&purpose=profile_contact_update`;
  }
};

const resolveCoParentInviteContinueUrl = (): string => {
  const envUrl = String(import.meta.env.VITE_CO_PARENT_INVITE_CONTINUE_URL || '').trim();
  if (envUrl && !isLocalInviteHost(envUrl)) {
    return ensureTrailingSlash(envUrl);
  }

  if (typeof window !== 'undefined' && window.location?.origin && !isLocalInviteHost(window.location.origin)) {
    return ensureTrailingSlash(window.location.origin);
  }

  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  if (authDomain && !isLocalInviteHost(authDomain)) {
    return ensureTrailingSlash(`https://${authDomain}`);
  }

  return 'https://amanah-protect.firebaseapp.com/';
};

const mapInviteEmailError = (error: any): string => {
  const code = String(error?.code || '');
  switch (code) {
    case 'auth/invalid-email':
      return 'عنوان البريد الإلكتروني غير صالح. | Invalid invitation email address.';
    case 'auth/operation-not-allowed':
      return 'مزود المصادقة المطلوب معطّل في Firebase. | Auth provider disabled in Firebase.';
    case 'auth/unauthorized-continue-uri':
      return 'رابط الدعوة غير مُصرّح به في إعدادات Firebase. | Invite URL not authorized.';
    case 'auth/quota-exceeded':
      return 'تم تجاوز حصة البريد. حاول لاحقًا. | Email quota exceeded.';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة جدًا. حاول لاحقًا. | Too many attempts, try later.';
    case 'auth/network-request-failed':
      return 'خطأ في الشبكة أثناء إرسال الدعوة. | Network error sending invitation.';
    default:
      return error?.message || 'فشل إرسال الدعوة. | Failed to send invitation email.';
  }
};

const isEmailLinkDisabledError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'auth/operation-not-allowed' || message.includes('email-link sign-in is disabled');
};

const generateInviteTempPassword = (): string => {
  const rand = Math.random().toString(36).slice(2);
  const stamp = Date.now().toString(36);
  return `Ama!${rand}${stamp}#`;
};

const ensureEmailPasswordAccountForInvite = async (email: string): Promise<void> => {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing Firebase API key for invite fallback.');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: generateInviteTempPassword(),
        returnSecureToken: false,
      }),
    }
  );

  if (response.ok) return;

  const payload = await response.json().catch(() => ({}));
  const remoteCode = String(payload?.error?.message || '');

  if (remoteCode === 'EMAIL_EXISTS') return;
  if (remoteCode === 'OPERATION_NOT_ALLOWED') {
    throw new Error('Email/password sign-in is disabled in Firebase Auth.');
  }
  if (remoteCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
    throw new Error('Too many auth attempts. Please try again later.');
  }

  throw new Error(`Failed to prepare invitation account (${remoteCode || response.status}).`);
};

const sendPasswordResetInviteEmail = async (email: string): Promise<void> => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized.');
  }

  await ensureEmailPasswordAccountForInvite(email);

  const actionCodeSettings: ActionCodeSettings = {
    url: resolveCoParentInviteContinueUrl(),
    handleCodeInApp: false,
  };

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  } catch (error: any) {
    throw new Error(mapInviteEmailError(error));
  }
};

const resolveEmailWebhookUrl = (): string => {
  return String(import.meta.env.VITE_EMAIL_INVITATION_WEBHOOK_URL || '').trim();
};

const resolveEmailWebhookToken = (): string => {
  return String(import.meta.env.VITE_EMAIL_INVITATION_WEBHOOK_TOKEN || '').trim();
};

const sendViaEmailWebhook = async (
  email: string,
  inviterName?: string
): Promise<void> => {
  const webhookUrl = resolveEmailWebhookUrl();
  if (!webhookUrl) throw new Error('Email webhook URL not configured.');

  const token = resolveEmailWebhookToken();
  const appUrl = resolveCoParentInviteContinueUrl();

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email, inviterName: inviterName || '', appUrl }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Email webhook error (${response.status})`);
  }
};

const sendCoParentInvitationEmail = async (
  email: string,
  inviterName?: string
): Promise<'EMAIL_LINK' | 'PASSWORD_RESET' | 'CUSTOM_EMAIL'> => {
  // Try custom email webhook first (avoids spam issues with Firebase emails)
  const webhookUrl = resolveEmailWebhookUrl();
  if (webhookUrl) {
    try {
      await sendViaEmailWebhook(email, inviterName);
      return 'CUSTOM_EMAIL';
    } catch (webhookError: any) {
      console.warn('[invite] Email webhook failed, falling back to Firebase:', webhookError?.message);
    }
  }

  // Fallback: Firebase email methods
  if (!auth) {
    throw new Error('Firebase Auth is not initialized.');
  }

  const actionCodeSettings: ActionCodeSettings = {
    url: resolveCoParentInviteContinueUrl(),
    handleCodeInApp: true,
  };

  try {
    await retryWithBackoff(() => sendSignInLinkToEmail(auth, email, actionCodeSettings));
    return 'EMAIL_LINK';
  } catch (error: any) {
    if (isEmailLinkDisabledError(error)) {
      await sendPasswordResetInviteEmail(email);
      return 'PASSWORD_RESET';
    }
    throw new Error(mapInviteEmailError(error));
  }
};

const resolveConfiguredSmsVerificationWebhook = (): string => {
  return String(import.meta.env.VITE_SMS_VERIFICATION_WEBHOOK_URL || '').trim();
};

const resolveSmsVerificationWebhook = (): string => {
  const configured = resolveConfiguredSmsVerificationWebhook();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const host = String(window.location?.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return 'http://localhost:8787/sms/verification';
    }
  }

  return '';
};

const resolveSmsVerificationToken = (): string => {
  return String(import.meta.env.VITE_SMS_VERIFICATION_WEBHOOK_TOKEN || '').trim();
};

const shouldPreferSmsGatewayBeforeFirebase = (): boolean => {
  const raw = String(import.meta.env.VITE_PHONE_VERIFICATION_PREFER_GATEWAY || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

const resolveSmsTextbeltKey = (): string => {
  return String(import.meta.env.VITE_SMS_TEXTBELT_KEY || '').trim();
};

const PHONE_VERIFICATION_APP_NAME = 'amanah-phone-verification';

const resolveFirebaseClientConfig = () => {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const appId = String(import.meta.env.VITE_FIREBASE_APP_ID || '').trim();
  const storageBucket = String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
  const messagingSenderId = String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error('Firebase client config is incomplete for phone verification.');
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket,
    messagingSenderId,
  };
};

const getPhoneVerificationAuth = (): Auth => {
  const existing = getApps().find((app) => app.name === PHONE_VERIFICATION_APP_NAME);
  const phoneApp = existing || initializeApp(resolveFirebaseClientConfig(), PHONE_VERIFICATION_APP_NAME);
  return getAuth(phoneApp);
};

export const getFirebasePhoneVerificationAuth = (): Auth => {
  return getPhoneVerificationAuth();
};

const mapPhoneVerificationError = (error: any): string => {
  const code = String(error?.code || '');
  switch (code) {
    case 'auth/billing-not-enabled':
      return 'Firebase SMS requires billing. Configure a fallback SMS gateway (webhook/Textbelt) to send real messages without upgrading Firebase.';
    case 'auth/invalid-app-credential':
      return 'Invalid app credential for Firebase Phone Auth. Verify Authorized domains (localhost/127.0.0.1), API key referrer restrictions, and that your Web app Firebase config belongs to this project.';
    case 'auth/unauthorized-domain':
      return 'Current domain is not authorized in Firebase Auth. Add this domain in Authentication > Settings > Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Phone provider is disabled in Firebase Auth. Enable Phone in Sign-in method.';
    case 'auth/invalid-phone-number':
      return 'Invalid phone number format.';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA verification failed. Retry and complete the challenge.';
    case 'auth/too-many-requests':
      return 'Too many SMS attempts. Please wait and try again later.';
    case 'auth/quota-exceeded':
      return 'Firebase SMS quota exceeded. Try again later.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Auth.';
    default:
      return error?.message || 'Failed to send/verify phone code with Firebase.';
  }
};

export const isSmsVerificationGatewayConfigured = (): boolean => {
  return Boolean(resolveSmsVerificationWebhook() || resolveSmsTextbeltKey());
};

const normalizePhoneForVerification = (phone: string): string => {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return '';
  // Keep only leading + and digits to avoid format mismatches.
  return trimmed.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
};

const generateVerificationCode = (): string => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const sendEmailVerificationCodeMessage = async (
  email: string,
  code: string
): Promise<'EMAIL_LINK' | 'PASSWORD_RESET'> => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized.');
  }

  const continueUrl = appendVerificationCodeToContinueUrl(code, 'email');
  const signInLinkSettings: ActionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, email, signInLinkSettings);
    return 'EMAIL_LINK';
  } catch (error: any) {
    if (!isEmailLinkDisabledError(error)) {
      throw new Error(mapInviteEmailError(error));
    }
  }

  await ensureEmailPasswordAccountForInvite(email);

  const resetSettings: ActionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: false,
  };
  try {
    await sendPasswordResetEmail(auth, email, resetSettings);
    return 'PASSWORD_RESET';
  } catch (error: any) {
    throw new Error(mapInviteEmailError(error));
  }
};

const sendPhoneVerificationCodeViaTextbelt = async (
  phone: string,
  code: string
): Promise<void> => {
  const textbeltKey = resolveSmsTextbeltKey();
  if (!textbeltKey) {
    throw new Error('Textbelt key is not configured.');
  }

  const message = `Amanah verification code: ${code}. Valid for 10 minutes.`;
  const body = new URLSearchParams({
    phone,
    message,
    key: textbeltKey,
  });

  const response = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: body.toString(),
  });

  const raw = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    const details = String(payload?.error || payload?.message || raw || `HTTP ${response.status}`).trim();
    throw new Error(`Textbelt SMS provider rejected the request. ${details}`);
  }
};

const sendPhoneVerificationCodeMessage = async (
  phone: string,
  code: string
): Promise<'SMS_GATEWAY' | 'DEV_FALLBACK'> => {
  const providerErrors: string[] = [];

  const configuredWebhook = resolveConfiguredSmsVerificationWebhook();
  const webhook = resolveSmsVerificationWebhook();
  const isImplicitLocalDefaultWebhook =
    !configuredWebhook && webhook === 'http://localhost:8787/sms/verification';
  if (webhook) {
    try {
      const token = resolveSmsVerificationToken();
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phone,
          code,
          purpose: 'parent_profile_update',
          ttlSeconds: 600,
        }),
      });

      if (!response.ok) {
        const payload = await response.text().catch(() => '');
        if (isImplicitLocalDefaultWebhook) {
          console.warn(
            '[Amanah][DEV_SMS] local default webhook returned non-OK; falling back to development code.',
            { status: response.status, payload }
          );
          throw new Error('IMPLICIT_LOCAL_WEBHOOK_NON_OK');
        }
        throw new Error(`Webhook status ${response.status}. ${payload}`);
      }

      return 'SMS_GATEWAY';
    } catch (error: any) {
      if (String(error?.message || '') === 'IMPLICIT_LOCAL_WEBHOOK_NON_OK') {
        // Keep providerErrors empty so flow can continue to DEV_FALLBACK.
      } else if (isImplicitLocalDefaultWebhook) {
        console.warn(
          '[Amanah][DEV_SMS] local default webhook unreachable; falling back to development code.',
          error
        );
        // Keep providerErrors empty so flow can continue to DEV_FALLBACK.
      } else {
        const message = String(error?.message || 'request failed');
        const normalized = message.toLowerCase();
        if (
          webhook === 'http://localhost:8787/sms/verification' &&
          (normalized.includes('failed to fetch') || normalized.includes('network'))
        ) {
          providerErrors.push('Webhook: local SMS webhook is unreachable. Start it with `npm run sms:webhook`.');
        } else if (
          normalized.includes('free sms are disabled for this country') ||
          normalized.includes('textbelt rejected request')
        ) {
          providerErrors.push(
            'Webhook: Textbelt free key is blocked for this country. Use a paid Textbelt key or switch webhook provider to `android_gateway`.'
          );
        } else {
          providerErrors.push(`Webhook: ${message}`);
        }
      }
    }
  }

  const textbeltKey = resolveSmsTextbeltKey();
  if (textbeltKey) {
    try {
      await sendPhoneVerificationCodeViaTextbelt(phone, code);
      return 'SMS_GATEWAY';
    } catch (error: any) {
      providerErrors.push(`Textbelt: ${String(error?.message || 'request failed')}`);
    }
  }

  if (providerErrors.length > 0) {
    throw new Error(`SMS provider request failed. ${providerErrors.join(' | ')}`);
  }

  // Development-safe fallback when no SMS provider endpoint exists.
  console.warn(`[Amanah][DEV_SMS] verification code for ${phone}: ${code}`);
  return 'DEV_FALLBACK';
};

const sendPhoneVerificationCodeViaFirebase = async (
  phone: string,
  appVerifier: ApplicationVerifier
): Promise<string> => {
  try {
    const verificationAuth = getPhoneVerificationAuth();
    const confirmation = await signInWithPhoneNumber(verificationAuth, phone, appVerifier);
    return confirmation.verificationId;
  } catch (error: any) {
    const mapped = new Error(mapPhoneVerificationError(error));
    (mapped as any).firebaseCode = String(error?.code || '');
    throw mapped;
  }
};

export const verifyPhoneCodeWithFirebase = async (
  verificationId: string,
  code: string
): Promise<void> => {
  if (!verificationId) {
    throw new Error('Missing verification session. Send SMS code first.');
  }
  try {
    const verificationAuth = getPhoneVerificationAuth();
    const credential = PhoneAuthProvider.credential(verificationId, code);
    await signInWithCredential(verificationAuth, credential);
    await signOut(verificationAuth).catch(() => undefined);
  } catch (error: any) {
    throw new Error(mapPhoneVerificationError(error));
  }
};

const shouldFallbackFromFirebaseSmsError = (error: any): boolean => {
  const code = String(error?.firebaseCode || error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const isLocalRuntime = (() => {
    if (typeof window === 'undefined') return false;
    const host = String(window.location?.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  })();

  if (code === 'auth/invalid-phone-number') {
    return false;
  }

  // During local development, let invalid app/domain credentials fall back
  // to configured SMS gateway or DEV code instead of hard failing the flow.
  if (
    isLocalRuntime &&
    (code === 'auth/invalid-app-credential' ||
      code === 'auth/unauthorized-domain' ||
      message.includes('invalid app credential') ||
      message.includes('unauthorized-domain'))
  ) {
    return true;
  }

  return (
    code === 'auth/billing-not-enabled' ||
    code === 'auth/operation-not-allowed' ||
    code === 'auth/captcha-check-failed' ||
    code === 'auth/too-many-requests' ||
    code === 'auth/quota-exceeded' ||
    code === 'auth/network-request-failed' ||
    message.includes('billing-not-enabled') ||
    message.includes('quota') ||
    message.includes('too many') ||
    message.includes('captcha') ||
    message.includes('network')
  );
};

export const sendProfileContactVerificationCode = async (
  channel: ContactVerificationChannel,
  target: string,
  options?: ContactVerificationOptions
): Promise<ContactVerificationDispatch> => {
  const sentAt = Date.now();
  const expiresAt = sentAt + 10 * 60 * 1000;
  const code = generateVerificationCode();

  if (channel === 'email') {
    const email = String(target || '').trim().toLowerCase();
    if (!ValidationService.isValidEmail(email)) {
      throw new Error('Invalid email format for verification.');
    }
    const delivery = await sendEmailVerificationCodeMessage(email, code);
    return {
      channel,
      target: email,
      code,
      sentAt,
      expiresAt,
      delivery,
    };
  }

  const phone = normalizePhoneForVerification(target);
  if (!ValidationService.isValidPhoneNumber(phone)) {
    throw new Error('Invalid phone format for verification.');
  }

  const preferGatewayBeforeFirebase = shouldPreferSmsGatewayBeforeFirebase();

  if (options?.phoneAppVerifier && !preferGatewayBeforeFirebase) {
    try {
      const verificationId = await sendPhoneVerificationCodeViaFirebase(phone, options.phoneAppVerifier);
      return {
        channel,
        target: phone,
        code: '',
        verificationId,
        sentAt,
        expiresAt,
        delivery: 'FIREBASE_PHONE_AUTH',
      };
    } catch (error: any) {
      if (!shouldFallbackFromFirebaseSmsError(error)) {
        throw error;
      }
      console.warn('[Amanah][PHONE_SMS] Firebase SMS unavailable, trying fallback provider.', error);
    }
  }

  const delivery = await sendPhoneVerificationCodeMessage(phone, code);
  return {
    channel,
    target: phone,
    code,
    sentAt,
    expiresAt,
    delivery,
  };
};

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
 * Deep data sanitizer to avoid circular references and normalize timestamp-like values.
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

const isIndexRequiredError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return (
    code === 'failed-precondition' ||
    message.includes('requires an index') ||
    message.includes('The query requires an index')
  );
};

const isMockTaggedData = (data: any): boolean =>
  data?.mockTag === 'AMANAH_FAKE_DATA' || data?.isMock === true;

const shouldExcludeMockData = (data: any): boolean => !canUseMockData() && isMockTaggedData(data);

const claimChildDeviceOwnership = async (childId: string, authUid: string): Promise<boolean> => {
  if (!db || !childId || !authUid) return false;
  const childRef = doc(db, CHILDREN_COLLECTION, childId);
  try {
    await updateDoc(childRef, { deviceOwnerUid: authUid });
    return true;
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.warn('Unexpected error while attempting child ownership claim:', error);
    }
    return false;
  }
};

const resolvePlaybookOwnerId = (parentId: string): string | undefined => {
  const authUid = auth?.currentUser?.uid;
  if (!authUid) return undefined;
  if (!parentId) return authUid;
  return authUid;
};

const LOCK_COMMAND_CACHE_TTL_MS = 10_000;

let lockBypassCache: {
  uid: string;
  value: boolean;
  expiresAt: number;
} | null = null;

const buildLockBypassValue = (command: string, value: any): any => {
  if (command === 'lockDevice') return false;
  const payload =
    value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  return {
    ...payload,
    enabled: false,
    message: '',
    source: 'global_lock_bypass',
  };
};

const resolveGlobalLockBypass = async (): Promise<boolean> => {
  if (!db) return false;
  const authUid = auth?.currentUser?.uid;
  if (!authUid) return false;

  const now = Date.now();
  if (
    lockBypassCache &&
    lockBypassCache.uid === authUid &&
    lockBypassCache.expiresAt > now
  ) {
    return lockBypassCache.value;
  }

  try {
    const parentSnap = await getDoc(doc(db, PARENTS_COLLECTION, authUid));
    const enabledFeatures = (parentSnap.data() as any)?.enabledFeatures || {};
    const allLocksDisabledUntilTs = Number(enabledFeatures?.allLocksDisabledUntil || 0);
    const isBypassed =
      enabledFeatures?.allLocksDisabledPermanently === true ||
      allLocksDisabledUntilTs > now;

    lockBypassCache = {
      uid: authUid,
      value: isBypassed,
      expiresAt: now + LOCK_COMMAND_CACHE_TTL_MS,
    };
    return isBypassed;
  } catch (error) {
    console.warn('Failed to resolve lock bypass settings; fallback to normal lock behavior.', error);
    return false;
  }
};

const touchesGlobalLockBypassSettings = (updates: any): boolean =>
  !!updates &&
  (Object.prototype.hasOwnProperty.call(updates, 'enabledFeatures.allLocksDisabledPermanently') ||
    Object.prototype.hasOwnProperty.call(updates, 'enabledFeatures.allLocksDisabledUntil'));

/**
 * Send remote command to child device
 * Phase 1.3: Added childId validation to prevent command injection
 */
export const sendRemoteCommand = async (childId: string, command: string, value: any = true) => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Phase 1.3: Verify authenticated user
  const authUid = auth?.currentUser?.uid;
  if (!authUid) {
    throw new Error('Not authenticated. Please log in first.');
  }

  // Validate childId to prevent path traversal and command injection
  validateDocumentId(childId, 'childId');

  // Phase 1 Security: IDOR protection with legacy-safe ownership claim fallback.
  // Some legacy child docs were linked without deviceOwnerUid and may block read before claim.
  const childRef = doc(db, CHILDREN_COLLECTION, childId);
  let ownershipVerified = false;
  let childData: any = null;
  try {
    const childSnap = await getDoc(childRef);
    if (!childSnap.exists()) {
      throw new Error('Child device not found.');
    }
    childData = childSnap.data() as any;
    const isOwner = childData.parentId === authUid || childData.deviceOwnerUid === authUid;
    if (isOwner) {
      ownershipVerified = true;
    } else if (!childData.deviceOwnerUid) {
      ownershipVerified = await claimChildDeviceOwnership(childId, authUid);
    }
  } catch (error: any) {
    if (isPermissionDeniedError(error)) {
      ownershipVerified = await claimChildDeviceOwnership(childId, authUid);
    } else {
      throw error;
    }
  }
  if (!ownershipVerified) {
    throw new Error('Access denied. You do not have permission to control this device.');
  }

  let commandValue = value;
  if (isLockCommand(command) && isLockEnableRequest(command, commandValue)) {
    // Per-child preventDeviceLock guard: if the child has this flag set,
    // convert any lock-enable command to an unlock command instead.
    if (childData?.preventDeviceLock === true) {
      console.warn(`[Amanah] Lock command blocked for child ${childId}: preventDeviceLock is active.`);
      commandValue = buildLockBypassValue(command, commandValue);
    } else {
      const lockBypassEnabled = await resolveGlobalLockBypass();
      if (lockBypassEnabled) {
        commandValue = buildLockBypassValue(command, commandValue);
      }
    }
  }

  // Phase 3.2: Validate command payload
  const validation = ValidationService.validateCommand(command, commandValue);
  if (!validation.valid) {
    console.error(`Command Validation Failed: ${validation.error}`);
    throw new Error(validation.error);
  }

  const commandPatch = {
    [`commands.${command}`]: {
      value: commandValue,
      timestamp: Timestamp.now(),
      status: 'PENDING',
    },
  };
  const legacyCommandPatch = {
    [`commands.${command}`]: {
      value: commandValue,
      timestamp: Timestamp.now(),
    },
  };

  try {
    await updateDoc(childRef, commandPatch);
  } catch (error: any) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }
    const claimed = await claimChildDeviceOwnership(childId, authUid);
    if (!claimed) {
      // Last compatibility attempt for older rules that reject extra fields (like status).
      await updateDoc(childRef, legacyCommandPatch);
      return;
    }
    try {
      await updateDoc(childRef, commandPatch);
    } catch (retryError: any) {
      if (!isPermissionDeniedError(retryError)) {
        throw retryError;
      }
      await updateDoc(childRef, legacyCommandPatch);
    }
  }
};

/**
 * Generate a cryptographically secure pairing key.
 * Uses crypto.getRandomValues for unpredictable output.
 * Format: 12-character alphanumeric (62^12 ~= 3.2x10^21 combinations)
 */
const generateSecurePairingKey = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const keyLength = 12;
  const randomBytes = crypto.getRandomValues(new Uint8Array(keyLength));
  let key = '';
  for (let i = 0; i < keyLength; i++) {
    key += alphabet[randomBytes[i] % alphabet.length];
  }
  return key;
};

export const rotatePairingKey = async (parentId: string): Promise<string> => {
  if (!db || !parentId) throw new Error('Database not initialized or invalid parentId');
  const authUid = auth?.currentUser?.uid;
  if (!authUid) {
    throw new Error('Not authenticated');
  }
  const ownerId = authUid;

  // Rate limiting: prevent rapid key rotation (max 1 per 30 seconds)
  const parentRef = doc(db, PARENTS_COLLECTION, ownerId);
  const parentSnap = await getDoc(parentRef);
  if (parentSnap.exists()) {
    const data = parentSnap.data() as any;
    const lastRotation = data.pairingKeyRotatedAt?.toMillis?.() || 0;
    if (Date.now() - lastRotation < 30_000) {
      throw new Error('يرجى الانتظار 30 ثانية قبل تجديد مفتاح الاقتران. | Please wait 30 seconds before rotating the pairing key.');
    }
  }

  // Generate 12-char cryptographically secure key
  const newKey = generateSecurePairingKey();
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Update parent profile (for reference)
  await setDoc(parentRef, {
    pairingKey: newKey,
    pairingKeyExpiresAt: expiresAt,
    pairingKeyRotatedAt: Timestamp.now(),
  }, { merge: true });

  // Create a look-up document where the KEY is the ID
  const keyRef = doc(db, PAIRING_KEYS_COLLECTION, newKey);
  await setDoc(keyRef, {
    parentId: ownerId,
    expiresAt,
    createdAt: Timestamp.now(),
    attempts: 0,
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
  // Fetch latest 100 alerts ordered by newest first.
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
      const alerts = snapshot.docs
        .map((d) => {
          const rawData = d.data();
          if (shouldExcludeMockData(rawData)) return null;
          return {
            id: d.id,
            ...sanitizeData(rawData),
            timestamp: rawData.timestamp?.toDate() || new Date(),
          } as MonitoringAlert;
        })
        .filter(Boolean) as MonitoringAlert[];
      callback(alerts);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        console.warn('Firestore Alerts Error (permission denied):', err);
        callback([]);
        return;
      }
      if (!isIndexRequiredError(err)) {
        console.warn('Firestore Alerts Error:', err);
      }
      // Fallback: use simple query (no orderBy) and sort in client to survive index outages.
      const simpleQ = query(collection(db, ALERTS_COLLECTION), where('parentId', '==', parentId));
      unsubscribe = onSnapshot(
        simpleQ,
        (snap) => {
          const fallbackAlerts = snap.docs
            .map((d) => {
              const raw = d.data();
              if (shouldExcludeMockData(raw)) return null;
              return { id: d.id, ...sanitizeData(raw) } as any;
            })
            .filter(Boolean)
            .sort(
              (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          callback(fallbackAlerts);
        },
        (fallbackErr) => {
          if (isPermissionDeniedError(fallbackErr)) {
            console.warn('Firestore Alerts fallback denied by rules:', fallbackErr);
          } else {
            console.warn('Firestore Alerts fallback failed:', fallbackErr);
          }
          callback([]);
        }
      );
    }
  );

  return () => unsubscribe();
};

export const saveChildSignalEventToDB = async (
  parentId: string,
  event: Partial<ChildSignalEvent>
): Promise<string | null> => {
  if (!db || !parentId) return null;
  const content = String(event.content || '').trim();
  const eventType = String(event.eventType || '').trim();
  const source = String(event.source || '').trim();
  if (!content || !eventType || !source) return null;

  try {
    const payload = {
      ...event,
      parentId,
      eventType,
      source,
      content: content.slice(0, 3000),
      normalizedContent: String(event.normalizedContent || '').slice(0, 3000),
      timestamp: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, CHILD_SIGNAL_EVENTS_COLLECTION), payload);
    return docRef.id;
  } catch (error) {
    console.warn('Failed to save child signal event:', error);
    return null;
  }
};

export const subscribeToChildSignalEvents = (
  parentId: string,
  callback: (events: ChildSignalEvent[]) => void
) => {
  if (!db || !parentId) return () => { };

  const q = query(
    collection(db, CHILD_SIGNAL_EVENTS_COLLECTION),
    where('parentId', '==', parentId),
    orderBy('timestamp', 'desc'),
    limit(300)
  );

  let unsubscribe: () => void = () => { };

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const events = snapshot.docs
        .map((d) => {
          const rawData = d.data();
          if (shouldExcludeMockData(rawData)) return null;
          return {
            id: d.id,
            ...sanitizeData(rawData),
            timestamp: rawData.timestamp?.toDate?.() || new Date(),
          } as ChildSignalEvent;
        })
        .filter(Boolean) as ChildSignalEvent[];
      callback(events);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        console.warn('Firestore child signal events denied by rules:', err);
        callback([]);
        return;
      }
      if (!isIndexRequiredError(err)) {
        console.warn('Firestore child signal events error:', err);
      }
      const simpleQ = query(
        collection(db, CHILD_SIGNAL_EVENTS_COLLECTION),
        where('parentId', '==', parentId)
      );
      unsubscribe = onSnapshot(
        simpleQ,
        (snap) => {
          const fallbackEvents = snap.docs
            .map((d) => {
              const raw = d.data();
              if (shouldExcludeMockData(raw)) return null;
              return {
                id: d.id,
                ...sanitizeData(raw),
                timestamp: raw.timestamp?.toDate?.() || new Date(raw.timestamp || Date.now()),
              } as ChildSignalEvent;
            })
            .filter((event): event is ChildSignalEvent => event !== null)
            .sort(
              (a: ChildSignalEvent, b: ChildSignalEvent) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          callback(fallbackEvents);
        },
        (fallbackErr) => {
          if (isPermissionDeniedError(fallbackErr)) {
            console.warn('Firestore child signal events fallback denied by rules:', fallbackErr);
          } else {
            console.warn('Firestore child signal events fallback failed:', fallbackErr);
          }
          callback([]);
        }
      );
    }
  );

  return () => unsubscribe();
};

export const subscribeToChildren = (parentId: string, callback: (children: Child[]) => void) => {
  if (!db || !parentId) return () => { };
  const q = query(collection(db, CHILDREN_COLLECTION), where('parentId', '==', parentId));
  return onSnapshot(q, (snapshot) => {
    const children = snapshot.docs
      .map(
        (d) => {
          const raw = d.data();
          if (shouldExcludeMockData(raw)) return null;
          return {
            id: d.id,
            ...sanitizeData(raw),
          } as Child;
        }
      )
      .filter(Boolean) as Child[];
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
      dnsFiltering: {
        value: { enabled: false, mode: 'family', domains: [] },
        timestamp: Timestamp.now(),
      },
      syncOfflineUnlockConfig: {
        value: false,
        timestamp: Timestamp.now(),
      },
      runVulnerabilityScan: {
        value: false,
        timestamp: Timestamp.now(),
      },
      setVisualThresholds: {
        value: false,
        timestamp: Timestamp.now(),
      },
      setTextRuleThresholds: {
        value: false,
        timestamp: Timestamp.now(),
      },
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
  if (!db) {
    throw new Error('Database not initialized');
  }
  if (!id) {
    throw new Error('Member id is required');
  }
  const collectionName =
    role === 'CHILD'
      ? CHILDREN_COLLECTION
      : role === 'SUPERVISOR'
        ? SUPERVISORS_COLLECTION
        : PARENTS_COLLECTION;
  const ref = doc(db, collectionName, id);
  try {
    await updateDoc(ref, updates);
  } catch (error: any) {
    const authUid = auth?.currentUser?.uid;
    const canRetryWithClaim =
      collectionName === CHILDREN_COLLECTION && !!authUid && isPermissionDeniedError(error);
    if (!canRetryWithClaim) {
      throw error;
    }
    const claimed = await claimChildDeviceOwnership(id, authUid as string);
    if (!claimed) {
      throw error;
    }
    await updateDoc(ref, updates);
  }

  // Ensure lock command guard picks up setting changes immediately.
  const authUid = auth?.currentUser?.uid;
  if (collectionName === PARENTS_COLLECTION && authUid && id === authUid && touchesGlobalLockBypassSettings(updates)) {
    lockBypassCache = null;
  }
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
  const inviteEmail = String(data?.email || '').trim().toLowerCase();

  if (!ValidationService.isValidEmail(inviteEmail)) {
    throw new Error('Invalid invitation email.');
  }

  // Send a real email invitation first. If this fails, do not create a misleading local record.
  const inviterName = String(data?.inviterName || data?.name || '').trim();
  const inviteMethod = await sendCoParentInvitationEmail(inviteEmail, inviterName);

  const payload = {
    ...data,
    email: inviteEmail,
    parentId,
    role: 'SUPERVISOR',
    inviteStatus: 'EMAIL_SENT',
    inviteMethod,
    inviteSentAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, SUPERVISORS_COLLECTION), payload);
  return { id: docRef.id, ...payload } as FamilyMember;
};

export const deleteAlertFromDB = async (alertId: string): Promise<void> => {
  if (!db) return;
  // Phase 1 Security: Validate alertId format
  validateDocumentId(alertId, 'alertId');
  await deleteDoc(doc(db, ALERTS_COLLECTION, alertId));
};

export const updateAlertStatus = async (alertId: string, status: string): Promise<void> => {
  if (!db) return;
  // Phase 1 Security: Validate alertId format
  validateDocumentId(alertId, 'alertId');
  // Whitelist allowed status values
  const allowedStatuses = ['NEW', 'OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED'];
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid alert status: ${status}`);
  }
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
  if (!db) {
    throw new Error('Database not initialized');
  }
  const ownerId = resolvePlaybookOwnerId(parentId);
  if (!ownerId) {
    throw new Error('Not authenticated');
  }

  const ref = doc(db, PLAYBOOKS_COLLECTION, ownerId);
  const sanitizedPlaybooks = ValidationService.sanitizeInput(playbooks);
  try {
    await setDoc(
      ref,
      {
        parentId: ownerId,
        playbooks: sanitizedPlaybooks,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return;
  } catch (error: any) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }
  }

  // Fallback for projects that still use only /parents/{uid} write rules.
  const parentRef = doc(db, PARENTS_COLLECTION, ownerId);
  await setDoc(
    parentRef,
    {
      safetyPlaybooks: sanitizedPlaybooks,
      safetyPlaybooksUpdatedAt: Timestamp.now(),
    },
    { merge: true }
  ).catch((error: any) => {
    if (isPermissionDeniedError(error)) {
      throw new Error('Permission denied while saving playbooks');
    }
    throw error;
  });
};

export const fetchPlaybooks = async (parentId: string): Promise<SafetyPlaybook[]> => {
  if (!db) return [];
  const ownerId = resolvePlaybookOwnerId(parentId);
  if (!ownerId) return [];

  const ref = doc(db, PLAYBOOKS_COLLECTION, ownerId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Legacy fallback storage path inside parent document.
      const parentSnap = await getDoc(doc(db, PARENTS_COLLECTION, ownerId));
      if (!parentSnap.exists()) return [];
      const parentData = sanitizeData(parentSnap.data());
      return Array.isArray((parentData as any).safetyPlaybooks)
        ? ((parentData as any).safetyPlaybooks as SafetyPlaybook[])
        : [];
    }
    const data = sanitizeData(snap.data());
    return Array.isArray((data as any).playbooks) ? ((data as any).playbooks as SafetyPlaybook[]) : [];
  } catch (error: any) {
    if (isPermissionDeniedError(error)) {
      try {
        const parentSnap = await getDoc(doc(db, PARENTS_COLLECTION, ownerId));
        if (!parentSnap.exists()) return [];
        const parentData = sanitizeData(parentSnap.data());
        return Array.isArray((parentData as any).safetyPlaybooks)
          ? ((parentData as any).safetyPlaybooks as SafetyPlaybook[])
          : [];
      } catch {
        return [];
      }
    }
    console.warn('fetchPlaybooks failed, using default playbooks fallback:', error);
    return [];
  }
};

export const subscribeToPlaybooks = (
  parentId: string,
  callback: (playbooks: SafetyPlaybook[]) => void
) => {
  if (!db) return () => { };
  const ownerId = resolvePlaybookOwnerId(parentId);
  if (!ownerId) return () => { };

  const ref = doc(db, PLAYBOOKS_COLLECTION, ownerId);
  let unsubscribeFallback: (() => void) | null = null;
  const unsubscribePrimary = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // If canonical doc does not exist, try legacy parent-field fallback once.
        void getDoc(doc(db, PARENTS_COLLECTION, ownerId))
          .then((parentSnap) => {
            if (!parentSnap.exists()) {
              callback([]);
              return;
            }
            const parentData = sanitizeData(parentSnap.data());
            callback(
              Array.isArray((parentData as any).safetyPlaybooks)
                ? ((parentData as any).safetyPlaybooks as SafetyPlaybook[])
                : []
            );
          })
          .catch(() => callback([]));
        return;
      }
      const data = sanitizeData(snap.data());
      callback(Array.isArray((data as any).playbooks) ? ((data as any).playbooks as SafetyPlaybook[]) : []);
    },
    (error) => {
      if (isPermissionDeniedError(error)) {
        if (!unsubscribeFallback) {
          const parentRef = doc(db, PARENTS_COLLECTION, ownerId);
          unsubscribeFallback = onSnapshot(
            parentRef,
            (parentSnap) => {
              if (!parentSnap.exists()) {
                callback([]);
                return;
              }
              const parentData = sanitizeData(parentSnap.data());
              callback(
                Array.isArray((parentData as any).safetyPlaybooks)
                  ? ((parentData as any).safetyPlaybooks as SafetyPlaybook[])
                  : []
              );
            },
            () => callback([])
          );
        }
        return;
      }
      callback([]);
    }
  );
  return () => {
    unsubscribePrimary();
    if (unsubscribeFallback) unsubscribeFallback();
  };
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
  if (!db || !parentId) return () => { };
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

export const savePsychForecastSnapshot = async (
  parentId: string,
  payload: PsychForecastSnapshotInput
): Promise<string | null> => {
  if (!db || !parentId || !payload?.childId) return null;

  try {
    const snapshotPayload = sanitizeData(payload);
    const sevenDayRisk = Number(payload.sevenDayTop?.riskScore || 0);
    const thirtyDayRisk = Number(payload.thirtyDayTop?.riskScore || 0);
    const maxRisk = Math.max(sevenDayRisk, thirtyDayRisk);
    if (!Number.isFinite(maxRisk) || maxRisk < 35) {
      return null;
    }

    const generatedAtTs = new Date(payload.generatedAt || Date.now());
    const generatedAt = Number.isFinite(generatedAtTs.getTime()) ? Timestamp.fromDate(generatedAtTs) : Timestamp.now();

    const row = {
      parentId,
      childId: String(payload.childId || ''),
      childIds: Array.isArray(payload.childIds) ? payload.childIds.slice(0, 20) : [],
      childName: String(payload.childName || ''),
      topScenario7d: payload.sevenDayTop?.scenarioId || null,
      topRisk7d: sevenDayRisk,
      topScenario30d: payload.thirtyDayTop?.scenarioId || null,
      topRisk30d: thirtyDayRisk,
      trend7d: payload.sevenDayTop?.trend || null,
      trend30d: payload.thirtyDayTop?.trend || null,
      pressureIndex: Number(payload.contextSummary?.pressureIndex || 0),
      escalationIndex: Number(payload.contextSummary?.escalationIndex || 0),
      recencyWeight: Number(payload.contextSummary?.recencyWeight || 0),
      sourceCount: Number(payload.sourceCoverage?.sourceCount || 0),
      sourceDepthScore: Number(payload.sourceCoverage?.depthScore || 0),
      sourceTopDrivers: Array.isArray(payload.sourceCoverage?.topDriversEn)
        ? payload.sourceCoverage?.topDriversEn.slice(0, 10)
        : [],
      generatedAt,
      createdAt: Timestamp.now(),
      source: 'psych_forecast_v1',
      payload: snapshotPayload,
    };

    const docRef = await addDoc(collection(db, PSYCH_FORECAST_SNAPSHOTS_COLLECTION), row);
    return docRef.id;
  } catch (error) {
    console.error('Failed to save psych forecast snapshot:', error);
    return null;
  }
};

// SOS Emergency Alert

export const sendSOSAlert = async (
  parentId: string,
  childId: string,
  childName: string,
): Promise<string | null> => {
  if (!db || !parentId || !childId) return null;
  try {
    const payload = {
      parentId,
      childId,
      childName: sanitizeData({ n: childName }).n,
      type: 'SOS',
      severity: 'CRITICAL',
      category: 'SOS',
      content: `${childName} أرسل نداء طوارئ`,
      aiAnalysis: 'SOS Emergency - Child initiated distress signal',
      confidence: 100,
      timestamp: Timestamp.now(),
      status: 'OPEN',
    };
    const docRef = await addDoc(collection(db, ALERTS_COLLECTION), payload);
    return docRef.id;
  } catch (err) {
    console.error('Failed to send SOS alert:', err);
    return null;
  }
};

// Parent Messages

export const sendParentMessage = async (
  familyId: string,
  childId: string,
  senderId: string,
  senderName: string,
  message: string,
): Promise<string | null> => {
  if (!db || !familyId || !childId || !message.trim()) return null;
  try {
    const payload = {
      familyId,
      childId,
      senderId,
      senderName: sanitizeData({ n: senderName }).n,
      message: sanitizeData({ m: message.trim() }).m,
      timestamp: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, PARENT_MESSAGES_COLLECTION), payload);
    return docRef.id;
  } catch (err) {
    console.error('Failed to send parent message:', err);
    return null;
  }
};

export const subscribeToParentMessages = (
  childId: string,
  callback: (messages: ParentMessage[]) => void,
) => {
  if (!db || !childId) {
    callback([]);
    return () => { };
  }
  const q = query(
    collection(db, PARENT_MESSAGES_COLLECTION),
    where('childId', '==', childId),
    orderBy('timestamp', 'desc'),
    limit(5),
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs: ParentMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          familyId: data.familyId || '',
          childId: data.childId || '',
          senderId: data.senderId || '',
          senderName: data.senderName || '',
          message: data.message || '',
          timestamp: data.timestamp?.toDate?.() || new Date(),
        };
      });
      callback(msgs);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        console.warn('Parent messages subscription denied by rules:', err);
      } else if (isIndexRequiredError(err)) {
        console.warn('Parent messages query requires index. Deploy firestore.indexes.json:', err);
      } else {
        console.error('Parent messages subscription error:', err);
      }
      callback([]);
    },
  );
};


