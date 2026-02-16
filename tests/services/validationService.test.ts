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
});
