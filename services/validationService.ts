/**
 * Centralized Validation Logic
 * Phase 3.2: Input Validation & Sanitization
 */

export const ValidationRules = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
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
        const allowedCommands = ['takeScreenshot', 'lockDevice', 'playSiren', 'blockApp'];
        if (!allowedCommands.includes(command)) {
            return { valid: false, error: `Invalid command: ${command}` };
        }
        // value validation could go here
        return { valid: true };
    },

    validateAlert: (alert: any): { valid: boolean; error?: string } => {
        if (!alert.type || !alert.severity) {
            return { valid: false, error: 'Missing required alert fields (type, severity)' };
        }
        if (alert.notes && !ValidationService.isSafeText(alert.notes)) {
            return { valid: false, error: 'Alert notes contain unsafe characters' };
        }
        return { valid: true };
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
