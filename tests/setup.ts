/**
 * Vitest Test Setup
 * Global setup for all tests
 * Uses globals from vitest.config.ts (globals: true)
 */

// Mock crypto for Node.js environment
if (!globalThis.crypto) {
  // @ts-expect-error - Mocking crypto for tests
  globalThis.crypto = {
    getRandomValues: <T extends ArrayBufferView>(array: T): T => {
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
    } as SubtleCrypto,
  };
}

// Mock window.crypto if needed
if (typeof window !== 'undefined' && !window.crypto) {
  // @ts-expect-error - Mocking window.crypto for tests
  window.crypto = globalThis.crypto;
}
