
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
      select: { incident_id: true, family_id: true },
    });

    if (!incident) throw new HttpError(404, 'Incident not found');
    if (!requireFamilyAccess(principal, incident.family_id)) throw new HttpError(403, 'Forbidden');

    const items = await prisma.evidence.findMany({
      where: { incident_id },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: e?.status ?? 500 });
  }
}
