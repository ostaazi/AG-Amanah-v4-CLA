import { DeviceCommandAudit, EvidenceCustody, EvidenceRecord } from '../types';
import { generateSHA256 } from '../services/forensicsService';

export interface EvidencePackageInput {
  parentId: string;
  incidentId: string;
  exportedBy: string;
  records: EvidenceRecord[];
  custody: EvidenceCustody[];
  audits: DeviceCommandAudit[];
  generatedAt?: string;
}

export interface EvidencePackageManifest {
  parentId: string;
  incidentId: string;
  exportedBy: string;
  generatedAt: string;
  counts: {
    records: number;
    custody: number;
    audits: number;
  };
  hashes: {
    recordsSha256: string;
    custodySha256: string;
    auditsSha256: string;
    packageSha256: string;
  };
}

const stableStringify = (value: any): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((x) => stableStringify(x)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

const normalizeTimeline = <T extends { [key: string]: any }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aTime = new Date(String(a.createdAt || a.created_at || a.timestamp || '')).getTime();
    const bTime = new Date(String(b.createdAt || b.created_at || b.timestamp || '')).getTime();
    return aTime - bTime;
  });

export const buildEvidencePackageManifest = async (
  input: EvidencePackageInput
): Promise<EvidencePackageManifest> => {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const records = normalizeTimeline(input.records || []);
  const custody = normalizeTimeline(input.custody || []);
  const audits = normalizeTimeline(input.audits || []);

  const recordsSha256 = await generateSHA256(stableStringify(records));
  const custodySha256 = await generateSHA256(stableStringify(custody));
  const auditsSha256 = await generateSHA256(stableStringify(audits));
  const packageSha256 = await generateSHA256(
    stableStringify({
      parentId: input.parentId,
      incidentId: input.incidentId,
      exportedBy: input.exportedBy,
      generatedAt,
      recordsSha256,
      custodySha256,
      auditsSha256,
    })
  );

  return {
    parentId: input.parentId,
    incidentId: input.incidentId,
    exportedBy: input.exportedBy,
    generatedAt,
    counts: {
      records: records.length,
      custody: custody.length,
      audits: audits.length,
    },
    hashes: {
      recordsSha256,
      custodySha256,
      auditsSha256,
      packageSha256,
    },
  };
};
