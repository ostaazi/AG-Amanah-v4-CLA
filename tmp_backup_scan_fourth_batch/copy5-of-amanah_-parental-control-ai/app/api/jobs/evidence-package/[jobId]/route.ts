
import { NextRequest, NextResponse } from 'next/server';
import { getPrincipal, HttpError } from '../../../../../lib/auth';
import { evidencePackageQueue } from '../../../../../lib/queue/bull';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    getPrincipal(req);

    const jobId = params.jobId;
    const job = await evidencePackageQueue.getJob(jobId);

    if (!job) throw new HttpError(404, 'Job not found');

    const state = await job.getState();
    const progress = job.progress || 0;

    const result = (job.returnvalue || null) as any;

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        name: job.name,
        state,
        progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason || null,
      },
      result: result
        ? {
            fileKey: result.fileKey || null,
            filename: result.filename || null,
            downloadUrl: result.downloadUrl || null,
            manifestSignature: result.manifestSignature || null,
          }
        : null,
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
