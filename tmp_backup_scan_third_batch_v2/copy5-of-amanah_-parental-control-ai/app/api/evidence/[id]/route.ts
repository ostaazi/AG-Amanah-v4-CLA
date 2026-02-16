
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function cleanTags(tags: any): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map(x => String(x || '').trim().toLowerCase()).filter(Boolean).slice(0, 20);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const principal = getPrincipal(req);
    const evidence_id = params.id;
    const body = await req.json().catch(() => ({}));

    const ev = await prisma.evidence.findUnique({
      where: { evidence_id },
      select: { evidence_id: true, family_id: true, incident_id: true, tags: true, notes: true },
    });

    if (!ev) throw new HttpError(404, 'Evidence not found');
    if (!requireFamilyAccess(principal, ev.family_id)) throw new HttpError(403, 'Forbidden');

    const data: any = {};
    if (body.notes !== undefined) data.notes = String(body.notes).slice(0, 2000);
    if (body.tags !== undefined) data.tags = cleanTags(body.tags);

    if (body.redact === true) {
      // السماح فقط لمالك العائلة (FAMILY_OWNER) بالحجب
      // Fix: Use 'family_role' property and check against 'PARENT_OWNER' as defined in the Principal type
      if (principal.family_role !== 'PARENT_OWNER') throw new HttpError(403, 'Only family owner can redact evidence');
      data.object_uri = null;
      const oldTags = Array.isArray(ev.tags) ? ev.tags : [];
      data.tags = Array.from(new Set([...oldTags, 'redacted']));
      data.notes = `${data.notes || ev.notes || ''}\n\n[REDACTED] Evidence removed by admin.`;
    }

    const updated = await prisma.evidence.update({
      where: { evidence_id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        family_id: ev.family_id,
        // Fix: Changed 'principal_id' to 'user_id' as per Principal type in lib/auth.ts
        actor_user_id: principal.user_id,
        event_key: body.redact ? 'EVIDENCE_REDACTED' : 'EVIDENCE_UPDATED',
        event_json: { evidence_id, redact: !!body.redact },
      },
    });

    return NextResponse.json({ ok: true, evidence: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: e?.status ?? 500 });
  }
}
