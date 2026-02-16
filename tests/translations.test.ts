import { describe, expect, it } from 'vitest';
import { translations } from '../translations';

describe('translations regression', () => {
  it('provides command center and developer resolution labels in both languages', () => {
    expect(typeof translations.ar.commandCenter).toBe('string');
    expect(typeof translations.en.commandCenter).toBe('string');
    expect(typeof translations.ar.developerResolution).toBe('string');
    expect(typeof translations.en.developerResolution).toBe('string');
    expect(translations.en.commandCenter.length).toBeGreaterThan(0);
    expect(translations.en.developerResolution.length).toBeGreaterThan(0);
  });
});
