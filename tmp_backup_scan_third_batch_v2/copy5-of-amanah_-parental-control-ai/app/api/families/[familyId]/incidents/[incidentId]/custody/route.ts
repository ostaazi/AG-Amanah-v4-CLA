
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

export async function GET(req: NextRequest, { params }: { params: { familyId: string; incidentId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;
    const incidentId = params.incidentId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const items = await prisma.custodyEvent.findMany({
      where: { family_id: familyId, incident_id: incidentId },
      orderBy: { event_at: 'asc' },
      take: 10000,
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
