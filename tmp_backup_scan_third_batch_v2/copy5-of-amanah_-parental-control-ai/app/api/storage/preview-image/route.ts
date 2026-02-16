import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../lib/auth';
import { verifyEvidenceSignature } from '../../../lib/storage';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
// Fix: Added Buffer import for Node.js environment compatibility
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function loadLocalBuffer(object_uri: string) {
  const baseDir = getEnv('STORAGE_LOCAL_DIR', path.join((process as any).cwd(), 'storage_local'));
  const abs = path.join(baseDir, object_uri);
  if (!fs.existsSync(abs)) throw new HttpError(404, 'File not found (local driver)');
  return fs.readFileSync(abs);
}

function watermarkSvg(text1: string, text2: string) {
  const safe1 = text1.replace(/[<>&"]/g, '');
  const safe2 = text2.replace(/[<>&"]/g, '');

  return Buffer.from(`
  <svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="p" width="420" height="220" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
        <text x="0" y="90" font-size="26" fill="rgba(0,0,0,0.10)" font-family="Arial, sans-serif">${safe1}</text>
        <text x="0" y="135" font-size="16" fill="rgba(0,0,0,0.10)" font-family="Arial, sans-serif">${safe2}</text>
      </pattern>
    </defs>
    <rect width="1200" height="900" fill="url(#p)"/>
  </svg>
  `);
}

export async function GET(req: NextRequest) {
  try {
    const principal = getPrincipal(req);

    const url = new URL(req.url);
    const evidence_id = String(url.searchParams.get('evidence_id') || '').trim();
    const exp = Number(url.searchParams.get('exp') || 0);
    const sig = String(url.searchParams.get('sig') || '').trim();
    const mode = 'preview';

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

    if (!String(ev.mime_type || '').toLowerCase().startsWith('image/')) {
      throw new HttpError(415, 'This endpoint is for image preview only');
    }

    const driver = (getEnv('STORAGE_DRIVER', 'local') || 'local').toLowerCase();

    // Use sharp for dynamic watermarking
    const sharp = (await import('sharp')).default;
    // Fix: Using imported Buffer to type the variable correctly
    let buf: Buffer;

    if (driver === 'local') {
      buf = await loadLocalBuffer(ev.object_uri || '');
    } else {
      throw new HttpError(500, 'S3 watermarking not configured in this module version');
    }

    const wm1 = `AMANA PREVIEW • FAMILY ${ev.family_id}`;
    const wm2 = `EVIDENCE ${ev.evidence_id} • ${new Date().toISOString()}`;
    const overlay = watermarkSvg(wm1, wm2);

    const out = await sharp(buf)
      .resize({ width: 1400, withoutEnlargement: true })
      .composite([{ input: overlay, blend: 'over', gravity: 'center' }])
      .jpeg({ quality: 88 })
      .toBuffer();

    // Audit custody
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
      user_id: principal.user_id || null,
      note: 'Watermarked image preview served',
    };

    const hash_payload = JSON.stringify({
      family_id: ev.family_id,
      incident_id: ev.incident_id,
      actor: 'PARENT_CONSOLE',
      event_key: 'EVIDENCE_WATERMARKED_PREVIEW',
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
        event_key: 'EVIDENCE_WATERMARKED_PREVIEW',
        event_at: created_at,
        event_json,
        prev_hash_hex,
        hash_hex,
      },
    });

    return new NextResponse(out as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="preview_${ev.evidence_id}.jpg"`,
      },
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}