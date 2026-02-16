
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../lib/auth';
import { ContentType, EvidenceClassification, Severity } from '@prisma/client';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function parseCSV<T extends string>(v: string | null): T[] {
  if (!v) return [];
  return v.split(',').map((x) => x.trim()).filter(Boolean) as T[];
}

export async function GET(req: NextRequest) {
  try {
    const principal = getPrincipal(req);
    const { searchParams } = new URL(req.url);

    const familyId = searchParams.get('family_id') || principal.family_id;
    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const childId = searchParams.get('child_id');
    const deviceId = searchParams.get('device_id');
    const classification = searchParams.get('classification')?.toUpperCase() as EvidenceClassification | undefined;
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const datePreset = (searchParams.get('date') || '7d') as '7d' | '30d' | 'all';

    const contentTypes = parseCSV<string>(searchParams.get('content_types')).map(x => x.toUpperCase()) as ContentType[];
    const severities = parseCSV<string>(searchParams.get('severities')).map(x => x.toUpperCase()) as Severity[];

    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 5), 60);

    let createdAtGte: Date | undefined = undefined;
    if (datePreset !== 'all') {
      const days = datePreset === '7d' ? 7 : 30;
      createdAtGte = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    const where: any = { family_id: familyId };
    if (childId) where.child_id = childId;
    if (deviceId) where.device_id = deviceId;
    if (createdAtGte) where.created_at = { gte: createdAtGte };
    if (classification) where.classification = classification;
    if (contentTypes.length > 0) where.content_type = { in: contentTypes };
    if (severities.length > 0) where.severity = { in: severities };
    if (search) {
      where.OR = [
        { summary: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const items = await prisma.evidence.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { evidence_id: cursor } } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const next_cursor = hasMore ? page[page.length - 1]?.evidence_id ?? null : null;

    return NextResponse.json({ items: page, next_cursor }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Internal Server Error');
  }
}
