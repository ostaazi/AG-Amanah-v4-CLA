
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    if (!requireFamilyAccess(principal, params.familyId)) throw new HttpError(403, 'Forbidden');

    const policy = await (prisma as any).defensePolicy.findUnique({
      where: { family_id: params.familyId }
    });

    return NextResponse.json({ ok: true, policy: policy || {} });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    // التحقق من الرتبة السيادية للأب
    if (principal.family_role !== 'PARENT_OWNER') throw new HttpError(403, 'Only family owner can modify defense policy');

    const body = await req.json();
    const updated = await (prisma as any).defensePolicy.upsert({
      where: { family_id: params.familyId },
      update: body,
      create: { ...body, family_id: params.familyId }
    });

    return NextResponse.json({ ok: true, policy: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
