
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;
    const body = await req.json();

    if (!requireFamilyAccess(principal, familyId)) return NextResponse.json({ ok: false }, { status: 403 });

    if (body.all) {
      await (prisma as any).notificationEvent.updateMany({
        where: { family_id: familyId, is_read: false },
        data: { is_read: true }
      });
    } else if (body.notif_id) {
      await (prisma as any).notificationEvent.update({
        where: { notif_id: body.notif_id },
        data: { is_read: true }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
