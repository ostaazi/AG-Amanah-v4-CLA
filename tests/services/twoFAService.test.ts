/**
 * TwoFAService Smoke Tests
 * Tests 2FA secret generation and validation
 */


import {
  generate2FASecret,
  verifyTOTPCode,
  generateBackupCodes,
  getQRCodeUrl,
} from '../../services/twoFAService';

describe('TwoFAService - Smoke Tests', () => {
  describe('generate2FASecret', () => {
    it('should generate a base32-encoded secret', () => {
      const secret = generate2FASecret();

      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);

      // Base32 pattern check (only uppercase letters and 2-7 digits)
      expect(secret).toMatch(/^[A-Z2-7]+$/);
    });

    it('should generate unique secrets', () => {
      const secret1 = generate2FASecret();
      const secret2 = generate2FASecret();

      expect(secret1).not.toBe(secret2);
    });

    it('should generate secrets of consistent length', () => {
      const secret1 = generate2FASecret();
      const secret2 = generate2FASecret();

      // Based on implementation: 16 base32 characters
      expect(secret1.length).toBe(16);
      expect(secret2.length).toBe(16);
    });
  });

  describe('verifyTOTPCode', () => {
    it('should validate 6-digit TOTP codes', () => {
      expect(verifyTOTPCode('123456')).toBe(true);
      expect(verifyTOTPCode('000000')).toBe(true);
      expect(verifyTOTPCode('999999')).toBe(true);
    });

    it('should reject invalid TOTP codes', () => {
      expect(verifyTOTPCode('12345')).toBe(false); // Too short
      expect(verifyTOTPCode('1234567')).toBe(false); // Too long
      expect(verifyTOTPCode('12345a')).toBe(false); // Contains letter
      expect(verifyTOTPCode('abc123')).toBe(false); // Contains letters
      expect(verifyTOTPCode('')).toBe(false); // Empty
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', () => {
      const codes = generateBackupCodes();

      expect(codes).toBeDefined();
      expect(Array.isArray(codes)).toBe(true);
      expect(codes.length).toBe(10);
    });

    it('should generate 8-digit backup codes', () => {
      const codes = generateBackupCodes();

      codes.forEach((code) => {
        expect(code).toMatch(/^\d{8}$/);
      });
    });

    it('should generate unique backup codes', () => {
      const codes = generateBackupCodes();
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(10);
    });
  });

  describe('getQRCodeUrl', () => {
    it('should generate a valid QR code URL', () => {
      const email = 'test@example.com';
      const secret = 'JBSWY3DPEHPK3PXP';

      const url = getQRCodeUrl(email, secret);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url).toContain('api.qrserver.com');
      // URL is encoded as query parameter, so check for encoded version
      expect(url).toContain(encodeURIComponent('otpauth://totp/'));
      expect(url).toContain(encodeURIComponent(email));
      expect(url).toContain(secret);
    });

    it('should include AmanahAI as issuer', () => {
      const url = getQRCodeUrl('user@test.com', 'TESTSECRET123456');

      expect(url).toContain('AmanahAI');
      // Check for encoded version since it's in the data parameter
      expect(url).toContain(encodeURIComponent('issuer='));
    });

    it('should properly encode special characters in email', () => {
      const email = 'test+tag@example.com';
      const secret = 'TESTSECRET';

      const url = getQRCodeUrl(email, secret);

      expect(url).toContain(encodeURIComponent(email));
    });
  });
});
