
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../lib/auth';
import { signEvidenceUrl } from '../../../../lib/storage';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 100);
}

function safeStr(v: string | null) {
  const s = (v || '').trim();
  return s.length ? s : null;
}

function safeDateISO(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const url = new URL(req.url);

    const type = safeStr(url.searchParams.get('type'));
    const device_id = safeStr(url.searchParams.get('device_id'));
    const incident_id = safeStr(url.searchParams.get('incident_id'));
    const q = safeStr(url.searchParams.get('q'));

    const from = safeDateISO(url.searchParams.get('from'));
    const to = safeDateISO(url.searchParams.get('to'));

    const limit = toInt(url.searchParams.get('limit'), 30);
    const cursor = safeStr(url.searchParams.get('cursor'));

    const where: any = {
      family_id: familyId,
      deleted_at: null, // Patch: Exclude soft-deleted evidence
      ...(type ? { evidence_type: type } : {}),
      ...(device_id ? { device_id } : {}),
      ...(incident_id ? { incident_id } : {}),
      ...(from || to
        ? {
            created_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { summary: { contains: q, mode: 'insensitive' } },
              { storage_key: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cursor ? { evidence_id: { lt: cursor } } : {}),
    };

    const rows = await prisma.evidenceItem.findMany({
      where,
      orderBy: { captured_at: 'desc' },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const next_cursor = hasMore ? sliced[sliced.length - 1]?.evidence_id ?? null : null;

    const items = sliced.map((e) => {
      const download = signEvidenceUrl(e.evidence_id, 'download', 120);
      const preview = signEvidenceUrl(e.evidence_id, 'preview', 120);
      return {
        ...e,
        captured_at: e.captured_at.toISOString(),
        download_url: download.url,
        download_exp: download.exp,
        preview_url: preview.url,
        preview_exp: preview.exp,
      };
    });

    return NextResponse.json({ ok: true, items, next_cursor }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
