import { NextRequest, NextResponse } from 'next/server';
import { getPrincipal, HttpError } from '../../../../../lib/auth';
import { evidencePackageQueue } from '../../../../../lib/queue/bull';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    getPrincipal(req);

    const jobId = params.jobId;
    const job = await evidencePackageQueue.getJob(jobId);

    if (!job) throw new HttpError(404, 'Job not found');

    const state = await job.getState();
    if (state !== 'completed') throw new HttpError(409, `Job not completed (state=${state})`);

    const result = (job.returnvalue || null) as any;
    if (!result?.fileKey) throw new HttpError(500, 'Job result missing fileKey');

    const packagesDir = getEnv('EVIDENCE_PACKAGES_DIR', path.join((process as any).cwd(), 'evidence_packages'));
    const abs = path.join(packagesDir, result.fileKey);

    if (!fs.existsSync(abs)) throw new HttpError(404, 'Package file not found on server');

    const stat = fs.statSync(abs);
    const nodeStream = fs.createReadStream(abs);
    
    const webStream = new ReadableStream({
      start(controller) {
        let isFinalized = false;
        const safeClose = () => { if (!isFinalized) { try { controller.close(); } catch (e) {} isFinalized = true; } };
        const safeError = (err: any) => { if (!isFinalized) { try { controller.error(err); } catch (e) {} isFinalized = true; } };

        nodeStream.on('data', (chunk) => {
          if (!isFinalized) {
            try { controller.enqueue(chunk); } catch (err) { isFinalized = true; nodeStream.destroy(); }
          }
        });
        nodeStream.on('end', () => safeClose());
        nodeStream.on('error', (err) => safeError(err));
      },
      cancel() {
        nodeStream.destroy();
      }
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${result.filename || `evidence_package_${jobId}.zip`}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Package download failed');
  }
}