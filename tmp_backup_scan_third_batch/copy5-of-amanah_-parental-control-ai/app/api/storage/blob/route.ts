import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../lib/auth';
import { verifyEvidenceSignature } from '../../../lib/storage';
import { rateLimit } from '../../../lib/rateLimit';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function sanitizeFilename(s: string) {
  return String(s || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

function parseRangeHeader(range: string | null, fileSize: number) {
  if (!range) return null;
  const m = /^bytes=(\d+)-(\d+)?$/i.exec(range.trim());
  if (!m) return null;

  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : fileSize - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start) return null;
  if (start >= fileSize) return null;

  return { start, end: Math.min(end, fileSize - 1) };
}

export async function GET(req: NextRequest) {
  try {
    const principal = getPrincipal(req);

    const url = new URL(req.url);
    const evidence_id = String(url.searchParams.get('evidence_id') || '').trim();
    const exp = Number(url.searchParams.get('exp') || 0);
    const sig = String(url.searchParams.get('sig') || '').trim();
    const modeRaw = String(url.searchParams.get('mode') || 'download').trim().toLowerCase();
    const mode = (modeRaw === 'preview' ? 'preview' : 'download') as 'download' | 'preview';

    if (!evidence_id || !exp || !sig) throw new HttpError(400, 'Missing signed params');

    const now = Math.floor(Date.now() / 1000);
    if (exp < now) throw new HttpError(401, 'Signed URL expired');

    const okSig = verifyEvidenceSignature(evidence_id, exp, mode, sig);
    if (!okSig) throw new HttpError(401, 'Invalid signature');

    const ev = await prisma.evidence.findUnique({
      where: { evidence_id },
    });

    if (!ev) throw new HttpError(404, 'Evidence not found');
    if (!requireFamilyAccess(principal, ev.family_id)) throw new HttpError(403, 'Forbidden');

    const rlKey = `${principal.user_id || 'anon'}|${ev.family_id}|${mode}`;
    const rl = await rateLimit(rlKey, {
      prefix: 'evidence_blob',
      windowSec: 60,
      limit: mode === 'preview' ? 60 : 20,
    });

    if (!rl.ok) {
      return NextResponse.json({ error: { status: 429, message: 'Too many requests' } }, { status: 429 });
    }

    const driver = (getEnv('STORAGE_DRIVER', 'local') || 'local').toLowerCase();
    if (driver === 'local') {
      const baseDir = getEnv('STORAGE_LOCAL_DIR', path.join((process as any).cwd(), 'storage_local'));
      const absPath = path.join(baseDir, ev.object_uri || '');
      if (!fs.existsSync(absPath)) throw new HttpError(404, 'File missing on disk');

      const stat = fs.statSync(absPath);
      const range = req.headers.get('range');
      const r = parseRangeHeader(range, stat.size);

      const streamOptions = r ? { start: r.start, end: r.end } : {};
      const nodeStream = fs.createReadStream(absPath, streamOptions);
      
      // Use the standard bridge for Web Streams
      const webStream = (Readable as any).toWeb(nodeStream);

      const headers: any = {
        'Content-Type': ev.mime_type || 'application/octet-stream',
        'Content-Disposition': `${mode === 'preview' ? 'inline' : 'attachment'}; filename="${sanitizeFilename(ev.evidence_id)}.${ev.mime_type.split('/')[1] || 'bin'}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      };

      if (r) {
        headers['Content-Length'] = String(r.end - r.start + 1);
        headers['Content-Range'] = `bytes ${r.start}-${r.end}/${stat.size}`;
        return new Response(webStream, { status: 206, headers });
      }

      headers['Content-Length'] = String(stat.size);
      return new Response(webStream, { status: 200, headers });
    }

    throw new HttpError(500, 'Unsupported STORAGE_DRIVER');
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Blob Serving Error');
  }
}