import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../lib/auth';
import { IntegrityPayload, requireIntegritySecret, verifyHmac } from '../../../../lib/integrity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const principal = getPrincipal(req);
    const incident_id = params.id;
    const body = await req.json();
    const artifact_id = body.artifact_id;

    const incident = await prisma.incident.findUnique({ where: { incident_id } });
    if (!incident) throw new HttpError(404, 'Incident not found');
    if (!requireFamilyAccess(principal, incident.family_id)) throw new HttpError(403, 'Forbidden');

    const artifact = await prisma.incidentArtifact.findUnique({
      where: { artifact_id }
    });

    if (!artifact) throw new HttpError(404, 'Artifact record not found');

    const payload: IntegrityPayload = {
      incident_id: artifact.incident_id,
      artifact_type: artifact.artifact_type,
      snapshot_sha256: artifact.snapshot_sha256,
      created_at_iso: artifact.created_at.toISOString(),
      version: 1,
    };

    const secret = requireIntegritySecret();
    const verified = verifyHmac(payload, artifact.signature_hmac, secret);

    return NextResponse.json({
      verified,
      artifact: {
        id: artifact.artifact_id,
        type: artifact.artifact_type,
        sha256: artifact.snapshot_sha256,
        created_at: artifact.created_at
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: e?.status ?? 500 });
  }
}