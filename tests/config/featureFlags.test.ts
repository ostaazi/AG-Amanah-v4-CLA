import { describe, expect, it } from 'vitest';
import { FEATURE_FLAGS } from '../../config/featureFlags';

describe('feature flags regression', () => {
  it('exposes command center and developer resolution hub flags', () => {
    expect(typeof FEATURE_FLAGS.commandCenter).toBe('boolean');
    expect(typeof FEATURE_FLAGS.developerResolutionHub).toBe('boolean');
  });
});
