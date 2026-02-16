
import { NextRequest, NextResponse } from 'next/server';
import { getPrincipal, requireFamilyAccess, requireFatherRole, HttpError } from '../../../../../lib/auth';
import { evidencePurgeQueue } from '../../../../../lib/queue/purge';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

export async function POST(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    requireFatherRole(principal, familyId);

    const job = await evidencePurgeQueue.add('purge_family_evidence', { familyId });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
