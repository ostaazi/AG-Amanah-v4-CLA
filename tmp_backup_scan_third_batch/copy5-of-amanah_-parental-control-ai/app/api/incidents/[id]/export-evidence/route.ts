
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const principal = getPrincipal(req);
    const incident_id = params.id;

    const incident = await prisma.incident.findUnique({
      where: { incident_id },
    });

    if (!incident) throw new HttpError(404, 'Incident not found');
    if (!requireFamilyAccess(principal, incident.family_id)) throw new HttpError(403, 'Forbidden');

    const evidence = await prisma.evidence.findMany({
      where: { incident_id },
      orderBy: { created_at: 'asc' },
    });

    // تسجيل عملية التصدير في سجل الحيازة
    await prisma.auditLog.create({
      data: {
        family_id: incident.family_id,
        // Fix: Changed 'principal_id' to 'user_id' as per Principal type in lib/auth.ts
        actor_user_id: principal.user_id,
        event_key: 'EVIDENCE_EXPORTED',
        event_json: { incident_id, evidence_count: evidence.length },
      },
    });

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      incident,
      evidence
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: e?.status ?? 500 });
  }
}
