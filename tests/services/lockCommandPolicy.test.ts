import { describe, expect, it } from 'vitest';
import {
  isLockEnableRequest,
  shouldBlockLockActivation,
} from '../../services/lockCommandPolicy';

describe('lockCommandPolicy', () => {
  it('blocks lockDevice activation when all locks are disabled', () => {
    expect(shouldBlockLockActivation(true, 'lockDevice', true)).toBe(true);
  });

  it('allows lockDevice unlock when all locks are disabled', () => {
    expect(shouldBlockLockActivation(true, 'lockDevice', false)).toBe(false);
  });

  it('blocks lockscreenBlackout activation when all locks are disabled', () => {
    expect(
      shouldBlockLockActivation(true, 'lockscreenBlackout', {
        enabled: true,
        message: 'lock',
      })
    ).toBe(true);
  });

  it('allows lockscreenBlackout disable when all locks are disabled', () => {
    expect(
      shouldBlockLockActivation(true, 'lockscreenBlackout', {
        enabled: false,
        message: '',
      })
    ).toBe(false);
  });

  it('allows lock commands when global lock disable is off', () => {
    expect(shouldBlockLockActivation(false, 'lockDevice', true)).toBe(false);
    expect(shouldBlockLockActivation(false, 'lockscreenBlackout', { enabled: true })).toBe(false);
  });

  it('parses nested blackout payload enable state', () => {
    expect(isLockEnableRequest('lockscreenBlackout', { value: { enabled: true } })).toBe(true);
    expect(isLockEnableRequest('lockscreenBlackout', { value: { enabled: false } })).toBe(false);
  });
});
