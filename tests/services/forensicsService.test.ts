import { describe, expect, it } from 'vitest';
import { generateSHA256, logCustodyEvent, verifyChainIntegrity } from '../../services/forensicsService';
import { EvidenceCustody } from '../../types';

describe('ForensicsService', () => {
  it('generates deterministic SHA-256 hashes', async () => {
    const a = await generateSHA256('amanah');
    const b = await generateSHA256('amanah');
    const c = await generateSHA256('different');

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('builds custody events with linked previous hash', async () => {
    const firstInput = {
      custody_id: 'c1',
      evidence_id: 'e1',
      incident_id: 'i1',
      actor: 'Parent',
      action: 'CAPTURE',
      event_key: 'capture',
      created_at: new Date().toISOString(),
      event_json: { ok: true },
      reason: 'initial',
    } satisfies Omit<EvidenceCustody, 'hash_hex' | 'prev_hash_hex'>;

    const first = await logCustodyEvent(null, firstInput);
    const second = await logCustodyEvent(first, {
      ...firstInput,
      custody_id: 'c2',
      action: 'EXPORT',
      event_key: 'export',
    });

    expect(first.prev_hash_hex).toBe('GENESIS_BLOCK');
    expect(first.hash_hex).toMatch(/^[a-f0-9]{64}$/);
    expect(second.prev_hash_hex).toBe(first.hash_hex);
  });

  it('detects tampering in custody chain', async () => {
    const base = {
      evidence_id: 'e1',
      incident_id: 'i1',
      actor: 'Parent',
      action: 'CAPTURE',
      event_key: 'capture',
      created_at: new Date().toISOString(),
    } satisfies Omit<EvidenceCustody, 'custody_id' | 'hash_hex' | 'prev_hash_hex'>;

    const event1 = await logCustodyEvent(null, { ...base, custody_id: 'c1' });
    const event2 = await logCustodyEvent(event1, {
      ...base,
      custody_id: 'c2',
      action: 'VERIFY',
      event_key: 'verify',
    });

    const valid = await verifyChainIntegrity([event1, event2]);
    expect(valid).toBe(true);

    const tampered = { ...event2, action: 'DELETE' };
    const invalid = await verifyChainIntegrity([event1, tampered]);
    expect(invalid).toBe(false);
  });
});
