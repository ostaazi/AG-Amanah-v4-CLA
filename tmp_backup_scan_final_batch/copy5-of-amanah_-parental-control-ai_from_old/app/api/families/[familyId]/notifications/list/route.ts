
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const url = new URL(req.url);
    const severity = url.searchParams.get('severity');
    const unreadOnly = url.searchParams.get('unread') === '1';
    const q = (url.searchParams.get('q') || '').trim();
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('take') || '20')));

    const where: any = { family_id: familyId };

    // فلترة بناءً على رتبة المستخدم
    if (principal.family_role === 'PARENT_GUARDIAN') {
      where.role_target = { in: ['mother', 'both'] };
    }

    if (severity) where.severity = severity;
    if (unreadOnly) where.is_read = false;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await (prisma as any).notificationEvent.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { notif_id: cursor } } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const next_cursor = hasMore ? page[page.length - 1]?.notif_id : null;

    return NextResponse.json({ ok: true, items: page, next_cursor });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
