import { describe, expect, it } from 'vitest';
import { AlertSeverity, Category, EvidenceCustody, EvidenceRecord } from '../../types';
import { buildEvidencePackageManifest } from '../../workers/evidencePackageWorker';

describe('evidencePackageWorker', () => {
  it('builds manifest with stable hash fields and counts', async () => {
    const records: EvidenceRecord[] = [
      {
        id: 'r1',
        childName: 'Child',
        platform: 'Discord',
        content: 'msg',
        category: Category.BULLYING,
        severity: AlertSeverity.HIGH,
        timestamp: new Date(),
        aiAnalysis: 'analysis',
        suspectUsername: 'suspect',
        conversationLog: [],
      } as EvidenceRecord,
    ];

    const custody: EvidenceCustody[] = [
      {
        custody_id: 'c1',
        evidence_id: 'r1',
        actor: 'system',
        action: 'capture',
        event_key: 'capture',
        created_at: new Date().toISOString(),
        hash_hex: 'h1',
        prev_hash_hex: 'GENESIS_BLOCK',
      },
    ];

    const manifest = await buildEvidencePackageManifest({
      parentId: 'p1',
      incidentId: 'i1',
      exportedBy: 'admin',
      records,
      custody,
      audits: [],
    });

    expect(manifest.counts.records).toBe(1);
    expect(manifest.counts.custody).toBe(1);
    expect(manifest.counts.audits).toBe(0);
    expect(manifest.hashes.recordsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.hashes.custodySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.hashes.auditsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.hashes.packageSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
