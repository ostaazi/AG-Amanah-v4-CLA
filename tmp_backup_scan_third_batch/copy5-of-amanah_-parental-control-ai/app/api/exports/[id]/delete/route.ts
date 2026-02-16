import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, requireOwnerRole, HttpError } from '../../../../../lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const principal = getPrincipal(req);
    const export_id = params.id;

    const exp = await prisma.exportBundle.findUnique({
      where: { export_id },
      select: {
        export_id: true,
        family_id: true,
        incident_id: true,
        manifest_sha256_hex: true,
      },
    });

    if (!exp) throw new HttpError(404, 'Export not found');
    if (!requireFamilyAccess(principal, exp.family_id)) throw new HttpError(403, 'Forbidden');

    // مسموح فقط لمدير الأسرة (الأب)
    requireOwnerRole(principal);

    const created_at = new Date();
    const last = await prisma.custodyEvent.findFirst({
      where: { family_id: exp.family_id, incident_id: exp.incident_id },
      orderBy: { event_at: 'desc' },
      select: { hash_hex: true },
    });

    const prev_hash_hex = last?.hash_hex ?? null;
    const event_json = {
      export_id: exp.export_id,
      manifest_sha256_hex: exp.manifest_sha256_hex,
      deleted_by_user_id: principal.user_id || null,
    };

    const hash_payload = JSON.stringify({
      family_id: exp.family_id,
      incident_id: exp.incident_id,
      actor: 'PARENT_CONSOLE',
      event_key: 'EXPORT_DELETED',
      event_at: created_at.toISOString(),
      prev_hash_hex,
      event_json,
    });

    const hash_hex = sha256Hex(hash_payload);

    await prisma.custodyEvent.create({
      data: {
        family_id: exp.family_id,
        incident_id: exp.incident_id,
        actor: 'PARENT_CONSOLE',
        event_key: 'EXPORT_DELETED',
        event_at: created_at,
        event_json,
        prev_hash_hex,
        hash_hex,
      }
    });

    await prisma.exportBundle.delete({ where: { export_id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}