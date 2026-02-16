import { describe, expect, it } from 'vitest';
import {
  MOCK_DATA_DOMAINS,
  clearSelectedMockData,
  injectSelectedMockData,
} from '../../services/mockDataService';

describe('mockDataService domains', () => {
  it('includes operations domain in selectable mock scopes', () => {
    expect(MOCK_DATA_DOMAINS).toContain('operations');
  });

  it('returns zeroed counters (including operations) for invalid parent id', async () => {
    const injected = await injectSelectedMockData('', ['operations']);
    const cleared = await clearSelectedMockData('', ['operations']);

    expect(injected.operations).toBe(0);
    expect(cleared.operations).toBe(0);
  });
});
