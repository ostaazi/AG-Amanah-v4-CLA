import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 100);
}

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const url = new URL(req.url);
    const limit = toInt(url.searchParams.get('limit'), 30);
    const cursor = url.searchParams.get('cursor');

    const items = await prisma.exportBundle.findMany({
      where: {
        family_id: familyId,
        ...(cursor ? { export_id: { lt: cursor } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      select: {
        export_id: true,
        incident_id: true,
        created_at: true,
        created_by_user_id: true,
        manifest_sha256_hex: true,
      },
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    const next_cursor = hasMore ? sliced[sliced.length - 1]?.export_id ?? null : null;

    return NextResponse.json({ ok: true, items: sliced, next_cursor });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}