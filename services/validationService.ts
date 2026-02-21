/**
 * Centralized Validation Logic
 * Phase 3.2: Input Validation & Sanitization
 */
import { TEXT_RULE_THRESHOLD_RANGES, VISUAL_THRESHOLD_RANGES } from './modelThresholdDefaults';

export const ValidationRules = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    // E.164-like phone numbers (+ and digits, 8-15 digits)
    phone: /^\+?[1-9]\d{7,14}$/,
    // 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    // Alphanumeric, hyphens, underscores, 1-128 chars
    documentId: /^[a-zA-Z0-9_-]{1,128}$/,
    // Safe text for names/notes (no scripts/html-like tags)
    safeText: /^[^<>]+$/,
};

export const ValidationService = {
    isValidEmail: (email: string): boolean => {
        return ValidationRules.email.test(email);
    },

    isValidPhoneNumber: (phone: string): boolean => {
        return ValidationRules.phone.test(phone);
    },

    isValidPassword: (password: string): boolean => {
        return ValidationRules.password.test(password);
    },

    isValidDocumentId: (id: string): boolean => {
        return ValidationRules.documentId.test(id);
    },

    isSafeText: (text: string): boolean => {
        if (!text) return true; // Allow empty
        return ValidationRules.safeText.test(text);
    },

    validateCommand: (command: string, value: any): { valid: boolean; error?: string } => {
        const allowedCommands = [
            'takeScreenshot',
            'lockDevice',
            'lockscreenBlackout',
            'playSiren',
            'blockApp',
            'cutInternet',
            'dnsFiltering',
            'syncOfflineUnlockConfig',
            'runVulnerabilityScan',
            'setVisualThresholds',
            'setTextRuleThresholds',
            'blockCameraAndMic',
            'notifyParent',
            'startLiveStream',
            'stopLiveStream',
            'setVideoSource',
            'setAudioSource',
            'pushToTalk',
            'walkieTalkieEnable',
        ];
        if (!allowedCommands.includes(command)) {
            return { valid: false, error: `Invalid command: ${command}` };
        }

        if (command === 'setVideoSource') {
            const allowedSources = ['camera_front', 'camera_back', 'screen'];
            if (!allowedSources.includes(String(value))) {
                return { valid: false, error: `Invalid video source: ${String(value)}` };
            }
        }

        if (command === 'setAudioSource') {
            const allowedSources = ['mic', 'system'];
            if (!allowedSources.includes(String(value))) {
                return { valid: false, error: `Invalid audio source: ${String(value)}` };
            }
        }

        if (command === 'startLiveStream' && (typeof value !== 'object' || value === null)) {
            return { valid: false, error: 'startLiveStream requires config object' };
        }

        if (command === 'lockscreenBlackout') {
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'lockscreenBlackout requires config object' };
            }
            if (typeof value.enabled !== 'boolean') {
                return { valid: false, error: 'lockscreenBlackout.enabled must be boolean' };
            }
            if (value.message !== undefined && typeof value.message !== 'string') {
                return { valid: false, error: 'lockscreenBlackout.message must be string' };
            }
        }

        if (command === 'walkieTalkieEnable') {
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'walkieTalkieEnable requires config object' };
            }
            if (typeof value.enabled !== 'boolean') {
                return { valid: false, error: 'walkieTalkieEnable.enabled must be boolean' };
            }
            if (value.source !== undefined && !['mic', 'system'].includes(String(value.source))) {
                return { valid: false, error: 'walkieTalkieEnable.source must be mic or system' };
            }
        }

        if (command === 'blockApp') {
            if (typeof value === 'boolean') {
                return { valid: true };
            }
            if (typeof value === 'string') {
                return value.trim() ? { valid: true } : { valid: false, error: 'blockApp target string is empty' };
            }
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'blockApp requires boolean|string|config object' };
            }

            const blocked = value.blocked ?? value.isBlocked;
            if (blocked !== undefined && typeof blocked !== 'boolean') {
                return { valid: false, error: 'blockApp.blocked must be boolean' };
            }

            const appId = String(value.appId ?? '').trim();
            const appName = String(value.appName ?? '').trim();
            if (!appId && !appName) {
                return { valid: false, error: 'blockApp requires appId or appName in config' };
            }

            if (value.scope !== undefined) {
                const scope = String(value.scope).toLowerCase();
                const allowedScopes = ['app', 'full', 'global', 'all', 'messaging', 'chat', 'private_chat', 'private', 'rooms', 'groups', 'comments'];
                if (!allowedScopes.includes(scope)) {
                    return { valid: false, error: 'blockApp.scope is invalid' };
                }
            }

            if (value.patterns !== undefined) {
                if (!Array.isArray(value.patterns)) {
                    return { valid: false, error: 'blockApp.patterns must be string[]' };
                }
                if (value.patterns.length > 24) {
                    return { valid: false, error: 'blockApp.patterns max length is 24' };
                }
                const invalid = value.patterns.some((pattern: any) => {
                    if (typeof pattern !== 'string') return true;
                    const normalized = pattern.trim();
                    return normalized.length < 2 || normalized.length > 64;
                });
                if (invalid) {
                    return { valid: false, error: 'blockApp.patterns contains invalid entries' };
                }
            }
        }

        if (command === 'dnsFiltering') {
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'dnsFiltering requires config object' };
            }
            if (typeof value.enabled !== 'boolean') {
                return { valid: false, error: 'dnsFiltering.enabled must be boolean' };
            }
            const mode = value.mode === undefined ? 'family' : String(value.mode).toLowerCase();
            if (!['family', 'strict', 'custom', 'sandbox'].includes(mode)) {
                return { valid: false, error: 'dnsFiltering.mode must be family|strict|custom|sandbox' };
            }
            if (value.domains !== undefined) {
                if (!Array.isArray(value.domains)) {
                    return { valid: false, error: 'dnsFiltering.domains must be string[]' };
                }
                if (value.domains.length > 200) {
                    return { valid: false, error: 'dnsFiltering.domains max length is 200' };
                }
                const invalid = value.domains.some((domain: any) => {
                    if (typeof domain !== 'string') return true;
                    const normalized = domain.trim().toLowerCase();
                    if (!normalized || normalized.length > 253) return true;
                    return !/^[a-z0-9.-]+$/.test(normalized);
                });
                if (invalid) {
                    return { valid: false, error: 'dnsFiltering.domains contains invalid domain' };
                }
            }
        }

        if (command === 'syncOfflineUnlockConfig') {
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'syncOfflineUnlockConfig requires config object' };
            }
            const secret = String(value.totpSecret ?? '').trim().toUpperCase();
            if (!secret || secret.length < 16 || secret.length > 96 || !/^[A-Z2-7]+$/.test(secret)) {
                return { valid: false, error: 'syncOfflineUnlockConfig.totpSecret must be base32 string' };
            }
            if (!Array.isArray(value.backupCodeHashes) || value.backupCodeHashes.length < 2) {
                return { valid: false, error: 'syncOfflineUnlockConfig.backupCodeHashes must contain at least 2 entries' };
            }
            if (value.backupCodeHashes.length > 24) {
                return { valid: false, error: 'syncOfflineUnlockConfig.backupCodeHashes max length is 24' };
            }
            const invalidHash = value.backupCodeHashes.some((item: any) => {
                const hash = String(item ?? '').trim().toLowerCase();
                return !/^[a-f0-9]{64}$/.test(hash);
            });
            if (invalidHash) {
                return { valid: false, error: 'syncOfflineUnlockConfig.backupCodeHashes contains invalid hash' };
            }
            if (value.digits !== undefined) {
                const digits = Number(value.digits);
                if (!Number.isFinite(digits) || digits < 6 || digits > 10) {
                    return { valid: false, error: 'syncOfflineUnlockConfig.digits must be 6-10' };
                }
            }
            if (value.periodSec !== undefined) {
                const periodSec = Number(value.periodSec);
                if (!Number.isFinite(periodSec) || periodSec < 15 || periodSec > 90) {
                    return { valid: false, error: 'syncOfflineUnlockConfig.periodSec must be 15-90' };
                }
            }
        }

        if (command === 'runVulnerabilityScan') {
            if (typeof value === 'boolean') {
                return { valid: true };
            }
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'runVulnerabilityScan requires boolean or config object' };
            }
            if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
                return { valid: false, error: 'runVulnerabilityScan.enabled must be boolean' };
            }
            if (value.deep !== undefined && typeof value.deep !== 'boolean') {
                return { valid: false, error: 'runVulnerabilityScan.deep must be boolean' };
            }
            if (value.autoRemediate !== undefined && typeof value.autoRemediate !== 'boolean') {
                return { valid: false, error: 'runVulnerabilityScan.autoRemediate must be boolean' };
            }
        }

        if (command === 'setVisualThresholds') {
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'setVisualThresholds requires config object' };
            }

            if (value.resetToDefault !== undefined && typeof value.resetToDefault !== 'boolean') {
                return { valid: false, error: 'setVisualThresholds.resetToDefault must be boolean' };
            }

            const nsfw = value.nsfw;
            if (nsfw !== undefined) {
                if (typeof nsfw !== 'object' || nsfw === null) {
                    return { valid: false, error: 'setVisualThresholds.nsfw must be object' };
                }
                const explicit = nsfw.explicitCritical;
                if (explicit !== undefined) {
                    const n = Number(explicit);
                    const range = VISUAL_THRESHOLD_RANGES.nsfwExplicitCritical;
                    if (!Number.isFinite(n) || n < range.min || n > range.max) {
                        return { valid: false, error: `nsfw.explicitCritical must be ${range.min}-${range.max}` };
                    }
                }
                const sexy = nsfw.sexyMedium;
                if (sexy !== undefined) {
                    const n = Number(sexy);
                    const range = VISUAL_THRESHOLD_RANGES.nsfwSexyMedium;
                    if (!Number.isFinite(n) || n < range.min || n > range.max) {
                        return { valid: false, error: `nsfw.sexyMedium must be ${range.min}-${range.max}` };
                    }
                }
            }

            const violence = value.violenceScene;
            if (violence !== undefined) {
                if (typeof violence !== 'object' || violence === null) {
                    return { valid: false, error: 'setVisualThresholds.violenceScene must be object' };
                }
                const checks: Array<[string, keyof typeof VISUAL_THRESHOLD_RANGES]> = [
                    ['medium', 'violenceMedium'],
                    ['high', 'violenceHigh'],
                    ['critical', 'violenceCritical'],
                    ['safeSuppression', 'violenceSafeSuppression'],
                    ['marginGuard', 'violenceMarginGuard'],
                ];
                for (const [key, rangeKey] of checks) {
                    const raw = violence[key];
                    if (raw === undefined) continue;
                    const n = Number(raw);
                    const range = VISUAL_THRESHOLD_RANGES[rangeKey];
                    if (!Number.isFinite(n) || n < range.min || n > range.max) {
                        return { valid: false, error: `violenceScene.${key} must be ${range.min}-${range.max}` };
                    }
                }
            }

            const injury = value.injury;
            if (injury !== undefined) {
                if (typeof injury !== 'object' || injury === null) {
                    return { valid: false, error: 'setVisualThresholds.injury must be object' };
                }
                const checks: Array<[string, keyof typeof VISUAL_THRESHOLD_RANGES]> = [
                    ['fastPathScore', 'injuryFastPathScore'],
                    ['clusterCellRatio', 'injuryClusterCellRatio'],
                    ['minDangerRatio', 'injuryMinDangerRatio'],
                    ['varianceGuard', 'injuryVarianceGuard'],
                ];
                for (const [key, rangeKey] of checks) {
                    const raw = injury[key];
                    if (raw === undefined) continue;
                    const n = Number(raw);
                    const range = VISUAL_THRESHOLD_RANGES[rangeKey];
                    if (!Number.isFinite(n) || n < range.min || n > range.max) {
                        return { valid: false, error: `injury.${key} must be ${range.min}-${range.max}` };
                    }
                }
            }
        }

        if (command === 'setTextRuleThresholds') {
            if (typeof value !== 'object' || value === null) {
                return { valid: false, error: 'setTextRuleThresholds requires config object' };
            }

            if (value.resetToDefault !== undefined && typeof value.resetToDefault !== 'boolean') {
                return { valid: false, error: 'setTextRuleThresholds.resetToDefault must be boolean' };
            }

            const severity = value.severity;
            if (severity !== undefined) {
                if (typeof severity !== 'object' || severity === null) {
                    return { valid: false, error: 'setTextRuleThresholds.severity must be object' };
                }
                const checks: Array<[string, keyof typeof TEXT_RULE_THRESHOLD_RANGES]> = [
                    ['medium', 'severityMedium'],
                    ['high', 'severityHigh'],
                    ['critical', 'severityCritical'],
                ];
                for (const [key, rangeKey] of checks) {
                    const raw = severity[key];
                    if (raw === undefined) continue;
                    const n = Number(raw);
                    const range = TEXT_RULE_THRESHOLD_RANGES[rangeKey];
                    if (!Number.isFinite(n) || n < range.min || n > range.max) {
                        return { valid: false, error: `severity.${key} must be ${range.min}-${range.max}` };
                    }
                }
            }

            const category = value.category;
            if (category !== undefined) {
                if (typeof category !== 'object' || category === null) {
                    return { valid: false, error: 'setTextRuleThresholds.category must be object' };
                }
                const checks: Array<[string, keyof typeof TEXT_RULE_THRESHOLD_RANGES]> = [
                    ['predator', 'gatePredator'],
                    ['selfHarm', 'gateSelfHarm'],
                    ['blackmail', 'gateBlackmail'],
                    ['violence', 'gateViolence'],
                    ['adultContent', 'gateAdultContent'],
                    ['bullying', 'gateBullying'],
                ];
                for (const [key, rangeKey] of checks) {
                    const raw = category[key];
                    if (raw === undefined) continue;
                    const n = Number(raw);
                    const range = TEXT_RULE_THRESHOLD_RANGES[rangeKey];
                    if (!Number.isFinite(n) || n < range.min || n > range.max) {
                        return { valid: false, error: `category.${key} must be ${range.min}-${range.max}` };
                    }
                }
            }
        }

        return { valid: true };
    },

    validateAlert: (alert: any): { valid: boolean; error?: string } => {
        if (!alert.type || !alert.severity) {
            return { valid: false, error: 'Missing required alert fields (type, severity)' };
        }
        const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        if (!validSeverities.includes(alert.severity)) {
            return { valid: false, error: `Invalid alert severity: ${alert.severity}` };
        }
        if (alert.confidence !== undefined && (typeof alert.confidence !== 'number' || alert.confidence < 0 || alert.confidence > 100)) {
            return { valid: false, error: 'Alert confidence must be a number between 0 and 100' };
        }
        if (alert.notes && !ValidationService.isSafeText(alert.notes)) {
            return { valid: false, error: 'Alert notes contain unsafe characters' };
        }
        return { valid: true };
    },

    /**
     * Determines if an alert should trigger auto-lock actions.
     * Only CRITICAL alerts with confidence >= 70 should auto-lock.
     */
    shouldAutoLock: (alert: { severity?: string; confidence?: number }): boolean => {
        if (alert.severity !== 'CRITICAL') return false;
        const confidence = alert.confidence ?? 0;
        return confidence >= 70;
    },

    /**
     * Deep Object Sanitization
     * Removes circular references and converts Dates to Strings/Timestamps
     */
    sanitizeInput: (data: any, seen = new WeakSet()): any => {
        if (data === null || data === undefined) return data;
        if (typeof data !== 'object') return data;

        if (seen.has(data)) return null; // Break circular refs
        seen.add(data);

        if (Array.isArray(data)) {
            return data.map((item) => ValidationService.sanitizeInput(item, seen));
        }

        const sanitized: any = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                // Skip private fields or large blobs if necessary
                sanitized[key] = ValidationService.sanitizeInput(data[key], seen);
            }
        }
        return sanitized;
    },
};
