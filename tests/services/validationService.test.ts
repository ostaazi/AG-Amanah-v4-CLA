import { describe, expect, it } from 'vitest';
import { ValidationService } from '../../services/validationService';

describe('ValidationService.validateCommand', () => {
  it('accepts lockscreenBlackout payload', () => {
    const result = ValidationService.validateCommand('lockscreenBlackout', {
      enabled: true,
      message: 'Safety lock enabled',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid lockscreenBlackout payload', () => {
    const result = ValidationService.validateCommand('lockscreenBlackout', {
      enabled: 'yes',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts walkieTalkieEnable payload', () => {
    const result = ValidationService.validateCommand('walkieTalkieEnable', {
      enabled: true,
      source: 'mic',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects walkieTalkieEnable with invalid source', () => {
    const result = ValidationService.validateCommand('walkieTalkieEnable', {
      enabled: true,
      source: 'speaker',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts international phone number format', () => {
    expect(ValidationService.isValidPhoneNumber('+97333112233')).toBe(true);
  });

  it('rejects malformed phone number', () => {
    expect(ValidationService.isValidPhoneNumber('03-3311')).toBe(false);
  });
});

describe('ValidationService.validateAlert', () => {
  it('accepts a valid alert with type and severity', () => {
    const result = ValidationService.validateAlert({ type: 'BULLYING', severity: 'HIGH' });
    expect(result.valid).toBe(true);
  });

  it('rejects alert missing type', () => {
    const result = ValidationService.validateAlert({ severity: 'HIGH' });
    expect(result.valid).toBe(false);
  });

  it('rejects alert with invalid severity value', () => {
    const result = ValidationService.validateAlert({ type: 'SCAM', severity: 'EXTREME' });
    expect(result.valid).toBe(false);
  });

  it('accepts alert with valid confidence', () => {
    const result = ValidationService.validateAlert({ type: 'PREDATOR', severity: 'CRITICAL', confidence: 85 });
    expect(result.valid).toBe(true);
  });

  it('rejects alert with confidence out of range', () => {
    const result = ValidationService.validateAlert({ type: 'PREDATOR', severity: 'CRITICAL', confidence: 150 });
    expect(result.valid).toBe(false);
  });

  it('rejects alert with negative confidence', () => {
    const result = ValidationService.validateAlert({ type: 'PREDATOR', severity: 'CRITICAL', confidence: -10 });
    expect(result.valid).toBe(false);
  });
});

describe('ValidationService.shouldAutoLock', () => {
  it('returns true for CRITICAL with confidence >= 70', () => {
    expect(ValidationService.shouldAutoLock({ severity: 'CRITICAL', confidence: 85 })).toBe(true);
  });

  it('returns true for CRITICAL with confidence exactly 70', () => {
    expect(ValidationService.shouldAutoLock({ severity: 'CRITICAL', confidence: 70 })).toBe(true);
  });

  it('returns false for CRITICAL with confidence below 70', () => {
    expect(ValidationService.shouldAutoLock({ severity: 'CRITICAL', confidence: 50 })).toBe(false);
  });

  it('returns false for HIGH severity even with high confidence', () => {
    expect(ValidationService.shouldAutoLock({ severity: 'HIGH', confidence: 95 })).toBe(false);
  });

  it('returns false when confidence is missing (defaults to 0)', () => {
    expect(ValidationService.shouldAutoLock({ severity: 'CRITICAL' })).toBe(false);
  });
});
