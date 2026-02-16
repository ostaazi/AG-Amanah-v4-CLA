import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../lib/auth';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

async function readLocalBuffer(storage_key: string) {
  const baseDir = process.env.STORAGE_LOCAL_DIR || path.join((process as any).cwd(), 'storage_local');
  const abs = path.join(baseDir, storage_key);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return fs.readFileSync(abs);
}

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const evidence = await prisma.evidence.findMany({
      where: { family_id: familyId },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Use the official Node.js bridge to Web Streams for maximum stability
    const webStream = (Readable as any).toWeb(archive);

    (async () => {
      try {
        archive.append(JSON.stringify({ 
          familyId, 
          generatedAt: new Date().toISOString(),
          system: "AMANAH_VAULT_NODE_01"
        }, null, 2), { name: 'manifest.json' });

        for (const e of evidence) {
          try {
            const buf = await readLocalBuffer(e.object_uri || '');
            archive.append(buf, { name: `evidence/${e.evidence_id}.bin` });
          } catch (err) { 
            console.warn("Skipping missing evidence during stream:", e.evidence_id);
          }
        }
        await archive.finalize();
      } catch (err) {
        archive.destroy(err as Error);
      }
    })();

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="AMANAH_PKG_${familyId}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Forensic Package Stream Failed');
  }
}