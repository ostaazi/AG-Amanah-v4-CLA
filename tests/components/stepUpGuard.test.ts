import { describe, expect, it } from 'vitest';
import {
  isStepUpSessionValid,
  makeStepUpSessionKey,
  readStepUpSessionExpiry,
  STEP_UP_SESSION_TTL_MS,
  writeStepUpSession,
} from '../../components/auth/StepUpGuard';

describe('StepUpGuard helpers', () => {
  it('builds stable session keys', () => {
    const key = makeStepUpSessionKey('parent-1', 'EXPORT_EVIDENCE');
    expect(key).toBe('amanah_stepup_parent-1_EXPORT_EVIDENCE');
  });

  it('writes and validates session window', () => {
    const key = makeStepUpSessionKey('parent-2', 'DELETE_EVIDENCE');
    sessionStorage.removeItem(key);

    writeStepUpSession(key);

    const expiry = readStepUpSessionExpiry(key);
    expect(expiry).toBeGreaterThan(Date.now());
    expect(expiry - Date.now()).toBeLessThanOrEqual(STEP_UP_SESSION_TTL_MS + 2000);
    expect(isStepUpSessionValid(key)).toBe(true);
  });

  it('returns false for expired or malformed sessions', () => {
    const expiredKey = makeStepUpSessionKey('parent-3', 'SENSITIVE_SETTINGS');
    sessionStorage.setItem(expiredKey, String(Date.now() - 1000));
    expect(isStepUpSessionValid(expiredKey)).toBe(false);

    const malformedKey = makeStepUpSessionKey('parent-4', 'LOCKDOWN');
    sessionStorage.setItem(malformedKey, 'invalid-number');
    expect(readStepUpSessionExpiry(malformedKey)).toBe(0);
    expect(isStepUpSessionValid(malformedKey)).toBe(false);
  });
});
