/**
 * Vitest Test Setup
 * Global setup for all tests
 * Uses globals from vitest.config.ts (globals: true)
 */

// React 19 act() environment flag to avoid noisy warnings in component tests.
// @ts-expect-error - test-only global
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock crypto for Node.js environment
if (!globalThis.crypto) {
  globalThis.crypto = {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (!array) return array;
      // Simple mock: fill with pseudo-random bytes
      const bytes = new Uint8Array(array.buffer);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    subtle: {
      importKey: () => Promise.resolve({} as CryptoKey),
      deriveKey: () => Promise.resolve({} as CryptoKey),
      encrypt: () => Promise.resolve(new ArrayBuffer(16)),
      decrypt: () =>
        Promise.resolve(new TextEncoder().encode('decrypted').buffer),
      sign: () => Promise.resolve(new ArrayBuffer(20)),
    } as unknown as SubtleCrypto,
    randomUUID: () => '00000000-0000-0000-0000-000000000000',
  };
}

// Mock window.crypto if needed
if (typeof window !== 'undefined' && !window.crypto) {
  // Mocking window.crypto for tests
  window.crypto = globalThis.crypto as unknown as Crypto;
}
