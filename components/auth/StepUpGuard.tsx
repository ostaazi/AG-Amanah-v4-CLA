import React, { useMemo, useRef, useState } from 'react';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { verifyTOTP } from '../../services/twoFAService';
import { ParentAccount, StepUpSession } from '../../types';
import StepUpModal from '../stepup/StepUpModal';

type GuardedAction = () => void | Promise<void>;

interface StepUpGuardProps {
  lang: 'ar' | 'en';
  currentUser: ParentAccount;
  onBypass?: (message: string) => void;
  children: (
    requireStepUp: (reason: StepUpSession['reason'], action: GuardedAction) => Promise<void>
  ) => React.ReactNode;
}

export const STEP_UP_SESSION_TTL_MS = 10 * 60 * 1000;

export const makeStepUpSessionKey = (parentId: string, reason: StepUpSession['reason']) =>
  `amanah_stepup_${parentId}_${reason}`;

export const readStepUpSessionExpiry = (key: string): number => {
  if (typeof window === 'undefined') return 0;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isStepUpSessionValid = (key: string): boolean => {
  const expiry = readStepUpSessionExpiry(key);
  return expiry > Date.now();
};

export const writeStepUpSession = (key: string): void => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, String(Date.now() + STEP_UP_SESSION_TTL_MS));
};

export const useStepUpGuard = ({
  lang,
  currentUser,
  onBypass,
}: Omit<StepUpGuardProps, 'children'>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState<StepUpSession['reason']>(
    'SENSITIVE_SETTINGS'
  );
  const pendingActionRef = useRef<GuardedAction | null>(null);

  const closeModal = () => {
    setIsOpen(false);
    setIsBusy(false);
    setError(null);
    pendingActionRef.current = null;
  };

  const runDirect = async (action: GuardedAction): Promise<void> => {
    await Promise.resolve(action());
  };

  const requireStepUp = async (
    reason: StepUpSession['reason'],
    action: GuardedAction
  ): Promise<void> => {
    const flagEnabled = FEATURE_FLAGS.stepUpSecurity;
    const has2FASecret = Boolean(currentUser.twoFASecret);

    if (!flagEnabled) {
      await runDirect(action);
      return;
    }

    if (!has2FASecret) {
      onBypass?.(
        lang === 'ar'
          ? 'Step-Up متجاوز لأن المصادقة الثنائية غير مفعلة بعد.'
          : 'Step-up bypassed because two-factor authentication (2FA) is not enabled yet.'
      );
      await runDirect(action);
      return;
    }

    const sessionKey = makeStepUpSessionKey(currentUser.id, reason);
    if (isStepUpSessionValid(sessionKey)) {
      await runDirect(action);
      return;
    }

    pendingActionRef.current = action;
    setPendingReason(reason);
    setError(null);
    setIsOpen(true);
  };

  const handleVerify = async (code: string) => {
    if (!currentUser.twoFASecret) {
      setError(
        lang === 'ar'
          ? 'لا يوجد سر مصادقة ثنائية مرتبط بالحساب.'
          : 'No two-factor authentication (2FA) secret is linked to this account.'
      );
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const isValid = await verifyTOTP(currentUser.twoFASecret, code);
      if (!isValid) {
        setError(lang === 'ar' ? 'رمز التحقق غير صحيح.' : 'Invalid verification code.');
        return;
      }

      const sessionKey = makeStepUpSessionKey(currentUser.id, pendingReason);
      writeStepUpSession(sessionKey);

      const action = pendingActionRef.current;
      closeModal();
      if (action) {
        await runDirect(action);
      }
    } catch (e) {
      console.error('Step-up verification failed', e);
      setError(
        lang === 'ar'
          ? 'تعذر إتمام التحقق الإضافي. حاول مرة أخرى.'
          : 'Could not complete additional verification. Please retry.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const modal = useMemo(
    () => (
      <StepUpModal
        isOpen={isOpen}
        lang={lang}
        reason={pendingReason}
        isBusy={isBusy}
        error={error}
        onClose={closeModal}
        onVerify={handleVerify}
      />
    ),
    [error, handleVerify, isBusy, isOpen, lang, pendingReason]
  );

  return {
    requireStepUp,
    modal,
  };
};

const StepUpGuard: React.FC<StepUpGuardProps> = ({ lang, currentUser, onBypass, children }) => {
  const { requireStepUp, modal } = useStepUpGuard({ lang, currentUser, onBypass });

  return (
    <>
      {children(requireStepUp)}
      {modal}
    </>
  );
};

export default StepUpGuard;
