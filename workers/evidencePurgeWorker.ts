import { AlertSeverity, EvidenceRecord } from '../types';

export interface EvidencePurgePolicy {
  retentionDays: number;
  keepCritical: boolean;
  legalHoldIds?: string[];
}

export interface EvidencePurgePlan {
  toDelete: EvidenceRecord[];
  toKeep: EvidenceRecord[];
  summary: {
    deleteCount: number;
    keepCount: number;
    thresholdIso: string;
  };
}

const toTimestamp = (value: any): number => {
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const buildEvidencePurgePlan = (
  records: EvidenceRecord[],
  policy: EvidencePurgePolicy,
  now: Date = new Date()
): EvidencePurgePlan => {
  const retentionDays = Math.max(1, policy.retentionDays || 30);
  const thresholdMs = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const legalHoldSet = new Set(policy.legalHoldIds || []);

  const toDelete: EvidenceRecord[] = [];
  const toKeep: EvidenceRecord[] = [];

  for (const record of records || []) {
    const recordTime = toTimestamp((record as any).timestamp);
    const isOld = recordTime > 0 && recordTime < thresholdMs;
    const isLegalHold = legalHoldSet.has(record.id);
    const isCritical = record.severity === AlertSeverity.CRITICAL;
    const protectedByPolicy = isLegalHold || (policy.keepCritical && isCritical);

    if (isOld && !protectedByPolicy) {
      toDelete.push(record);
    } else {
      toKeep.push(record);
    }
  }

  return {
    toDelete,
    toKeep,
    summary: {
      deleteCount: toDelete.length,
      keepCount: toKeep.length,
      thresholdIso: new Date(thresholdMs).toISOString(),
    },
  };
};

export const executeEvidencePurgePlan = async (
  plan: EvidencePurgePlan,
  deleteById: (recordId: string) => Promise<void>
): Promise<{ deleted: number; failed: number }> => {
  let deleted = 0;
  let failed = 0;

  for (const record of plan.toDelete) {
    try {
      await deleteById(record.id);
      deleted += 1;
    } catch (error) {
      console.error('Failed to purge evidence record', record.id, error);
      failed += 1;
    }
  }

  return { deleted, failed };
};
