import { prisma } from './prisma';
import { sha256Hex } from './integrity';

export async function buildEvidenceSnapshotSha256(incident_id: string) {
  const incident = await prisma.incident.findUnique({
    where: { incident_id },
  });

  if (!incident) {
    throw new Error('Incident not found');
  }

  const evidence = await prisma.evidence.findMany({
    where: { incident_id },
    orderBy: { evidence_id: 'asc' }, // Order is critical for hashing
    select: {
      evidence_id: true,
      content_type: true,
      severity: true,
      summary: true,
      sha256: true,
      created_at: true,
    },
  });

  const normalized = {
    v: 1,
    incident_id: incident.incident_id,
    type: incident.incident_type,
    created_at: incident.created_at.toISOString(),
    evidence: evidence.map(e => ({
      id: e.evidence_id,
      sha: e.sha256,
      type: e.content_type,
      summary: e.summary,
    })),
  };

  const json = JSON.stringify(normalized);
  return {
    snapshot_sha256: sha256Hex(json),
    normalized_json: normalized,
  };
}