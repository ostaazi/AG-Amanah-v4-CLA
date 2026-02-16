
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const status = (new URL(req.url)).searchParams.get('status');

    const items = await prisma.evidenceDeleteRequest.findMany({
      where: {
        family_id: familyId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 300,
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
