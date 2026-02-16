import { describe, expect, it } from 'vitest';
import { AlertSeverity, Category, EvidenceRecord } from '../../types';
import { buildEvidencePurgePlan } from '../../workers/evidencePurgeWorker';

const makeRecord = (id: string, daysAgo: number, severity: AlertSeverity): EvidenceRecord =>
  ({
    id,
    childName: 'Child',
    platform: 'Platform',
    content: 'Content',
    category: Category.SAFE,
    severity,
    timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    aiAnalysis: 'Analysis',
    suspectUsername: 'suspect',
    conversationLog: [],
  }) as EvidenceRecord;

describe('evidencePurgeWorker', () => {
  it('keeps critical and legal-hold records while deleting stale records', () => {
    const oldLow = makeRecord('r-old-low', 45, AlertSeverity.LOW);
    const oldCritical = makeRecord('r-old-critical', 45, AlertSeverity.CRITICAL);
    const recentLow = makeRecord('r-recent-low', 5, AlertSeverity.LOW);

    const plan = buildEvidencePurgePlan(
      [oldLow, oldCritical, recentLow],
      { retentionDays: 30, keepCritical: true, legalHoldIds: ['r-old-low'] },
      new Date()
    );

    expect(plan.toDelete.map((x) => x.id)).toEqual([]);
    expect(plan.toKeep.map((x) => x.id).sort()).toEqual(
      ['r-old-critical', 'r-old-low', 'r-recent-low'].sort()
    );
  });

  it('deletes old non-protected records', () => {
    const oldLow = makeRecord('r-old-low', 45, AlertSeverity.LOW);
    const recentLow = makeRecord('r-recent-low', 2, AlertSeverity.LOW);

    const plan = buildEvidencePurgePlan(
      [oldLow, recentLow],
      { retentionDays: 30, keepCritical: false },
      new Date()
    );

    expect(plan.toDelete.map((x) => x.id)).toEqual(['r-old-low']);
    expect(plan.toKeep.map((x) => x.id)).toEqual(['r-recent-low']);
  });
});
