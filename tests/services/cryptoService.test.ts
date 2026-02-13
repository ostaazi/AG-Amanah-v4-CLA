/**
 * CryptoService Smoke Tests
 * Tests core encryption functionality
 */


import { generateSalt, setSessionPassword, clearSessionPassword, getSessionPassword } from '../../services/cryptoService';

describe('CryptoService - Smoke Tests', () => {
  describe('generateSalt', () => {
    it('should generate a base64-encoded salt', () => {
      const salt = generateSalt();

      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);

      // Base64 pattern check
      expect(salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      expect(salt1).not.toBe(salt2);
    });

    it('should generate salts of consistent length', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      expect(salt1.length).toBe(salt2.length);
    });
  });

  describe('Session Password Management', () => {
    it('should store and retrieve session password', () => {
      const testPassword = 'test-password-123';

      setSessionPassword(testPassword);
      const retrieved = getSessionPassword();

      expect(retrieved).toBe(testPassword);
    });

    it('should clear session password', () => {
      setSessionPassword('test-password');
      clearSessionPassword();

      const retrieved = getSessionPassword();
      expect(retrieved).toBeNull();
    });

    it('should return null when no password is set', () => {
      clearSessionPassword();
      const retrieved = getSessionPassword();

      expect(retrieved).toBeNull();
    });

    it('should overwrite previous session password', () => {
      setSessionPassword('password1');
      setSessionPassword('password2');

      const retrieved = getSessionPassword();
      expect(retrieved).toBe('password2');
    });
  });
});
