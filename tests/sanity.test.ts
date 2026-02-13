/**
 * Sanity Test
 * Verifies Vitest is configured correctly
 * Uses globals from vitest.config.ts (globals: true)
 */

describe('Sanity Check', () => {
  it('should pass basic assertion', () => {
    expect(true).toBe(true);
  });

  it('should perform basic arithmetic', () => {
    expect(2 + 2).toBe(4);
  });

  it('should verify array operations', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });
});
