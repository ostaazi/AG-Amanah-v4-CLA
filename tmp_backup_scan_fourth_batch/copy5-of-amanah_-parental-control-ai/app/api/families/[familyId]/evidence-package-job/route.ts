
import { NextRequest, NextResponse } from 'next/server';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../lib/auth';
import { evidencePackageQueue } from '../../../../../lib/queue/bull';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function safeStr(v: any) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function POST(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const body = await req.json().catch(() => ({}));

    const payload = {
      familyId,
      requestedByUserId: principal.user_id || null,
      filters: {
        type: safeStr(body?.type),
        device_id: safeStr(body?.device_id),
        incident_id: safeStr(body?.incident_id),
        from: safeStr(body?.from),
        to: safeStr(body?.to),
        q: safeStr(body?.q),
      },
    };

    const job = await evidencePackageQueue.add('build_evidence_package', payload);

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      statusUrl: `/api/jobs/evidence-package/${job.id}`,
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const jobs = await evidencePackageQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 20);

    return NextResponse.json({
      ok: true,
      items: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        progress: j.progress,
        attemptsMade: j.attemptsMade,
        failedReason: j.failedReason || null,
        timestamp: j.timestamp,
      })),
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
