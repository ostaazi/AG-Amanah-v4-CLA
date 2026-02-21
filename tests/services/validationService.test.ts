import { describe, expect, it } from 'vitest';
import { ValidationService } from '../../services/validationService';
import {
  TEXT_RULE_THRESHOLD_DEFAULTS,
  VISUAL_THRESHOLD_DEFAULTS,
} from '../../services/modelThresholdDefaults';

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

  it('accepts blockApp payload with partial isolation scope', () => {
    const result = ValidationService.validateCommand('blockApp', {
      appId: 'com.whatsapp',
      blocked: true,
      scope: 'messaging',
      patterns: ['private chat', 'رسالة خاصة'],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects blockApp payload with invalid scope', () => {
    const result = ValidationService.validateCommand('blockApp', {
      appId: 'com.whatsapp',
      blocked: true,
      scope: 'enterprise_mode',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts dnsFiltering payload', () => {
    const result = ValidationService.validateCommand('dnsFiltering', {
      enabled: true,
      mode: 'family',
      domains: ['example.com', 'bad-site.net'],
    });
    expect(result.valid).toBe(true);
  });

  it('accepts dnsFiltering sandbox payload', () => {
    const result = ValidationService.validateCommand('dnsFiltering', {
      enabled: true,
      mode: 'sandbox',
      domains: ['youtube.com', 'wikipedia.org'],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects dnsFiltering payload with invalid mode', () => {
    const result = ValidationService.validateCommand('dnsFiltering', {
      enabled: true,
      mode: 'enterprise',
      domains: ['example.com'],
    });
    expect(result.valid).toBe(false);
  });

  it('accepts syncOfflineUnlockConfig payload', () => {
    const result = ValidationService.validateCommand('syncOfflineUnlockConfig', {
      version: 'unlock-v1',
      totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      backupCodeHashes: [
        '4f249ad3f7ed4ef6f3b258f4b51db82fb1889a731d3f4f0f5f226f97eb9037df',
        '7f7507d4e7f7f74a6788afc2208495d6187d28f056f48af9f9fd4d9548bc4f31',
      ],
      digits: 8,
      periodSec: 30,
      maxAttempts: 6,
      cooldownSec: 300,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects syncOfflineUnlockConfig with invalid backup hashes', () => {
    const result = ValidationService.validateCommand('syncOfflineUnlockConfig', {
      totpSecret: 'JBSWY3DPEHPK3PXP',
      backupCodeHashes: ['12345'],
    });
    expect(result.valid).toBe(false);
  });

  it('accepts runVulnerabilityScan object payload', () => {
    const result = ValidationService.validateCommand('runVulnerabilityScan', {
      enabled: true,
      deep: true,
      autoRemediate: false,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects runVulnerabilityScan with invalid types', () => {
    const result = ValidationService.validateCommand('runVulnerabilityScan', {
      enabled: 'yes',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts setVisualThresholds payload', () => {
    const result = ValidationService.validateCommand('setVisualThresholds', {
      nsfw: {
        explicitCritical: 0.52,
        sexyMedium: 0.76,
      },
      violenceScene: {
        medium: 0.66,
        high: 0.8,
        critical: 0.91,
        safeSuppression: 0.58,
        marginGuard: 0.11,
      },
      injury: {
        fastPathScore: 0.9,
        clusterCellRatio: 0.35,
        minDangerRatio: 0.03,
        varianceGuard: 90,
      },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects setVisualThresholds payload with out-of-range values', () => {
    const result = ValidationService.validateCommand('setVisualThresholds', {
      violenceScene: {
        medium: 1.5,
      },
    });
    expect(result.valid).toBe(false);
  });

  it('accepts setTextRuleThresholds payload', () => {
    const result = ValidationService.validateCommand('setTextRuleThresholds', {
      severity: {
        medium: 0.7,
        high: 0.82,
        critical: 0.94,
      },
      category: {
        predator: 0.9,
        selfHarm: 0.84,
        blackmail: 0.9,
        violence: 0.8,
        adultContent: 0.82,
        bullying: 0.72,
      },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects setTextRuleThresholds payload with out-of-range values', () => {
    const result = ValidationService.validateCommand('setTextRuleThresholds', {
      severity: {
        medium: 0.2,
      },
    });
    expect(result.valid).toBe(false);
  });

  it('accepts setVisualThresholds payload built from central defaults', () => {
    const result = ValidationService.validateCommand('setVisualThresholds', {
      nsfw: {
        explicitCritical: VISUAL_THRESHOLD_DEFAULTS.nsfwExplicitCritical,
        sexyMedium: VISUAL_THRESHOLD_DEFAULTS.nsfwSexyMedium,
      },
      violenceScene: {
        medium: VISUAL_THRESHOLD_DEFAULTS.violenceMedium,
        high: VISUAL_THRESHOLD_DEFAULTS.violenceHigh,
        critical: VISUAL_THRESHOLD_DEFAULTS.violenceCritical,
        safeSuppression: VISUAL_THRESHOLD_DEFAULTS.violenceSafeSuppression,
        marginGuard: VISUAL_THRESHOLD_DEFAULTS.violenceMarginGuard,
      },
      injury: {
        fastPathScore: VISUAL_THRESHOLD_DEFAULTS.injuryFastPathScore,
        clusterCellRatio: VISUAL_THRESHOLD_DEFAULTS.injuryClusterCellRatio,
        minDangerRatio: VISUAL_THRESHOLD_DEFAULTS.injuryMinDangerRatio,
        varianceGuard: VISUAL_THRESHOLD_DEFAULTS.injuryVarianceGuard,
      },
    });
    expect(result.valid).toBe(true);
  });

  it('accepts setTextRuleThresholds payload built from central defaults', () => {
    const result = ValidationService.validateCommand('setTextRuleThresholds', {
      severity: {
        medium: TEXT_RULE_THRESHOLD_DEFAULTS.severityMedium,
        high: TEXT_RULE_THRESHOLD_DEFAULTS.severityHigh,
        critical: TEXT_RULE_THRESHOLD_DEFAULTS.severityCritical,
      },
      category: {
        predator: TEXT_RULE_THRESHOLD_DEFAULTS.gatePredator,
        selfHarm: TEXT_RULE_THRESHOLD_DEFAULTS.gateSelfHarm,
        blackmail: TEXT_RULE_THRESHOLD_DEFAULTS.gateBlackmail,
        violence: TEXT_RULE_THRESHOLD_DEFAULTS.gateViolence,
        adultContent: TEXT_RULE_THRESHOLD_DEFAULTS.gateAdultContent,
        bullying: TEXT_RULE_THRESHOLD_DEFAULTS.gateBullying,
      },
    });
    expect(result.valid).toBe(true);
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
