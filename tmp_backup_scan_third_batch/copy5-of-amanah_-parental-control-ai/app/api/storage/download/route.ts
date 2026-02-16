import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../lib/auth';
import { verifyEvidenceDownloadSignature } from '../../../lib/storage';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

async function streamLocalFile(absolutePath: string, mime: string, filename: string) {
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, 'File not found (local driver)');
  }

  const stat = fs.statSync(absolutePath);
  const stream = fs.createReadStream(absolutePath);

  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      'Content-Type': mime || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const principal = getPrincipal(req);

    const url = new URL(req.url);
    const evidence_id = String(url.searchParams.get('evidence_id') || '').trim();
    const exp = Number(url.searchParams.get('exp') || 0);
    const sig = String(url.searchParams.get('sig') || '').trim();

    if (!evidence_id || !exp || !sig) throw new HttpError(400, 'Missing signed params');

    const now = Math.floor(Date.now() / 1000);
    if (exp < now) throw new HttpError(401, 'Signed URL expired');

    const valid = verifyEvidenceDownloadSignature(evidence_id, exp, sig);
    if (!valid) throw new HttpError(401, 'Invalid signature');

    const ev = await prisma.evidence.findUnique({
      where: { evidence_id },
    });

    if (!ev) throw new HttpError(404, 'Evidence not found');

    if (!requireFamilyAccess(principal, ev.family_id)) {
      throw new HttpError(403, 'Forbidden');
    }

    // Audit custody: EVIDENCE_DOWNLOADED
    const created_at = new Date();
    const last = await prisma.custodyEvent.findFirst({
      where: { family_id: ev.family_id, incident_id: ev.incident_id || undefined },
      orderBy: { event_at: 'desc' },
      select: { hash_hex: true },
    });

    const prev_hash_hex = last?.hash_hex ?? null;

    const event_json = {
      evidence_id: ev.evidence_id,
      incident_id: ev.incident_id,
      sha256_hex: ev.sha256,
      downloaded_by_user_id: principal.user_id || null,
    };

    const hash_payload = JSON.stringify({
      family_id: ev.family_id,
      incident_id: ev.incident_id,
      actor: 'PARENT_CONSOLE',
      event_key: 'EVIDENCE_DOWNLOADED',
      event_at: created_at.toISOString(),
      prev_hash_hex,
      event_json,
    });

    const hash_hex = sha256Hex(hash_payload);

    await prisma.custodyEvent.create({
      data: {
        family_id: ev.family_id,
        incident_id: ev.incident_id,
        actor: 'PARENT_CONSOLE',
        event_key: 'EVIDENCE_DOWNLOADED',
        event_at: created_at,
        event_json,
        prev_hash_hex,
        hash_hex,
      }
    });

    // Download Logic
    const filename = `${ev.content_type}_${ev.evidence_id}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const driver = (getEnv('STORAGE_DRIVER', 'local') || 'local').toLowerCase();

    if (driver === 'local') {
      // Fix: Cast process to any to access cwd() if Node.js types are missing or limited in this context
      const baseDir = getEnv('STORAGE_LOCAL_DIR', path.join((process as any).cwd(), 'storage_local'));
      // In local mode, object_uri acts as the relative file path
      const relPath = ev.object_uri || '';
      const abs = path.join(baseDir, relPath);
      return await streamLocalFile(abs, ev.mime_type || 'application/octet-stream', `${filename}`);
    }

    // Enterprise note: S3/R2 streaming would go here using @aws-sdk/client-s3 GetObjectCommand
    throw new HttpError(500, 'Unsupported or unconfigured STORAGE_DRIVER');
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}