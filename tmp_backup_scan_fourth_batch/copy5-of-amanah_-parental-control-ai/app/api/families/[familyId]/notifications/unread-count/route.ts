
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) return NextResponse.json({ unread_count: 0 });

    const where: any = { family_id: familyId, is_read: false };
    if (principal.family_role === 'PARENT_GUARDIAN') {
      where.role_target = { in: ['mother', 'both'] };
    }

    const count = await (prisma as any).notificationEvent.count({ where });

    return NextResponse.json({ ok: true, unread_count: count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
