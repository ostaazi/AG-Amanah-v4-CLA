/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ICONS } from '../constants';
import { ParentAccount, Child, FamilyMember, UserRole, AlertProtocolMode } from '../types';
import { translations } from '../translations';
import {
  ContactVerificationDelivery,
  fetchSupervisors,
  rotatePairingKey,
  getFirebasePhoneVerificationAuth,
  isSmsVerificationGatewayConfigured,
  sendProfileContactVerificationCode,
  verifyPhoneCodeWithFirebase,
} from '../services/firestoreService';
import {
  clearSelectedMockData,
  injectSelectedMockData,
  MOCK_DATA_DOMAINS,
  MockDataDomain,
  MockDataVerificationReport,
  verifyMockDataCleanup,
} from '../services/mockDataService';
import {
  canUseMockData,
  getMockDataConfigChangedEventName,
  getMockDataRuntimeOverride,
  isFirestoreEmulatorEnabled,
  isLiveMockMutationsEnvEnabled,
  setMockDataRuntimeOverride,
} from '../services/firebaseConfig';
import { generate2FASecret, getQRCodeUrl, verifyTOTP } from '../services/twoFAService';
import { logoutUser } from '../services/authService';
import { ValidationService } from '../services/validationService';
import { formatDateTimeDefault, formatTimeDefault } from '../services/dateTimeFormat';
import AvatarPickerModal from './AvatarPickerModal';
import { QRCodeSVG } from 'qrcode.react';
import { useStepUpGuard } from './auth/StepUpGuard';
import { ApplicationVerifier, RecaptchaVerifier } from 'firebase/auth';

interface SettingsViewProps {
  currentUser: ParentAccount;
  children: Child[];
  lang: 'ar' | 'en';
  onUpdateMember: (id: string, type: UserRole, updates: Record<string, unknown>) => Promise<void>;
  onDeleteMember: (id: string, role: UserRole) => Promise<void>;
  onAddChild: (data: Partial<Child>) => Promise<void>;
  onAddSupervisor: (data: Record<string, unknown>) => Promise<FamilyMember>;
  showSuccessToast: (msg: string) => void;
}

type PendingDeleteState =
  | {
      kind: 'member';
      source: 'child' | 'supervisor' | 'device';
      id: string;
      role: UserRole;
      label: string;
    }
  | {
      kind: 'purge';
      source: 'purge';
    }
  | null;

type ParentContactChannel = 'email' | 'phone';

type ParentContactVerificationState = {
  target: string;
  code: string;
  verificationId?: string;
  sentAt: number;
  expiresAt: number;
  verified: boolean;
  delivery?: ContactVerificationDelivery;
};

const DEFAULT_SELECTED_MOCK_DOMAINS: MockDataDomain[] = MOCK_DATA_DOMAINS.filter(
  (domain) => domain !== 'operations'
);

const createEmptyContactVerificationState = (): ParentContactVerificationState => ({
  target: '',
  code: '',
  sentAt: 0,
  expiresAt: 0,
  verified: false,
});

const normalizePhoneInput = (value: string): string => {
  return String(value || '').trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  children,
  lang,
  onUpdateMember,
  onDeleteMember,
  onAddChild,
  onAddSupervisor,
  showSuccessToast,
}) => {
  const t = translations[lang];
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);
  const [supervisors, setSupervisors] = useState<FamilyMember[]>([]);
  const [pairingKeyUi, setPairingKeyUi] = useState<string>(currentUser.pairingKey || '');

  // States for 2FA and Password
  const [showPassForm, setShowPassForm] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [newSupervisorEmail, setNewSupervisorEmail] = useState('');
  const [showParentProfileEditor, setShowParentProfileEditor] = useState(false);
  const [parentProfileForm, setParentProfileForm] = useState<{
    name: string;
    email: string;
    phone: string;
  }>({
    name: currentUser.name || '',
    email: currentUser.email || '',
    phone: currentUser.phone || '',
  });
  const [parentEmailCodeInput, setParentEmailCodeInput] = useState('');
  const [parentPhoneCodeInput, setParentPhoneCodeInput] = useState('');
  const [emailVerificationState, setEmailVerificationState] = useState<ParentContactVerificationState>(
    createEmptyContactVerificationState()
  );
  const [phoneVerificationState, setPhoneVerificationState] = useState<ParentContactVerificationState>(
    createEmptyContactVerificationState()
  );
  const phoneRecaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [phoneRecaptchaReady, setPhoneRecaptchaReady] = useState(false);
  const [phoneRecaptchaError, setPhoneRecaptchaError] = useState<string>('');
  const smsGatewayConfigured = useMemo(() => isSmsVerificationGatewayConfigured(), []);
  const phoneRecaptchaContainerId = useMemo(
    () => `parent-phone-recaptcha-${currentUser.id}`,
    [currentUser.id]
  );

  // States for Adding Child
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState<string>('');
  const [newChildAvatar, setNewChildAvatar] = useState<string>(
    'https://cdn-icons-png.flaticon.com/512/4140/4140048.png'
  );
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [editingChildForm, setEditingChildForm] = useState<{
    name: string;
    age: string;
    role: UserRole;
    deviceNickname: string;
  }>({
    name: '',
    age: '',
    role: 'CHILD',
    deviceNickname: '',
  });
  const [linkingChild, setLinkingChild] = useState<Child | null>(null);
  const [linkDeviceUid, setLinkDeviceUid] = useState('');
  const [selectedMockDomains, setSelectedMockDomains] = useState<MockDataDomain[]>([
    ...DEFAULT_SELECTED_MOCK_DOMAINS,
  ]);
  const [lastMockOperation, setLastMockOperation] = useState<{
    mode: 'inject' | 'delete';
    result: Record<MockDataDomain, number>;
    total: number;
    at: Date;
  } | null>(null);
  const [mockCleanupReport, setMockCleanupReport] = useState<MockDataVerificationReport | null>(null);
  const [mockOpsEnabled, setMockOpsEnabled] = useState<boolean>(() => canUseMockData());
  const [mockRuntimeOverride, setMockRuntimeOverrideState] = useState<boolean | null>(() =>
    getMockDataRuntimeOverride()
  );
  const mockConfigChangedEventName = useMemo(() => getMockDataConfigChangedEventName(), []);
  const mockEnvEmulatorEnabled = useMemo(() => isFirestoreEmulatorEnabled(), []);
  const mockEnvLiveEnabled = useMemo(() => isLiveMockMutationsEnvEnabled(), []);

  // Avatar Picker State
  const [pickerConfig, setPickerConfig] = useState<{
    isOpen: boolean;
    targetId?: string;
    targetRole?: UserRole;
    currentUrl?: string;
  } | null>(null);

  useEffect(() => {
    const loadSupervisors = async () => {
      const data = await fetchSupervisors(currentUser.id);
      setSupervisors(data);
    };
    loadSupervisors();
  }, [currentUser.id]);

  useEffect(() => {
    setPairingKeyUi(currentUser.pairingKey || '');
  }, [currentUser.pairingKey]);

  useEffect(() => {
    setParentProfileForm({
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
    });
    setParentEmailCodeInput('');
    setParentPhoneCodeInput('');
    setEmailVerificationState(createEmptyContactVerificationState());
    setPhoneVerificationState(createEmptyContactVerificationState());
  }, [currentUser.name, currentUser.email, currentUser.phone]);

  useEffect(() => {
    const syncMockRuntimeState = () => {
      setMockOpsEnabled(canUseMockData());
      setMockRuntimeOverrideState(getMockDataRuntimeOverride());
    };

    syncMockRuntimeState();

    if (typeof window === 'undefined') return;

    const handleStorage = () => syncMockRuntimeState();
    const handleMockConfigChange = () => syncMockRuntimeState();

    window.addEventListener('storage', handleStorage);
    window.addEventListener(mockConfigChangedEventName, handleMockConfigChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(mockConfigChangedEventName, handleMockConfigChange as EventListener);
    };
  }, [mockConfigChangedEventName]);

  useEffect(() => {
    if (!showParentProfileEditor) {
      if (phoneRecaptchaVerifierRef.current) {
        phoneRecaptchaVerifierRef.current.clear();
        phoneRecaptchaVerifierRef.current = null;
      }
      setPhoneRecaptchaReady(false);
      setPhoneRecaptchaError('');
      return;
    }

    if (phoneRecaptchaVerifierRef.current) {
      setPhoneRecaptchaReady(true);
      return;
    }

    let mounted = true;

    const initPhoneRecaptcha = async () => {
      try {
        const verifier = new RecaptchaVerifier(
          getFirebasePhoneVerificationAuth(),
          phoneRecaptchaContainerId,
          { size: 'invisible' }
        );
        await verifier.render();

        if (!mounted) {
          verifier.clear();
          return;
        }

        phoneRecaptchaVerifierRef.current = verifier;
        setPhoneRecaptchaReady(true);
        setPhoneRecaptchaError('');
      } catch (error: unknown) {
        if (!mounted) return;
        setPhoneRecaptchaReady(false);
        setPhoneRecaptchaError(getErrorMessage(error, 'Unable to initialize reCAPTCHA.'));
      }
    };

    void initPhoneRecaptcha();

    return () => {
      mounted = false;
    };
  }, [showParentProfileEditor, phoneRecaptchaContainerId]);

  // Phase 4.1: Dynamic Pairing Auto-Rotation
  useEffect(() => {
    const checkRotation = async () => {
      // Safety check for guest mode
      if (currentUser.id === 'guest') return;

      const now = new Date();
      let expires: Date | null = null;

      if (currentUser.pairingKeyExpiresAt) {
        expires =
          typeof currentUser.pairingKeyExpiresAt.toDate === 'function'
            ? currentUser.pairingKeyExpiresAt.toDate()
            : new Date(currentUser.pairingKeyExpiresAt);
      }

      // If no key or expired, rotate
      if (!currentUser.pairingKey || !expires || now > expires) {
        console.warn('Pairing key expired or missing, rotating...');
        try {
          const newKey = await rotatePairingKey(currentUser.id);
          // Update local state is handled by Firestore subscription in App.tsx usually, 
          // but here we might rely on the parent updating props. 
          // Since rotatePairingKey updates DB, and App.tsx syncs profile, it should reflect.
          // However, syncParentProfile in App.tsx might not be real-time for *own* profile changes unless we manually trigger it.
          // For now, we assume App.tsx will pick it up or we manually update if needed.
          // Actually, App.tsx has handleUpdateMember but that's for explicit UI actions.
          // To ensure UI updates, we might need to call onUpdateMember with the new key if we had the key returned.
          // But rotatePairingKey does the DB write.
          // Let's manually trigger a local update to ensure responsiveness if needed, 
          // but strictly we should rely on data flow. 
          // For this specific flow, let's trust the prop update cycle or force it via onUpdateMember (hacky).
          // Better: just call rotatePairingKey and assume the parent component refetches or we force a reload.
          // Actually, standard pattern:
          await onUpdateMember(currentUser.id, 'ADMIN', {
            pairingKey: newKey,
            pairingKeyExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          });
          setPairingKeyUi(newKey);
        } catch (e) {
          console.error('Failed to rotate pairing key', e);
        }
      }
    };

    checkRotation();
    const interval = setInterval(checkRotation, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [currentUser.id, currentUser.pairingKey, currentUser.pairingKeyExpiresAt, onUpdateMember]);

  const handleRegenerateKey = async () => {
    setIsProcessing(true);
    try {
      const newKey = await rotatePairingKey(currentUser.id);
      await onUpdateMember(currentUser.id, 'ADMIN', {
        pairingKey: newKey,
        pairingKeyExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      setPairingKeyUi(newKey);
      showSuccessToast('تم تحديث مفتاح الربط');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateProtocol = async (mode: AlertProtocolMode) => {
    await onUpdateMember(currentUser.id, 'ADMIN', { alertProtocol: mode });
    const msg =
      mode === 'FULL'
        ? lang === 'ar'
          ? 'تم تفعيل وضع شاشة الطوارئ'
          : 'Emergency screen enabled'
        : mode === 'SIMPLE'
          ? lang === 'ar'
            ? 'تم تفعيل الإشعارات الببسيطة'
            : 'Simple notifications enabled'
          : lang === 'ar'
            ? 'تم تفعيل الوضع الصامت'
            : 'Silent mode enabled';
    showSuccessToast(msg);
  };

  const handleAvatarSelect = async (url: string) => {
    if (!pickerConfig) return;

    if (pickerConfig.targetId === 'NEW_CHILD') {
      setNewChildAvatar(url);
    } else if (pickerConfig.targetId && pickerConfig.targetRole) {
      await onUpdateMember(pickerConfig.targetId, pickerConfig.targetRole, { avatar: url });
      if (pickerConfig.targetRole === 'SUPERVISOR') {
        setSupervisors((prev) =>
          prev.map((s) => (s.id === pickerConfig.targetId ? { ...s, avatar: url } : s))
        );
      }
    }
    setPickerConfig(null);
    showSuccessToast(lang === 'ar' ? 'تم تحديث الصورة الشخصية' : 'Profile picture updated');
  };

  const openParentProfileEditor = () => {
    setParentProfileForm({
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
    });
    setParentEmailCodeInput('');
    setParentPhoneCodeInput('');
    setEmailVerificationState(createEmptyContactVerificationState());
    setPhoneVerificationState(createEmptyContactVerificationState());
    setShowParentProfileEditor(true);
  };

  const getNormalizedProfileValues = () => {
    const normalizedName = parentProfileForm.name.trim();
    const normalizedEmail = parentProfileForm.email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneInput(parentProfileForm.phone);
    const currentEmail = String(currentUser.email || '').trim().toLowerCase();
    const currentPhone = normalizePhoneInput(currentUser.phone || '');
    const isEmailChanged = normalizedEmail !== currentEmail;
    const isPhoneChanged = normalizedPhone !== currentPhone;
    return {
      normalizedName,
      normalizedEmail,
      normalizedPhone,
      isEmailChanged,
      isPhoneChanged,
    };
  };

  const handleSendParentContactVerificationCode = async (channel: ParentContactChannel) => {
    const { normalizedEmail, normalizedPhone } = getNormalizedProfileValues();
    const target = channel === 'email' ? normalizedEmail : normalizedPhone;

    if (!target) {
      showSuccessToast(
        lang === 'ar'
          ? channel === 'email'
            ? 'أدخل البريد الإلكتروني أولاً.'
            : 'أدخل رقم الهاتف أولاً.'
          : channel === 'email'
            ? 'Enter the email first.'
            : 'Enter the phone number first.'
      );
      return;
    }

    if (channel === 'email' && !ValidationService.isValidEmail(target)) {
      showSuccessToast(lang === 'ar' ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Invalid email format.');
      return;
    }

    if (channel === 'phone' && !ValidationService.isValidPhoneNumber(target)) {
      showSuccessToast(
        lang === 'ar'
          ? 'صيغة رقم الهاتف غير صحيحة. استخدم تنسيقًا دوليًا مثل +974XXXXXXXX.'
          : 'Invalid phone format. Use international format such as +974XXXXXXXX.'
      );
      return;
    }

    const canUseFirebasePhoneSms = Boolean(phoneRecaptchaVerifierRef.current);
    if (channel === 'phone' && !canUseFirebasePhoneSms && !smsGatewayConfigured) {
      showSuccessToast(
        lang === 'ar'
          ? 'تعذر تهيئة reCAPTCHA لإرسال SMS عبر Firebase. أعد فتح نافذة التعديل ثم حاول مجددًا.'
          : 'Could not initialize reCAPTCHA for Firebase SMS. Reopen the edit modal and try again.'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const dispatch = await sendProfileContactVerificationCode(
        channel,
        target,
        channel === 'phone' && canUseFirebasePhoneSms
          ? { phoneAppVerifier: phoneRecaptchaVerifierRef.current as ApplicationVerifier }
          : undefined
      );
      if (channel === 'email') {
        setParentEmailCodeInput('');
        setEmailVerificationState({
          target: dispatch.target,
          code: dispatch.code,
          sentAt: dispatch.sentAt,
          expiresAt: dispatch.expiresAt,
          verified: false,
          delivery: dispatch.delivery,
        });
      } else {
        setParentPhoneCodeInput('');
        setPhoneVerificationState({
          target: dispatch.target,
          code: dispatch.code,
          verificationId: dispatch.verificationId,
          sentAt: dispatch.sentAt,
          expiresAt: dispatch.expiresAt,
          verified: false,
          delivery: dispatch.delivery,
        });
      }

      if (dispatch.delivery === 'DEV_FALLBACK') {
        showSuccessToast(
          lang === 'ar'
            ? `وضع التطوير مفعّل: لم يتم إرسال رسالة SMS فعلية. استخدم كود الاختبار: ${dispatch.code}`
            : `Development mode is active: no real SMS was sent. Use this test code: ${dispatch.code}`
        );
        return;
      }

      if (dispatch.delivery === 'FIREBASE_PHONE_AUTH') {
        showSuccessToast(
          lang === 'ar'
            ? 'تم إرسال رسالة SMS فعلية عبر Firebase. أدخل الكود المرسل إلى الهاتف خلال 10 دقائق.'
            : 'A real SMS has been sent via Firebase. Enter the code received on the phone within 10 minutes.'
        );
        return;
      }

      showSuccessToast(
        lang === 'ar'
          ? channel === 'email'
            ? 'تم إرسال رسالة تحقق للبريد. خذ الكود من الرابط داخل الرسالة (المتغير vc) ثم أدخله خلال 10 دقائق.'
            : 'تم إرسال رسالة SMS بكود التحقق. أدخله خلال 10 دقائق.'
          : channel === 'email'
            ? 'Verification email sent. Copy the vc code from the link in the message, then enter it within 10 minutes.'
            : 'SMS verification code sent. Enter it within 10 minutes.'
      );
    } catch (error: any) {
      console.error('Failed to dispatch profile contact verification code:', error);
      showSuccessToast(
        lang === 'ar'
          ? `تعذر إرسال كود التحقق: ${error?.message || 'تحقق من الإعدادات.'}`
          : `Failed to send verification code: ${error?.message || 'Check configuration.'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyParentContactCode = async (channel: ParentContactChannel) => {
    const state = channel === 'email' ? emailVerificationState : phoneVerificationState;
    const input = (channel === 'email' ? parentEmailCodeInput : parentPhoneCodeInput).trim();
    const { normalizedEmail, normalizedPhone } = getNormalizedProfileValues();
    const target = channel === 'email' ? normalizedEmail : normalizedPhone;

    if (!state.sentAt || (!state.code && !state.verificationId)) {
      showSuccessToast(
        lang === 'ar'
          ? channel === 'email'
            ? 'أرسل كود البريد أولاً.'
            : 'أرسل كود الهاتف أولاً.'
          : channel === 'email'
            ? 'Send the email code first.'
            : 'Send the phone code first.'
      );
      return;
    }

    if (state.target !== target) {
      showSuccessToast(
        lang === 'ar'
          ? 'تم تغيير الحقل بعد الإرسال. أعد إرسال كود جديد.'
          : 'Field changed after send. Please resend a new code.'
      );
      return;
    }

    if (Date.now() > state.expiresAt) {
      showSuccessToast(
        lang === 'ar'
          ? 'انتهت صلاحية الكود. أعد الإرسال.'
          : 'Verification code expired. Please resend.'
      );
      return;
    }

    if (!/^\d{6}$/.test(input)) {
      showSuccessToast(
        lang === 'ar' ? 'أدخل كود مكوّنًا من 6 أرقام.' : 'Enter a 6-digit verification code.'
      );
      return;
    }

    if (channel === 'phone' && state.delivery === 'FIREBASE_PHONE_AUTH') {
      if (!state.verificationId) {
        showSuccessToast(
          lang === 'ar'
            ? 'جلسة التحقق مفقودة. أعد إرسال كود الهاتف.'
            : 'Verification session missing. Please resend the phone code.'
        );
        return;
      }

      setIsProcessing(true);
      try {
        await verifyPhoneCodeWithFirebase(state.verificationId, input);
        setPhoneVerificationState((prev) => ({ ...prev, verified: true }));
        showSuccessToast(
          lang === 'ar' ? 'تم توثيق رقم الهاتف عبر Firebase بنجاح.' : 'Phone verified via Firebase.'
        );
      } catch (error: any) {
        showSuccessToast(
          lang === 'ar'
            ? `تعذر توثيق رقم الهاتف: ${error?.message || 'تحقق من إعدادات Firebase Phone Auth.'}`
            : `Phone verification failed: ${error?.message || 'Check Firebase Phone Auth settings.'}`
        );
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (input !== state.code) {
      showSuccessToast(lang === 'ar' ? 'كود التحقق غير صحيح.' : 'Invalid verification code.');
      return;
    }

    if (channel === 'email') {
      setEmailVerificationState((prev) => ({ ...prev, verified: true }));
      showSuccessToast(lang === 'ar' ? 'تم توثيق البريد الإلكتروني.' : 'Email verified successfully.');
      return;
    }

    setPhoneVerificationState((prev) => ({ ...prev, verified: true }));
    showSuccessToast(lang === 'ar' ? 'تم توثيق رقم الهاتف.' : 'Phone number verified successfully.');
  };

  const handleSaveParentProfile = async () => {
    const { normalizedName, normalizedEmail, normalizedPhone, isEmailChanged, isPhoneChanged } =
      getNormalizedProfileValues();

    if (!normalizedName) {
      showSuccessToast(lang === 'ar' ? 'اسم الأب مطلوب.' : 'Father name is required.');
      return;
    }
    if (!ValidationService.isSafeText(normalizedName)) {
      showSuccessToast(lang === 'ar' ? 'الاسم يحتوي رموزًا غير مسموحة.' : 'Name contains unsafe characters.');
      return;
    }
    if (normalizedEmail && !ValidationService.isValidEmail(normalizedEmail)) {
      showSuccessToast(lang === 'ar' ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Invalid email format.');
      return;
    }
    if (normalizedPhone && !ValidationService.isValidPhoneNumber(normalizedPhone)) {
      showSuccessToast(
        lang === 'ar'
          ? 'صيغة رقم الهاتف غير صحيحة. استخدم تنسيقًا دوليًا مثل +974XXXXXXXX.'
          : 'Invalid phone format. Use international format such as +974XXXXXXXX.'
      );
      return;
    }

    const isNameChanged = normalizedName !== String(currentUser.name || '').trim();
    if (!isNameChanged && !isEmailChanged && !isPhoneChanged) {
      showSuccessToast(lang === 'ar' ? 'لا توجد تغييرات للحفظ.' : 'No changes to save.');
      return;
    }

    if (isEmailChanged && normalizedEmail) {
      const validEmailVerification =
        emailVerificationState.verified &&
        emailVerificationState.target === normalizedEmail &&
        emailVerificationState.expiresAt > Date.now();
      if (!validEmailVerification) {
        showSuccessToast(
          lang === 'ar'
            ? 'تحقق من البريد الإلكتروني مطلوب قبل الحفظ.'
            : 'Email verification is required before saving.'
        );
        return;
      }
    }

    if (isPhoneChanged && normalizedPhone) {
      const validPhoneVerification =
        phoneVerificationState.verified &&
        phoneVerificationState.target === normalizedPhone &&
        phoneVerificationState.expiresAt > Date.now();
      if (!validPhoneVerification) {
        showSuccessToast(
          lang === 'ar'
            ? 'تحقق من رقم الهاتف مطلوب قبل الحفظ.'
            : 'Phone verification is required before saving.'
        );
        return;
      }
    }

    const updates: any = {};
    if (isNameChanged) updates.name = normalizedName;
    if (isEmailChanged) {
      updates.email = normalizedEmail || null;
      updates.emailVerified = normalizedEmail ? true : false;
    }
    if (isPhoneChanged) {
      updates.phone = normalizedPhone || null;
      updates.phoneVerified = normalizedPhone ? true : false;
    }

    await requireStepUp('SENSITIVE_SETTINGS', async () => {
      setIsProcessing(true);
      try {
        await onUpdateMember(currentUser.id, 'ADMIN', updates);
        setShowParentProfileEditor(false);
        showSuccessToast(
          lang === 'ar' ? 'تم تحديث ملف الأب بنجاح.' : 'Father profile updated successfully.'
        );
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleAddChildProfile = async () => {
    if (!newChildName || !newChildAge) return;
    setIsProcessing(true);
    try {
      await onAddChild({
        name: newChildName,
        age: parseInt(newChildAge),
        role: 'CHILD',
        avatar: newChildAvatar,
        appUsage: [],
        status: 'offline',
        batteryLevel: 100,
        signalStrength: 4,
      });
      setNewChildName('');
      setNewChildAge('');
      setNewChildAvatar('https://cdn-icons-png.flaticon.com/512/4140/4140048.png');
      showSuccessToast(
        lang === 'ar' ? 'تمت إضافة ملف الطفل بنجاح' : 'Child profile added successfully'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSupervisor = async () => {
    const inviteEmail = newSupervisorEmail.trim().toLowerCase();
    if (!inviteEmail) return;
    if (!ValidationService.isValidEmail(inviteEmail)) {
      showSuccessToast(lang === 'ar' ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Invalid email format.');
      return;
    }

    setIsProcessing(true);
    try {
      const newSup = await onAddSupervisor({
        email: inviteEmail,
        name: inviteEmail.split('@')[0],
        inviterName: currentUser?.name || currentUser?.email || '',
        avatar:
          'https://img.freepik.com/premium-vector/hijab-woman-avatar-illustration-vector-woman-hijab-profile-icon_671746-348.jpg',
      });
      setSupervisors([...supervisors, newSup]);
      setNewSupervisorEmail('');
      const inviteMethod = (newSup as any)?.inviteMethod;
      showSuccessToast(
        inviteMethod === 'CUSTOM_EMAIL'
          ? lang === 'ar'
            ? 'تم إرسال دعوة جميلة إلى بريد الأم بنجاح! ✉️'
            : 'Beautiful invitation email sent successfully! ✉️'
          : inviteMethod === 'PASSWORD_RESET'
            ? lang === 'ar'
              ? 'تم إرسال دعوة الأم عبر بريد ضبط كلمة المرور. إذا كانت في spam أو لم تصل، استخدمي "نسيت كلمة المرور" بنفس البريد لإكمال الدعوة.'
              : 'Mother invite sent via password-reset email. If it is in Spam or missing, use Forgot Password with the same email.'
            : lang === 'ar'
              ? 'تم إرسال دعوة فعلية إلى بريد الأم. إذا كانت في spam أو لم تصل، استخدمي "نسيت كلمة المرور" بنفس البريد.'
              : 'Invitation email sent. If it is in Spam or missing, use Forgot Password with the same email.'
      );
    } catch (error: any) {
      console.error('Failed to send co-parent invitation email:', error);
      showSuccessToast(
        lang === 'ar'
          ? `فشل إرسال دعوة البريد: ${error?.message || 'تحقق من إعدادات Firebase Auth.'}`
          : `Failed to send invitation email: ${error?.message || 'Check Firebase Auth settings.'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStart2FA = () => {
    const secret = generate2FASecret();
    setTempSecret(secret);
    setShow2FASetup(true);
  };

  const handleVerify2FA = async () => {
    if (verifyCode.length !== 6) return;
    setIsVerifying(true);
    try {
      const isValid = await verifyTOTP(tempSecret, verifyCode);
      if (isValid) {
        await onUpdateMember(currentUser.id, 'ADMIN', { twoFASecret: tempSecret });
        showSuccessToast(
          lang === 'ar'
            ? 'تم تفعيل المصادقة الثنائية (2FA) بنجاح!'
            : 'Two-factor authentication (2FA) enabled successfully!'
        );
        setShow2FASetup(false);
        setVerifyCode('');
      } else {
        alert(lang === 'ar' ? 'كود التحقق غير صحيح' : 'Invalid code');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(tempSecret);
    showSuccessToast(lang === 'ar' ? 'تم نسخ كود الأمان!' : 'Key copied!');
  };

  const copyVerificationCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showSuccessToast(
        lang === 'ar' ? 'تم نسخ كود التحقق التجريبي.' : 'Test verification code copied.'
      );
    } catch {
      showSuccessToast(
        lang === 'ar'
          ? 'تعذر نسخ الكود تلقائيًا. انسخه يدويًا من الشاشة.'
          : 'Could not copy the code automatically. Please copy it manually from the screen.'
      );
    }
  };

  const roleOptions = useMemo(
    () => [
      { value: 'ADMIN' as UserRole, labelAr: 'مدير', labelEn: 'Manager' },
      { value: 'SUPERVISOR' as UserRole, labelAr: 'مشرف', labelEn: 'Supervisor' },
      { value: 'CHILD' as UserRole, labelAr: 'طفل', labelEn: 'Child' },
    ],
    []
  );

  const mockDomainOptions = useMemo(
    () => [
      { key: 'children' as MockDataDomain, ar: 'أطفال', en: 'Children' },
      { key: 'devices' as MockDataDomain, ar: 'أجهزة', en: 'Devices' },
      { key: 'eventsAlerts' as MockDataDomain, ar: 'أحداث وتنبيهات', en: 'Events & Alerts' },
      { key: 'timings' as MockDataDomain, ar: 'توقيتات', en: 'Timings' },
      { key: 'supervisors' as MockDataDomain, ar: 'مشرفون', en: 'Supervisors' },
      { key: 'psychPulse' as MockDataDomain, ar: 'نبض نفسي', en: 'Psych Pulse' },
      { key: 'operations' as MockDataDomain, ar: 'تشغيل متقدم', en: 'Advanced Ops' },
    ],
    []
  );

  const mockDomainLabelMap = useMemo(
    () =>
      Object.fromEntries(
        mockDomainOptions.map((option) => [option.key, lang === 'ar' ? option.ar : option.en])
      ) as Record<MockDataDomain, string>,
    [mockDomainOptions, lang]
  );

  const isAllMockDomainsSelected = selectedMockDomains.length === MOCK_DATA_DOMAINS.length;

  const toggleMockDomain = (domain: MockDataDomain) => {
    setSelectedMockDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const toggleAllMockDomains = () => {
    setSelectedMockDomains(isAllMockDomainsSelected ? [] : [...MOCK_DATA_DOMAINS]);
  };

  const handleSetMockRuntimeOverride = (nextValue: boolean | null) => {
    setMockDataRuntimeOverride(nextValue);
    setMockOpsEnabled(canUseMockData());
    setMockRuntimeOverrideState(getMockDataRuntimeOverride());
    showSuccessToast(
      nextValue === null
        ? lang === 'ar'
          ? 'تم الرجوع إلى إعدادات البيئة الافتراضية لبيانات mock.'
          : 'Mock data mode now follows environment defaults.'
        : nextValue
          ? lang === 'ar'
            ? 'تم تفعيل عمليات بيانات mock من داخل التطبيق.'
            : 'Mock data operations were enabled from app controls.'
          : lang === 'ar'
            ? 'تم تعطيل عمليات بيانات mock من داخل التطبيق.'
            : 'Mock data operations were disabled from app controls.'
    );
  };

  const showMockOpsDisabledToast = () => {
    showSuccessToast(
      lang === 'ar'
        ? 'عمليات البيانات الوهمية معطّلة. فعّلها من أزرار Mock Data Lab أو عبر Emulator/.env.'
        : 'Mock operations are disabled. Enable them from Mock Data Lab controls or Emulator/.env.'
    );
  };

  const verifyMockCleanupForDomains = async (domains: MockDataDomain[]) => {
    const report = await verifyMockDataCleanup(currentUser.id, domains);
    setMockCleanupReport(report);
    return report;
  };

  const handleInjectMockData = async () => {
    if (selectedMockDomains.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await injectSelectedMockData(currentUser.id, selectedMockDomains);
      const total = Object.values(result).reduce((acc, n) => acc + n, 0);
      setLastMockOperation({ mode: 'inject', result, total, at: new Date() });
      setMockCleanupReport(null);
      showSuccessToast(
        lang === 'ar'
          ? `تم حقن بيانات تجريبية (${total})`
          : `Injected mock records (${total})`
      );
    } catch (e: any) {
      const code = String(e?.code || '');
      const message = String(e?.message || '');
      const isPermissionIssue =
        code === 'permission-denied' || message.includes('Missing or insufficient permissions');

      if (isPermissionIssue && selectedMockDomains.includes('operations')) {
        const fallbackDomains = selectedMockDomains.filter((domain) => domain !== 'operations');
        if (fallbackDomains.length > 0) {
          try {
            const fallbackResult = await injectSelectedMockData(currentUser.id, fallbackDomains);
            const merged: Record<MockDataDomain, number> = {
              ...fallbackResult,
              operations: 0,
            } as Record<MockDataDomain, number>;
            const total = Object.values(merged).reduce((acc, n) => acc + n, 0);
            setLastMockOperation({ mode: 'inject', result: merged, total, at: new Date() });
            setMockCleanupReport(null);
            showSuccessToast(
              lang === 'ar'
                ? `تم الحقن جزئيًا (${total}) بدون تشغيل متقدم بسبب الصلاحيات.`
                : `Injected partially (${total}) without Advanced Ops due to permissions.`
            );
            return;
          } catch (fallbackError) {
            console.error('Fallback mock inject failed', fallbackError);
          }
        }
      }

      if (String(e?.message || '').includes('MOCK_DATA_DISABLED')) {
        showMockOpsDisabledToast();
        return;
      }
      if (isPermissionIssue) {
        showSuccessToast(
          lang === 'ar'
            ? 'فشل حقن البيانات الوهمية بسبب الصلاحيات. تأكد من تسجيل الدخول بالحساب المالك.'
            : 'Mock inject failed due to permissions. Sign in with the owning parent account.'
        );
        return;
      }
      console.error('Inject mock data failed', e);
      showSuccessToast(lang === 'ar' ? 'تعذر حقن البيانات الوهمية' : 'Failed to inject mock data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearMockData = async () => {
    if (selectedMockDomains.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await clearSelectedMockData(currentUser.id, selectedMockDomains);
      const total = Object.values(result).reduce((acc, n) => acc + n, 0);
      setLastMockOperation({ mode: 'delete', result, total, at: new Date() });
      const report = await verifyMockCleanupForDomains(selectedMockDomains);
      showSuccessToast(
        report.clean
          ? lang === 'ar'
            ? `تم حذف بيانات تجريبية (${total}) والتحقق من التنظيف بالكامل.`
            : `Deleted mock records (${total}) and cleanup was verified.`
          : lang === 'ar'
            ? `تم الحذف (${total}) لكن ما زالت هناك بقايا mock: ${report.total}.`
            : `Deleted (${total}) but mock residue is still present: ${report.total}.`
      );
    } catch (e: any) {
      if (String(e?.message || '').includes('MOCK_DATA_DISABLED')) {
        showMockOpsDisabledToast();
        return;
      }
      console.error('Clear mock data failed', e);
      showSuccessToast(lang === 'ar' ? 'تعذر حذف البيانات الوهمية' : 'Failed to delete mock data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyMockCleanup = async () => {
    if (selectedMockDomains.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const report = await verifyMockCleanupForDomains(selectedMockDomains);
      if (report.clean) {
        showSuccessToast(
          lang === 'ar'
            ? 'التحقق ناجح: لا توجد أي بقايا للبيانات الوهمية في النطاقات المحددة.'
            : 'Verification passed: no mock residue found for selected domains.'
        );
      } else if (report.inaccessible.length > 0) {
        const labels = report.inaccessible.map((domain) => mockDomainLabelMap[domain]).join(', ');
        showSuccessToast(
          lang === 'ar'
            ? `تعذر التحقق الكامل من بعض النطاقات بسبب الصلاحيات: ${labels}`
            : `Could not fully verify some domains due to permissions: ${labels}`
        );
      } else {
        showSuccessToast(
          lang === 'ar'
            ? `تم العثور على بقايا mock بعدد ${report.total}.`
            : `Mock residue detected: ${report.total}.`
        );
      }
    } catch (e: any) {
      if (String(e?.message || '').includes('MOCK_DATA_DISABLED')) {
        showMockOpsDisabledToast();
        return;
      }
      console.error('Verify mock cleanup failed', e);
      showSuccessToast(lang === 'ar' ? 'تعذر التحقق من حالة بيانات mock' : 'Failed to verify mock cleanup');
    } finally {
      setIsProcessing(false);
    }
  };

  const openChildEditor = (child: Child) => {
    setEditingChild(child);
    setEditingChildForm({
      name: child.name || '',
      age: child.age ? String(child.age) : '',
      role: child.role || 'CHILD',
      deviceNickname: child.deviceNickname || '',
    });
  };

  const handleSaveChildEdit = async () => {
    if (!editingChild || !editingChildForm.name.trim()) return;
    const parsedAge = Number.parseInt(editingChildForm.age, 10);

    setIsProcessing(true);
    try {
      await onUpdateMember(editingChild.id, 'CHILD', {
        name: editingChildForm.name.trim(),
        age: Number.isFinite(parsedAge) ? parsedAge : editingChild.age || 0,
        role: editingChildForm.role,
        deviceNickname: editingChildForm.deviceNickname.trim(),
      });
      showSuccessToast(lang === 'ar' ? 'تم تحديث بيانات الطفل' : 'Child profile updated');
      setEditingChild(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const openLinkDeviceModal = (child: Child) => {
    setLinkingChild(child);
    setLinkDeviceUid(child.deviceOwnerUid || '');
  };

  const handleSaveDeviceLink = async () => {
    if (!linkingChild || !linkDeviceUid.trim()) return;
    setIsProcessing(true);
    try {
      await onUpdateMember(linkingChild.id, 'CHILD', {
        deviceOwnerUid: linkDeviceUid.trim(),
        status: 'online',
      });
      showSuccessToast(lang === 'ar' ? 'تم ربط الجهاز بنجاح' : 'Device linked successfully');
      setLinkingChild(null);
      setLinkDeviceUid('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsProcessing(true);
    try {
      if (pendingDelete.kind === 'member') {
        await onDeleteMember(pendingDelete.id, pendingDelete.role);

        if (pendingDelete.source === 'supervisor') {
          setSupervisors((prev) => prev.filter((sup) => sup.id !== pendingDelete.id));
          showSuccessToast(lang === 'ar' ? 'تم حذف المشرف بنجاح.' : 'Supervisor deleted successfully.');
        } else if (pendingDelete.source === 'child') {
          showSuccessToast(lang === 'ar' ? 'تم حذف الطفل بنجاح.' : 'Child deleted successfully.');
        } else if (pendingDelete.source === 'device') {
          showSuccessToast(
            lang === 'ar' ? 'تم حذف الجهاز المرتبط بنجاح.' : 'Linked device deleted successfully.'
          );
        }
      } else if (pendingDelete.kind === 'purge') {
        try {
          const result = await clearSelectedMockData(currentUser.id, [...MOCK_DATA_DOMAINS]);
          const total = Object.values(result).reduce((acc, n) => acc + n, 0);
          setLastMockOperation({ mode: 'delete', result, total, at: new Date() });
          const report = await verifyMockCleanupForDomains([...MOCK_DATA_DOMAINS]);
          showSuccessToast(
            report.clean
              ? lang === 'ar'
                ? `تم حذف كل البيانات الوهمية (${total}) والتحقق من عدم وجود أي بقايا.`
                : `Deleted all mock records (${total}) and verified zero residue.`
              : lang === 'ar'
                ? `تم الحذف (${total}) لكن ما زالت هناك بقايا mock: ${report.total}.`
                : `Deleted (${total}) but mock residue is still present: ${report.total}.`
          );
        } catch (e: any) {
          if (String(e?.message || '').includes('MOCK_DATA_DISABLED')) {
            showMockOpsDisabledToast();
            return;
          }
          console.error('Clear all mock data failed', e);
          showSuccessToast(
            lang === 'ar' ? 'تعذر حذف كل البيانات الوهمية' : 'Failed to delete all mock data'
          );
        }
      }
    } catch (error) {
      console.error('Delete action failed:', error);
      showSuccessToast(
        lang === 'ar' ? 'تعذر تنفيذ عملية الحذف. تحقق من الصلاحيات.' : 'Delete failed. Check permissions.'
      );
    } finally {
      setIsProcessing(false);
      setPendingDelete(null);
    }
  };

  const currentProtocol = currentUser.alertProtocol || 'FULL';
  const { requireStepUp, modal: stepUpModal } = useStepUpGuard({
    lang,
    currentUser,
  });
  const lockDisableUntilTs = Number(currentUser.enabledFeatures?.allLocksDisabledUntil || 0);
  const isLockDisableTemporaryActive = lockDisableUntilTs > Date.now();
  const isLockDisablePermanentActive =
    currentUser.enabledFeatures?.allLocksDisabledPermanently === true;
  const isAllLocksDisableActive = isLockDisablePermanentActive || isLockDisableTemporaryActive;
  const lockDisableUntilLabel = isLockDisableTemporaryActive
    ? formatDateTimeDefault(lockDisableUntilTs, { includeSeconds: false })
    : '';
  const normalizedCurrentEmail = String(currentUser.email || '').trim().toLowerCase();
  const normalizedCurrentPhone = normalizePhoneInput(currentUser.phone || '');
  const normalizedEditorEmail = parentProfileForm.email.trim().toLowerCase();
  const normalizedEditorPhone = normalizePhoneInput(parentProfileForm.phone);
  const emailVerificationRequired =
    !!normalizedEditorEmail && normalizedEditorEmail !== normalizedCurrentEmail;
  const phoneVerificationRequired =
    !!normalizedEditorPhone && normalizedEditorPhone !== normalizedCurrentPhone;

  const setTemporaryLockDisable = async (minutes: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const until = Date.now() + minutes * 60 * 1000;
      await onUpdateMember(currentUser.id, 'ADMIN', {
        ['enabledFeatures.allLocksDisabledUntil']: until,
      });
      showSuccessToast(
        lang === 'ar'
          ? `تم تعطيل جميع الأقفال مؤقتًا لمدة ${minutes} دقيقة`
          : `All locks disabled temporarily for ${minutes} minutes`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePermanentLockDisable = async () => {
    if (isProcessing) return;
    const next = !isLockDisablePermanentActive;
    setIsProcessing(true);
    try {
      await onUpdateMember(currentUser.id, 'ADMIN', {
        ['enabledFeatures.allLocksDisabledPermanently']: next,
      });
      showSuccessToast(
        next
          ? lang === 'ar'
            ? 'تم تعطيل جميع الأقفال بشكل دائم'
            : 'All locks disabled permanently'
          : lang === 'ar'
            ? 'تم إيقاف التعطيل الدائم للأقفال'
            : 'Permanent lock disable has been turned off'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const reactivateAllLocks = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onUpdateMember(currentUser.id, 'ADMIN', {
        ['enabledFeatures.allLocksDisabledPermanently']: false,
        ['enabledFeatures.allLocksDisabledUntil']: 0,
      });
      showSuccessToast(
        lang === 'ar'
          ? 'تمت إعادة تفعيل جميع الأقفال'
          : 'All lock controls re-enabled'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="max-w-4xl mx-auto space-y-12 pb-48 pt-6 animate-in fade-in"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <AvatarPickerModal
        isOpen={!!pickerConfig?.isOpen}
        onClose={() => setPickerConfig(null)}
        onSelect={handleAvatarSelect}
        currentAvatar={pickerConfig?.currentUrl}
      />

      <section className="space-y-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-5">
            <button
              onClick={() =>
                setPickerConfig({
                  isOpen: true,
                  targetId: currentUser.id,
                  targetRole: 'ADMIN',
                  currentUrl: currentUser.avatar,
                })
              }
              className="relative group"
            >
              <img
                src={currentUser.avatar}
                className="w-20 h-20 rounded-3xl object-cover shadow-sm border border-slate-100"
              />
              <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <span className="text-white text-[10px] font-black uppercase">
                  {lang === 'ar' ? 'تغيير' : 'Change'}
                </span>
              </div>
            </button>
            <div className="text-right flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">
                    {lang === 'ar' ? 'ملف الأب' : 'Father Profile'}
                  </p>
                  <h3 className="text-xl font-black text-slate-900">{currentUser.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={openParentProfileEditor}
                  className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-800 hover:text-white transition-all"
                  title={lang === 'ar' ? 'تعديل ملف الأب' : 'Edit father profile'}
                >
                  <ICONS.Settings className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs font-bold text-slate-400">{currentUser.email || '-'}</p>
              <p className="text-[11px] font-bold text-slate-400">
                {currentUser.phone || (lang === 'ar' ? 'رقم الهاتف غير مضاف' : 'Phone number not set')}
              </p>
              <p className="text-[11px] font-bold text-slate-500 mt-1">
                {lang === 'ar'
                  ? 'اضغط على الصورة لتغيير أفاتار الأب مباشرة.'
                  : 'Click the picture to update father avatar.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {showParentProfileEditor && (
        <div className="fixed inset-0 z-[8700] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setShowParentProfileEditor(false)}
                className="p-3 bg-slate-100 text-slate-500 rounded-xl"
              >
                <ICONS.Close className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-black text-slate-900">
                {lang === 'ar' ? 'تعديل ملف الأب' : 'Edit Father Profile'}
              </h3>
            </div>

            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar' ? 'اسم الأب' : 'Father Name'}
                </label>
                <input
                  type="text"
                  value={parentProfileForm.name}
                  onChange={(e) =>
                    setParentProfileForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-base font-black text-slate-900 outline-none text-right"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="email"
                    value={parentProfileForm.email}
                    onChange={(e) =>
                      setParentProfileForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none text-right"
                    placeholder="name@example.com"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleSendParentContactVerificationCode('email');
                    }}
                    disabled={isProcessing || !emailVerificationRequired}
                    className="px-5 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'إرسال كود البريد' : 'Send email code'}
                  </button>
                </div>
                {emailVerificationRequired && (
                  <div className="space-y-2">
                    <div className="flex flex-col md:flex-row gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        value={parentEmailCodeInput}
                        onChange={(e) =>
                          setParentEmailCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none text-center tracking-[0.25em]"
                        placeholder={lang === 'ar' ? 'كود التحقق 6 أرقام' : '6-digit code'}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void handleVerifyParentContactCode('email');
                        }}
                        disabled={isProcessing || !emailVerificationState.code}
                        className="px-5 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
                      >
                        {lang === 'ar' ? 'توثيق البريد' : 'Verify email'}
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500">
                      {emailVerificationState.verified
                        ? lang === 'ar'
                          ? 'تم توثيق البريد الإلكتروني بنجاح.'
                          : 'Email verified successfully.'
                        : lang === 'ar'
                          ? 'يلزم توثيق البريد قبل الحفظ.'
                          : 'Email must be verified before saving.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                {!phoneRecaptchaReady && !smsGatewayConfigured && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-bold text-amber-800">
                      {lang === 'ar'
                        ? 'جار تهيئة التحقق الأمني (reCAPTCHA) لإرسال رسالة SMS فعلية عبر Firebase...'
                        : 'Initializing reCAPTCHA to send a real SMS through Firebase...'}
                    </p>
                  </div>
                )}
                {phoneRecaptchaError && !smsGatewayConfigured && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-[11px] font-bold text-red-700">
                      {lang === 'ar'
                        ? `تعذر تهيئة reCAPTCHA: ${phoneRecaptchaError}`
                        : `reCAPTCHA initialization failed: ${phoneRecaptchaError}`}
                    </p>
                  </div>
                )}
                <div id={phoneRecaptchaContainerId} className="min-h-[1px]" />
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="tel"
                    value={parentProfileForm.phone}
                    onChange={(e) =>
                      setParentProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none text-right"
                    placeholder="+974XXXXXXXX"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleSendParentContactVerificationCode('phone');
                    }}
                    disabled={
                      isProcessing ||
                      !phoneVerificationRequired ||
                      (!phoneRecaptchaReady && !smsGatewayConfigured)
                    }
                    className="px-5 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'إرسال كود SMS فعلي' : 'Send real SMS code'}
                  </button>
                </div>
                {phoneVerificationRequired && (
                  <div className="space-y-2">
                    <div className="flex flex-col md:flex-row gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        value={parentPhoneCodeInput}
                        onChange={(e) =>
                          setParentPhoneCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none text-center tracking-[0.25em]"
                        placeholder={lang === 'ar' ? 'كود التحقق 6 أرقام' : '6-digit code'}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void handleVerifyParentContactCode('phone');
                        }}
                        disabled={
                          isProcessing ||
                          (!phoneVerificationState.code && !phoneVerificationState.verificationId)
                        }
                        className="px-5 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
                      >
                        {lang === 'ar' ? 'توثيق الهاتف' : 'Verify phone'}
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500">
                      {phoneVerificationState.verified
                        ? lang === 'ar'
                          ? 'تم توثيق رقم الهاتف بنجاح.'
                          : 'Phone verified successfully.'
                        : phoneVerificationState.delivery === 'FIREBASE_PHONE_AUTH'
                          ? lang === 'ar'
                            ? 'أدخل الكود الحقيقي الذي وصلك على الهاتف ثم اضغط "توثيق الهاتف".'
                            : 'Enter the real SMS code you received, then press "Verify phone".'
                        : lang === 'ar'
                          ? 'يلزم توثيق رقم الهاتف قبل الحفظ.'
                          : 'Phone must be verified before saving.'}
                    </p>
                    {phoneVerificationState.delivery === 'DEV_FALLBACK' &&
                      Boolean(phoneVerificationState.code) && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                          <p className="text-[11px] font-bold text-amber-800">
                            {lang === 'ar'
                              ? 'هذا كود اختبار من بيئة التطوير. Firebase لم يرسل SMS حقيقي لهذا الرقم.'
                              : 'This is a development test code. Firebase did not send a real SMS to this number.'}
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs font-black tracking-[0.2em] text-amber-900">
                              {phoneVerificationState.code}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                void copyVerificationCode(phoneVerificationState.code);
                              }}
                              className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-black"
                            >
                              {lang === 'ar' ? 'نسخ الكود' : 'Copy code'}
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowParentProfileEditor(false)}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveParentProfile();
                }}
                disabled={isProcessing}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg disabled:opacity-50"
              >
                {lang === 'ar' ? 'حفظ ملف الأب' : 'Save father profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. قسم إدارة الأبناء */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              {lang === 'ar' ? 'إدارة الأبناء' : 'Manage Children'}
            </h3>
            <p className="text-slate-400 font-bold text-xs mt-1">
              اضغط على صورة الطفل لتغيير الأفاتار الخاص به.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* بطاقة إضافة ابن جديد */}
          <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border-2 border-dashed border-indigo-200 flex flex-col gap-4">
            <div className="flex gap-4 items-center">
              <button
                onClick={() =>
                  setPickerConfig({
                    isOpen: true,
                    targetId: 'NEW_CHILD',
                    currentUrl: newChildAvatar,
                  })
                }
                className="relative group flex-shrink-0"
              >
                <img
                  src={newChildAvatar}
                  className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-white"
                />
                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <span className="text-white text-[10px] font-black uppercase">تغيير</span>
                </div>
              </button>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'الاسم...' : 'Name...'}
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  className="flex-1 p-4 bg-white border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-right"
                />
                <input
                  type="number"
                  placeholder={lang === 'ar' ? 'العمر' : 'Age'}
                  value={newChildAge}
                  onChange={(e) => setNewChildAge(e.target.value)}
                  className="w-16 p-4 bg-white border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-center"
                />
              </div>
            </div>
            <button
              onClick={handleAddChildProfile}
              disabled={isProcessing || !newChildName}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {lang === 'ar' ? 'إضافة ابن جديد' : 'Add Child'}
            </button>
          </div>

          {/* عرض بطاقات الأبناء الحالية */}
          {children.map((child) => (
            <div key={child.id} className="space-y-3">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm group">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() =>
                      setPickerConfig({
                        isOpen: true,
                        targetId: child.id,
                        targetRole: 'CHILD',
                        currentUrl: child.avatar,
                      })
                    }
                    className="relative group"
                  >
                    <img
                      src={child.avatar}
                      className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-50"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <span className="text-white text-[10px] font-black uppercase">تغيير</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full"></div>
                  </button>
                  <div>
                    <p className="text-lg font-black text-slate-800">{child.name}</p>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                      {child.age} {lang === 'ar' ? 'سنة' : 'Years Old'}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                        {child.role === 'ADMIN'
                          ? lang === 'ar'
                            ? 'مدير'
                            : 'Manager'
                          : child.role === 'SUPERVISOR'
                            ? lang === 'ar'
                              ? 'مشرف'
                              : 'Supervisor'
                            : lang === 'ar'
                              ? 'طفل'
                              : 'Child'}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-lg ${child.status === 'online' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}
                      >
                        {child.status === 'online'
                          ? lang === 'ar'
                            ? 'متصل'
                            : 'Online'
                          : lang === 'ar'
                            ? 'غير متصل'
                            : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDelete({
                        kind: 'member',
                        source: 'child',
                        id: child.id,
                        role: 'CHILD',
                        label: child.name,
                      })
                    }
                    className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                    title={lang === 'ar' ? 'حذف الطفل' : 'Delete child'}
                  >
                    <ICONS.Trash className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openChildEditor(child)}
                    className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-700 hover:text-white transition-all"
                    title={lang === 'ar' ? 'تعديل البيانات' : 'Edit profile'}
                  >
                    <ICONS.Settings className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openLinkDeviceModal(child)}
                    className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                    title={lang === 'ar' ? 'ربط جهاز' : 'Link device'}
                  >
                    <ICONS.Devices className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {pendingDelete?.kind === 'member' &&
                pendingDelete.source === 'child' &&
                pendingDelete.id === child.id && (
                  <InlineDangerConfirm
                    message={`حذف نهائي للطفل ${pendingDelete.label}؟`}
                    onConfirm={() => {
                      void requireStepUp('SENSITIVE_SETTINGS', handleConfirmDelete);
                    }}
                    onCancel={() => setPendingDelete(null)}
                    disabled={isProcessing}
                  />
                )}
            </div>
          ))}
        </div>
      </section>

      {editingChild && (
        <div className="fixed inset-0 z-[8500] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setEditingChild(null)}
                className="p-3 bg-slate-100 text-slate-500 rounded-xl"
              >
                <ICONS.Close className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-black text-slate-900">
                {lang === 'ar' ? 'تعديل ملف الطفل' : 'Edit Child Profile'}
              </h3>
            </div>

            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar' ? 'الاسم المستعار' : 'Display Name'}
                </label>
                <input
                  value={editingChildForm.name}
                  onChange={(e) =>
                    setEditingChildForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black text-slate-900 outline-none text-right"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar' ? 'العمر' : 'Age'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={editingChildForm.age}
                  onChange={(e) =>
                    setEditingChildForm((prev) => ({ ...prev, age: e.target.value }))
                  }
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black text-slate-900 outline-none text-right"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar' ? 'اسم الجهاز' : 'Device Nickname'}
                </label>
                <input
                  value={editingChildForm.deviceNickname}
                  onChange={(e) =>
                    setEditingChildForm((prev) => ({
                      ...prev,
                      deviceNickname: e.target.value,
                    }))
                  }
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black text-slate-900 outline-none text-right"
                  placeholder={lang === 'ar' ? 'مثال: هاتف سارة' : 'Example: Sara phone'}
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar' ? 'الرتبة والصلاحية' : 'Rank & Permission'}
                </label>
                <div className="bg-slate-100 rounded-[2rem] p-2 grid grid-cols-3 gap-2">
                  {roleOptions.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setEditingChildForm((prev) => ({ ...prev, role: role.value }))}
                      className={`py-4 rounded-[1.3rem] font-black text-lg transition-all ${editingChildForm.role === role.value ? 'bg-indigo-600 text-white shadow-lg' : 'bg-transparent text-slate-500 hover:bg-white'}`}
                    >
                      {lang === 'ar' ? role.labelAr : role.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveChildEdit}
                disabled={isProcessing || !editingChildForm.name.trim()}
                className="w-full h-16 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lang === 'ar' ? 'حفظ التعديلات' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {linkingChild && (
        <div className="fixed inset-0 z-[8600] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setLinkingChild(null)}
                className="p-3 bg-slate-100 text-slate-500 rounded-xl"
              >
                <ICONS.Close className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-black text-slate-900">
                {lang === 'ar' ? 'ربط جهاز الطفل' : 'Link Child Device'}
              </h3>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
                <p className="text-sm text-slate-500 font-bold">
                  {lang === 'ar'
                    ? `استخدم هذا المفتاح في تطبيق الطفل لربط ${linkingChild.name}`
                    : `Use this key in child app to pair ${linkingChild.name}`}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <code className="flex-1 text-3xl font-mono font-black tracking-widest text-indigo-700">
                    {pairingKeyUi || '......'}
                  </code>
                  <button
                    type="button"
                    onClick={handleRegenerateKey}
                    className="p-3 bg-white rounded-xl border border-indigo-100 text-indigo-600"
                    title={lang === 'ar' ? 'تحديث المفتاح' : 'Refresh key'}
                  >
                    <ICONS.Refresh className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pairingKeyUi) {
                        navigator.clipboard.writeText(pairingKeyUi);
                        showSuccessToast(lang === 'ar' ? 'تم نسخ مفتاح الربط' : 'Pairing key copied');
                      }
                    }}
                    className="p-3 bg-white rounded-xl border border-indigo-100 text-indigo-600"
                    title={lang === 'ar' ? 'نسخ المفتاح' : 'Copy key'}
                  >
                    <ICONS.Rocket className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-400">
                  {lang === 'ar'
                    ? 'معرّف جهاز الطفل (UID) - ربط يدوي'
                    : 'Child device UID - manual link'}
                </label>
                <input
                  value={linkDeviceUid}
                  onChange={(e) => setLinkDeviceUid(e.target.value)}
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-slate-900 outline-none"
                  placeholder={lang === 'ar' ? 'أدخل UID الجهاز هنا' : 'Paste device UID here'}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveDeviceLink}
                disabled={isProcessing || !linkDeviceUid.trim()}
                className="w-full h-16 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lang === 'ar' ? 'حفظ الربط' : 'Save link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. قسم إدارة المشرفين */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900">{t.manageMembers}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border-2 border-dashed border-indigo-200 flex flex-col md:flex-row gap-4 items-center">
            <input
              type="email"
              placeholder={lang === 'ar' ? 'بريد الأم الإلكتروني...' : 'Mother email...'}
              value={newSupervisorEmail}
              onChange={(e) => setNewSupervisorEmail(e.target.value)}
              className="flex-1 p-5 bg-white border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-right"
            />
            <button
              onClick={handleAddSupervisor}
              disabled={isProcessing}
              className="px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all w-full md:w-auto"
            >
              {lang === 'ar' ? 'إرسال دعوة الأم' : 'Send mother invite'}
            </button>
          </div>

          {supervisors.map((sup) => (
            <div key={sup.id} className="space-y-3">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-5">
                  <button
                    onClick={() =>
                      setPickerConfig({
                        isOpen: true,
                        targetId: sup.id,
                        targetRole: 'SUPERVISOR',
                        currentUrl: sup.avatar,
                      })
                    }
                    className="relative group"
                  >
                    <img
                      src={sup.avatar}
                      className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-slate-50"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <span className="text-white text-[8px] font-black uppercase">تغيير</span>
                    </div>
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-black text-slate-800">{sup.name}</p>
                      {sup.inviteStatus === 'EMAIL_SENT' && (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          {lang === 'ar' ? 'بانتظار القبول' : 'Pending'}
                        </span>
                      )}
                      {sup.inviteStatus === 'ACCEPTED' && (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-green-100 text-green-700 border border-green-200">
                          {lang === 'ar' ? 'مفعّل' : 'Active'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">{sup.email}</p>
                    {sup.inviteStatus === 'EMAIL_SENT' && (
                      <p className="text-[9px] text-amber-500 mt-1">
                        {lang === 'ar' ? '📧 تم إرسال الدعوة — بانتظار تسجيل الأم' : '📧 Invitation sent — waiting for sign-up'}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({
                      kind: 'member',
                      source: 'supervisor',
                      id: sup.id,
                      role: 'SUPERVISOR',
                      label: sup.name || sup.email || 'مشرف',
                    })
                  }
                  className="p-4 text-slate-300 hover:text-red-600 transition-colors"
                >
                  <ICONS.Trash />
                </button>
              </div>
              {pendingDelete?.kind === 'member' &&
                pendingDelete.source === 'supervisor' &&
                pendingDelete.id === sup.id && (
                  <InlineDangerConfirm
                    message={`حذف نهائي للمشرف ${pendingDelete.label}؟`}
                    onConfirm={() => {
                      void requireStepUp('SENSITIVE_SETTINGS', handleConfirmDelete);
                    }}
                    onCancel={() => setPendingDelete(null)}
                    disabled={isProcessing}
                  />
                )}
            </div>
          ))}
        </div>
      </section>

      {/* 2.5 قسم تفعيل المميزات (Feature Toggles) */}
      <section dir="rtl" className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
        <div className="flex justify-between items-center border-b border-slate-50 pb-6">
          <div className="text-right">
            <h3 className="text-2xl font-black text-slate-800">مميزات التطبيق</h3>
            <p className="text-slate-400 font-bold text-xs">تفعيل أو تعطيل وظائف النظام الأساسية.</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
            🚀
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Live Monitor */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.liveMonitor !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.liveMonitor`]: currentUser.enabledFeatures?.liveMonitor === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.liveMonitor !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">المراقبة الحية</span>
              <div className="order-1 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center"><ICONS.LiveCamera className="w-4 h-4" /></div>
            </div>
          </div>

          {/* Evidence Vault */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.evidenceVault !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.evidenceVault`]: currentUser.enabledFeatures?.evidenceVault === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.evidenceVault !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">خزنة الأدلة</span>
              <div className="order-1 w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center"><ICONS.Vault className="w-4 h-4" /></div>
            </div>
          </div>

          {/* Location Tracking */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.locationTracking !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.locationTracking`]: currentUser.enabledFeatures?.locationTracking === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.locationTracking !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">تتبع الموقع</span>
              <div className="order-1 w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><ICONS.Location className="w-4 h-4" /></div>
            </div>
          </div>

          {/* Psychological Analysis */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.psychAnalysis !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.psychAnalysis`]: currentUser.enabledFeatures?.psychAnalysis === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.psychAnalysis !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">التحليل النفسي</span>
              <div className="order-1 w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center"><ICONS.Pulse className="w-4 h-4" /></div>
            </div>
          </div>

          {/* Web Filtering */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.webFiltering !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.webFiltering`]: currentUser.enabledFeatures?.webFiltering === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.webFiltering !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">فلترة الويب</span>
              <div className="order-1 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><ICONS.Globe className="w-4 h-4" /></div>
            </div>
          </div>

          {/* App Blocking */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.appBlocking !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.appBlocking`]: currentUser.enabledFeatures?.appBlocking === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.appBlocking !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">حظر التطبيقات</span>
              <div className="order-1 w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center"><ICONS.Apps className="w-4 h-4" /></div>
            </div>
          </div>

          {/* Chat Monitoring */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.chatMonitoring !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.chatMonitoring`]: currentUser.enabledFeatures?.chatMonitoring === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.chatMonitoring !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">مراقبة المحادثات</span>
              <div className="order-1 w-8 h-8 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center"><ICONS.Chat className="w-4 h-4" /></div>
            </div>
          </div>

          {/* Auto Lock in Automation */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="order-2 relative w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.enabledFeatures?.autoLockInAutomation !== false}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { [`enabledFeatures.autoLockInAutomation`]: currentUser.enabledFeatures?.autoLockInAutomation === false })}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.enabledFeatures?.autoLockInAutomation !== false ? '-translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="order-1 flex items-center gap-3">
              <span className="order-2 font-black text-slate-700 text-sm text-right">القفل التلقائي في البروتوكولات</span>
              <div className="order-1 w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center"><ICONS.ShieldCheck className="w-4 h-4" /></div>
            </div>
          </div>

          <div className="md:col-span-2 rounded-[2rem] border border-rose-100 bg-rose-50/60 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-right">
                <p className="text-sm font-black text-rose-800">تعطيل جميع الأقفال (وضع المطور)</p>
                <p className="text-[11px] font-bold text-rose-600">
                  {isAllLocksDisableActive
                    ? isLockDisablePermanentActive
                      ? 'الحالة: تعطيل دائم مفعل'
                      : `الحالة: تعطيل مؤقت مفعل حتى ${lockDisableUntilLabel}`
                    : 'الحالة: الأقفال مفعلة بشكل طبيعي'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <ICONS.ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setTemporaryLockDisable(15)}
                disabled={isProcessing}
                className="py-2 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-black disabled:opacity-50"
              >
                تعطيل 15 دقيقة
              </button>
              <button
                type="button"
                onClick={() => setTemporaryLockDisable(60)}
                disabled={isProcessing}
                className="py-2 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-black disabled:opacity-50"
              >
                تعطيل 60 دقيقة
              </button>
              <button
                type="button"
                onClick={() => setTemporaryLockDisable(480)}
                disabled={isProcessing}
                className="py-2 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-black disabled:opacity-50"
              >
                تعطيل 8 ساعات
              </button>
              <button
                type="button"
                onClick={() => void requireStepUp('SENSITIVE_SETTINGS', togglePermanentLockDisable)}
                disabled={isProcessing}
                className={`py-2 rounded-xl text-xs font-black disabled:opacity-50 ${
                  isLockDisablePermanentActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {isLockDisablePermanentActive ? 'إلغاء التعطيل الدائم' : 'تعطيل دائم'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void requireStepUp('SENSITIVE_SETTINGS', reactivateAllLocks)}
              disabled={isProcessing || !isAllLocksDisableActive}
              className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-black disabled:opacity-40"
            >
              إعادة تفعيل جميع الأقفال الآن
            </button>
          </div>

        </div>
      </section>

      {/* 3. قسم أمان الحساب (Redesigned) */}
      <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
        <div className="flex justify-between items-center border-b border-slate-50 pb-6">
          <div className="text-right">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2 justify-end">
              <span>{t.securityPrivacy}</span>
              <span className="text-xl">🔐🔐</span>
            </h3>
          </div>
        </div>

        <div className="space-y-6">
          {/* Push Notifications */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="relative w-14 h-8 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={currentUser.pushEnabled === true}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { pushEnabled: !currentUser.pushEnabled })}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.pushEnabled ? '-translate-x-6' : 'translate-x-0'}`} />
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                <h4 className="font-black text-slate-800 text-sm">تنبيهات فورية (Push)</h4>
                <p className="text-[10px] font-bold text-slate-400">استقبال تنبيهات التهديدات فورياً</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center">
                <ICONS.Bell className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Biometric */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem]">
            <div className="relative w-14 h-8 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={!!currentUser.biometricId}
              onClick={() => onUpdateMember(currentUser.id, 'ADMIN', { biometricId: currentUser.biometricId ? null : 'bio_enabled' })}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.biometricId ? '-translate-x-6' : 'translate-x-0'}`} />
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                <h4 className="font-black text-slate-800 text-sm">البصمة البيومترية</h4>
                <p className="text-[10px] font-bold text-slate-400">الدخول بالبصمة أو الوجه</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                <ICONS.Fingerprint className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 2FA */}
          <div className="flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
            <div className="relative w-14 h-8 bg-slate-200 rounded-full p-1 cursor-pointer transition-colors duration-300 data-[on=true]:bg-indigo-600"
              data-on={!!currentUser.twoFASecret}
              onClick={() => {
                if (currentUser.twoFASecret) {
                  // Disable logic
                  if (window.confirm('هل تريد تعطيل المصادقة الثنائية؟')) {
                    onUpdateMember(currentUser.id, 'ADMIN', { twoFASecret: null });
                  }
                } else {
                  handleStart2FA();
                }
              }}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${currentUser.twoFASecret ? '-translate-x-6' : 'translate-x-0'}`} />
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                <h4 className="font-black text-slate-800 text-sm">المصادقة الثنائية (2FA)</h4>
                <p className="text-[10px] font-bold text-slate-400">الربط مع Google Authenticator</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <ICONS.Shield className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Change Password (Preserved at bottom) */}
          <div className="w-full pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowPassForm(!showPassForm)}
              className="w-full p-4 bg-white border border-slate-200 rounded-[1.5rem] flex items-center justify-between hover:bg-slate-50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg grayscale group-hover:grayscale-0 transition-all">🔑</span>
                <span className="font-black text-slate-600 text-xs">{t.changePass}</span>
              </div>
              <span
                className={`transform transition-transform text-slate-400 ${showPassForm ? 'rotate-180' : ''}`}
              >
                ▼
              </span>
            </button>

            {showPassForm && (
              <div className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 space-y-3 mt-2 animate-in slide-in-from-top-2">
                <input
                  type="password"
                  placeholder={t.currentPass}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none text-xs text-right font-bold"
                />
                <input
                  type="password"
                  placeholder={t.newPass}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none text-xs text-right font-bold"
                />
                <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-colors">
                  {t.saveChanges}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* نافذة إعداد الـ 2FA */}
      {show2FASetup && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg animate-in fade-in">
          <div className="bg-[#0f172a] w-full max-w-sm rounded-[3rem] text-white border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-white/5 flex-shrink-0">
              <button
                onClick={() => setShow2FASetup(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-all order-1"
              >
                <ICONS.Close className="w-5 h-5 text-slate-400" />
              </button>
              <h4 className="font-black text-md order-2">{t.setup2FA}</h4>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col items-center">
              <div className="bg-white p-4 rounded-[2rem] shadow-2xl">
                <img
                  src={getQRCodeUrl(currentUser.email || 'user', tempSecret)}
                  className="w-40 h-40"
                  alt="QR"
                />
              </div>

              <p className="text-[10px] font-bold text-slate-400 text-center leading-relaxed max-w-[220px]">
                {t.scanQRCode} <br />{' '}
                <span className="text-indigo-400 uppercase tracking-widest">
                  Google Authenticator
                </span>
              </p>

              <div className="w-full space-y-3">
                <p className="text-[9px] font-black text-slate-500 text-center uppercase tracking-widest">
                  أو أدخل الكود يدوياً
                </p>
                <div className="bg-black/40 rounded-2xl border border-white/10 p-5 space-y-4 relative">
                  <code className="block text-center text-sm font-mono font-black text-[#D1A23D] break-all leading-relaxed px-2">
                    {tempSecret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/5"
                  >
                    <span className="text-xs">📋</span>
                    <span className="text-[10px] font-black uppercase">نسخ المفتاح</span>
                  </button>
                </div>
              </div>

              <div className="w-full space-y-4 pt-2">
                <div className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-5 bg-transparent text-center font-mono font-black text-3xl outline-none text-white tracking-[0.3em]"
                  />
                </div>
                <button
                  onClick={handleVerify2FA}
                  disabled={isVerifying || verifyCode.length !== 6}
                  className="w-full h-16 bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center"
                >
                  {isVerifying ? '...' : t.verify}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. بروتوكول العرض الأمني */}
      <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
        <div className="flex justify-between items-center border-b border-slate-50 pb-6">
          <div className="text-right">
            <h3 className="text-2xl font-black text-slate-800">بروتوكول العرض الأمني</h3>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-2xl">
            📡
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => updateProtocol('FULL')}
            className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${currentProtocol === 'FULL' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-transparent text-slate-400 opacity-60'}`}
          >
            <span className="text-3xl">🚨</span>
            <p className="font-black text-[10px]">شاشة طوارئ</p>
          </button>
          <button
            onClick={() => updateProtocol('SIMPLE')}
            className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${currentProtocol === 'SIMPLE' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-400 opacity-60'}`}
          >
            <span className="text-3xl">🔔</span>
            <p className="font-black text-[10px]">إشعارات فقط</p>
          </button>
          <button
            onClick={() => updateProtocol('NONE')}
            className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${currentProtocol === 'NONE' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-transparent text-slate-400 opacity-60'}`}
          >
            <span className="text-3xl">🔕</span>
            <p className="font-black text-[10px]">صامت</p>
          </button>
        </div>
      </section>

      {/* 5. مفتاح الربط (Dynamic & QR) */}
      <section className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl">
            🔑
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#D1A23D]">مفتاح الربط</h3>
            <p className="text-slate-400 font-bold text-xs mt-1">امسح الرمز أو أدخل الكود لربط جهاز الطفل.</p>
          </div>

          <div className="bg-white p-4 rounded-3xl shadow-lg">
            <QRCodeSVG
              value={`AMANAH_PAIRING:${pairingKeyUi}`}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 flex items-center gap-6">
            <code className="text-4xl font-mono font-black tracking-widest text-[#D1A23D]">{pairingKeyUi || '....'}</code>
            <button
              onClick={handleRegenerateKey}
              disabled={isProcessing}
              className="p-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all hover:rotate-180 duration-500"
              title="تحديث المفتاح"
            >
              <ICONS.Refresh className="w-6 h-6" />
            </button>
            <button
              onClick={() => {
                if (pairingKeyUi) {
                  navigator.clipboard.writeText(pairingKeyUi);
                  showSuccessToast('تم النسخ!');
                }
              }}
              className="p-3 bg-white/5 rounded-xl text-[#D1A23D]"
            >
              <ICONS.Rocket className="w-6 h-6" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">
            يتم تحديث الكود تلقائياً كل 10 دقائق
          </p>
        </div>
      </section>

      {/* 6. عرض الأجهزة */}
      <section className="space-y-4">
        <h3 className="text-xl font-black text-slate-900 px-4">{t.devices}</h3>
        <div className="grid grid-cols-1 gap-4">
          {children.map((child) => (
            <div key={child.id} className="space-y-3">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm border-r-8 border-r-emerald-500">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                    📱
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">{child.name}</p>
                    <p className="text-md font-black text-slate-800">Connected</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({
                      kind: 'member',
                      source: 'device',
                      id: child.id,
                      role: 'CHILD',
                      label: child.name,
                    })
                  }
                  className="p-4 text-slate-300 hover:text-red-600 transition-colors"
                >
                  <ICONS.Trash />
                </button>
              </div>
              {pendingDelete?.kind === 'member' &&
                pendingDelete.source === 'device' &&
                pendingDelete.id === child.id && (
                  <InlineDangerConfirm
                    message={`حذف نهائي للجهاز المرتبط بـ ${pendingDelete.label}؟`}
                    onConfirm={() => {
                      void requireStepUp('SENSITIVE_SETTINGS', handleConfirmDelete);
                    }}
                    onCancel={() => setPendingDelete(null)}
                    disabled={isProcessing}
                  />
                )}
            </div>
          ))}
        </div>
      </section>

      {/* 7. البيانات التجريبية */}
      <section className="bg-indigo-50 rounded-[2.5rem] p-8 border border-indigo-100 space-y-6">
        <div className="text-right">
          <h3 className="text-xl font-black text-indigo-900">
            {lang === 'ar' ? 'البيانات الوهمية للتجربة' : 'Mock Data Lab'}
          </h3>
          <p className="text-indigo-600 font-bold text-xs">
            {lang === 'ar'
              ? 'اختر الأنواع المطلوبة ثم نفّذ حقن أو حذف البيانات الوهمية.'
              : 'Select domains then inject or delete mock data.'}
          </p>
          <p className={`mt-2 text-[11px] font-black ${mockOpsEnabled ? 'text-emerald-600' : 'text-amber-700'}`}>
            {mockOpsEnabled
              ? lang === 'ar'
                ? 'حالة البيئة: عمليات Mock مفعّلة.'
                : 'Environment status: mock operations are enabled.'
              : lang === 'ar'
                ? 'حالة البيئة: عمليات Mock معطلة. فعّل Emulator أو VITE_ALLOW_LIVE_MOCK_MUTATIONS=true.'
                : 'Environment status: mock operations are disabled. Enable emulator or VITE_ALLOW_LIVE_MOCK_MUTATIONS=true.'}
          </p>
        </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-indigo-200 bg-white p-4 text-xs font-black text-slate-700 space-y-1">
              <p>
                {lang === 'ar'
                  ? `Emulator: ${mockEnvEmulatorEnabled ? 'مفعّل' : 'غير مفعّل'}`
                  : `Emulator: ${mockEnvEmulatorEnabled ? 'Enabled' : 'Disabled'}`}
              </p>
              <p>
                {lang === 'ar'
                  ? `Env default (VITE_ALLOW_LIVE_MOCK_MUTATIONS): ${mockEnvLiveEnabled ? 'مفعّل' : 'غير مفعّل'}`
                  : `Env default (VITE_ALLOW_LIVE_MOCK_MUTATIONS): ${mockEnvLiveEnabled ? 'Enabled' : 'Disabled'}`}
              </p>
              <p>
                {lang === 'ar'
                  ? `Runtime override: ${mockRuntimeOverride === null ? 'اتباع env' : mockRuntimeOverride ? 'مفعّل' : 'معطّل'}`
                  : `Runtime override: ${mockRuntimeOverride === null ? 'Use env default' : mockRuntimeOverride ? 'Enabled' : 'Disabled'}`}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-white p-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetMockRuntimeOverride(true)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black border transition-all ${
                  mockRuntimeOverride === true
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {lang === 'ar' ? 'تفعيل الآن' : 'Enable now'}
              </button>
              <button
                type="button"
                onClick={() => handleSetMockRuntimeOverride(false)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black border transition-all ${
                  mockRuntimeOverride === false
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {lang === 'ar' ? 'تعطيل الآن' : 'Disable now'}
              </button>
              <button
                type="button"
                onClick={() => handleSetMockRuntimeOverride(null)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black border transition-all ${
                  mockRuntimeOverride === null
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
              >
                {lang === 'ar' ? 'افتراضي البيئة' : 'Use env default'}
              </button>
            </div>
          </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <p className="md:col-span-3 text-[11px] font-bold text-indigo-700">
            {lang === 'ar'
              ? 'ملاحظة: "تشغيل متقدم" قد يحتاج صلاحيات Firestore أوسع؛ وهو غير محدد افتراضيًا لتفادي فشل الحقن الكامل.'
              : 'Note: "Advanced Ops" may require wider Firestore permissions; it is unselected by default to avoid full inject failure.'}
          </p>
          <button
            type="button"
            onClick={toggleAllMockDomains}
            className={`p-4 rounded-2xl border-2 font-black text-sm transition-all ${isAllMockDomainsSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-indigo-100'}`}
          >
            {lang === 'ar'
              ? isAllMockDomainsSelected
                ? 'إلغاء تحديد الكل'
                : 'تحديد الكل'
              : isAllMockDomainsSelected
                ? 'Unselect all'
                : 'Select all'}
          </button>
          {mockDomainOptions.map((option) => {
            const active = selectedMockDomains.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleMockDomain(option.key)}
                className={`p-4 rounded-2xl border-2 font-black text-sm transition-all ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-indigo-100'}`}
              >
                {lang === 'ar' ? option.ar : option.en}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void requireStepUp('SENSITIVE_SETTINGS', handleInjectMockData);
            }}
            disabled={isProcessing || selectedMockDomains.length === 0 || !mockOpsEnabled}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
          >
            {lang === 'ar' ? 'حقن بيانات وهمية' : 'Inject mock data'}
          </button>
          <button
            type="button"
            onClick={() => {
              void requireStepUp('SENSITIVE_SETTINGS', handleClearMockData);
            }}
            disabled={isProcessing || selectedMockDomains.length === 0 || !mockOpsEnabled}
            className="px-8 py-4 bg-white text-indigo-700 rounded-2xl font-black text-xs shadow-lg border border-indigo-200 disabled:opacity-50"
          >
            {lang === 'ar' ? 'حذف البيانات الوهمية المحددة' : 'Delete selected mock data'}
          </button>
          <button
            type="button"
            onClick={handleVerifyMockCleanup}
            disabled={isProcessing || selectedMockDomains.length === 0}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
          >
            {lang === 'ar' ? 'تحقق من التنظيف' : 'Verify cleanup'}
          </button>
        </div>

        {lastMockOperation && (
          <div className="bg-white rounded-[2rem] border border-indigo-100 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-800">
                {lang === 'ar'
                  ? `آخر عملية: ${lastMockOperation.mode === 'inject' ? 'حقن' : 'حذف'}`
                  : `Last Operation: ${lastMockOperation.mode === 'inject' ? 'Inject' : 'Delete'}`}
              </p>
              <p className="text-xs font-black text-indigo-600">
                {lang === 'ar'
                  ? `الإجمالي: ${lastMockOperation.total}`
                  : `Total: ${lastMockOperation.total}`}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {MOCK_DATA_DOMAINS.map((domain) => (
                <div
                  key={domain}
                  className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                >
                  <span className="text-xs font-black text-slate-600">{mockDomainLabelMap[domain]}</span>
                  <span className="text-sm font-black text-indigo-700">
                    {lastMockOperation.result[domain] || 0}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-bold text-slate-400">
              {lang === 'ar'
                ? `وقت التنفيذ: ${formatTimeDefault(lastMockOperation.at, { includeSeconds: true })}`
                : `Executed at: ${formatTimeDefault(lastMockOperation.at, { includeSeconds: true })}`}
            </p>
          </div>
        )}

        {mockCleanupReport && (
          <div
            className={`rounded-[2rem] border p-5 space-y-3 ${mockCleanupReport.clean ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={`text-sm font-black ${mockCleanupReport.clean ? 'text-emerald-800' : 'text-amber-800'}`}>
                {mockCleanupReport.clean
                  ? lang === 'ar'
                    ? 'نتيجة التحقق: لا توجد بقايا Mock.'
                    : 'Verification result: no mock residue.'
                  : lang === 'ar'
                    ? 'نتيجة التحقق: توجد بقايا Mock تحتاج تنظيفًا.'
                    : 'Verification result: mock residue is still present.'}
              </p>
              <p className={`text-xs font-black ${mockCleanupReport.clean ? 'text-emerald-700' : 'text-amber-700'}`}>
                {lang === 'ar' ? `إجمالي البقايا: ${mockCleanupReport.total}` : `Total residue: ${mockCleanupReport.total}`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {MOCK_DATA_DOMAINS.map((domain) => (
                <div
                  key={`verify-${domain}`}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between"
                >
                  <span className="text-xs font-black text-slate-600">{mockDomainLabelMap[domain]}</span>
                  <span className="text-sm font-black text-slate-800">
                    {mockCleanupReport.counts[domain] || 0}
                  </span>
                </div>
              ))}
            </div>

            {mockCleanupReport.inaccessible.length > 0 && (
              <p className="text-[11px] font-black text-amber-800">
                {lang === 'ar'
                  ? `تعذر التحقق من بعض النطاقات بسبب الصلاحيات: ${mockCleanupReport.inaccessible.map((domain) => mockDomainLabelMap[domain]).join(', ')}`
                  : `Could not verify some domains due to permissions: ${mockCleanupReport.inaccessible.map((domain) => mockDomainLabelMap[domain]).join(', ')}`}
              </p>
            )}

            <p className="text-[10px] font-bold text-slate-500">
              {lang === 'ar'
                ? `وقت التحقق: ${formatDateTimeDefault(mockCleanupReport.checkedAt, { includeSeconds: true })}`
                : `Verified at: ${formatDateTimeDefault(mockCleanupReport.checkedAt, { includeSeconds: true })}`}
            </p>
          </div>
        )}
      </section>

      {/* 8. Sensitive Actions Zone */}
      <section className="bg-red-50 rounded-[2.5rem] p-8 border-2 border-dashed border-red-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-right">
          <h3 className="text-xl font-black text-red-900">
            {lang === 'ar' ? 'منطقة الإجراءات الحساسة' : 'Sensitive Actions Zone'}
          </h3>
          <p className="text-red-600 font-bold text-xs">
            {lang === 'ar'
              ? 'سجّل خروجك بأمان أو احذف كل البيانات الوهمية دفعة واحدة (لا يشمل بياناتك الحقيقية).'
              : 'Sign out safely or purge all mock data at once (real data is not affected).'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await logoutUser();
            }}
            disabled={isProcessing}
            className="px-8 py-4 bg-white text-slate-700 rounded-2xl font-black text-xs shadow-lg border border-slate-200"
          >
            {lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete({ kind: 'purge', source: 'purge' })}
            disabled={isProcessing || !mockOpsEnabled}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg"
          >
            {lang === 'ar' ? 'حذف كل البيانات الوهمية' : 'Delete all mock data'}
          </button>
        </div>
        {pendingDelete?.kind === 'purge' && pendingDelete.source === 'purge' && (
          <div className="w-full md:w-auto md:min-w-[520px]">
            <InlineDangerConfirm
              message={
                lang === 'ar'
                  ? 'هل تريد حذف كل البيانات الوهمية الآن؟'
                  : 'Do you want to delete all mock data now?'
              }
              confirmLabel={
                lang === 'ar' ? 'نعم، احذف البيانات الوهمية' : 'Yes, delete mock data'
              }
              onConfirm={() => {
                void requireStepUp('SENSITIVE_SETTINGS', handleConfirmDelete);
              }}
              onCancel={() => setPendingDelete(null)}
              disabled={isProcessing}
            />
          </div>
        )}
      </section>
      {stepUpModal}
    </div>
  );
};

const InlineDangerConfirm: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  confirmLabel?: string;
}> = ({ message, onConfirm, onCancel, disabled = false, confirmLabel = 'نعم، احذف' }) => (
  <div className="bg-red-600 rounded-[2.5rem] p-6 border border-red-500 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in fade-in">
    <p className="text-white font-black text-xl md:text-3xl tracking-tight text-right">{message}</p>
    <div className="flex items-center gap-3 shrink-0">
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="px-8 py-3 bg-white text-red-700 rounded-2xl font-black text-lg shadow-lg disabled:opacity-50"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="px-8 py-3 bg-red-700 text-white rounded-2xl font-black text-lg disabled:opacity-50"
      >
        إلغاء
      </button>
    </div>
  </div>
);

export default SettingsView;
