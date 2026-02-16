
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, requireFatherRole, HttpError } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function safeStr(v: any) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { familyId: string; requestId: string } }
) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;
    const requestId = params.requestId;

    requireFatherRole(principal, familyId);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').toUpperCase(); // APPROVE / REJECT
    const decision_note = safeStr(body?.decision_note);

    if (!['APPROVE', 'REJECT'].includes(action)) {
      throw new HttpError(400, 'Invalid action');
    }

    const row = await prisma.evidenceDeleteRequest.findUnique({ where: { request_id: requestId } });
    if (!row) throw new HttpError(404, 'Request not found');
    if (row.family_id !== familyId) throw new HttpError(403, 'Forbidden');
    if (row.status !== 'PENDING') throw new HttpError(409, 'Request is not pending');

    const updated = await prisma.evidenceDeleteRequest.update({
      where: { request_id: requestId },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approved_by_user_id: principal.user_id || null,
        approved_at: new Date(),
        decision_note: decision_note || null,
      },
    });

    // Integrity Log
    await prisma.custodyLog.create({
      data: {
        evidence_id: row.evidence_id,
        actor_user_id: principal.user_id || undefined,
        action: 'HOLD', // Using existing enum or appropriate action
        reason: action === 'APPROVE' ? 'DELETE_REQUEST_APPROVED' : 'DELETE_REQUEST_REJECTED',
      } as any,
    });

    return NextResponse.json({ ok: true, request: updated });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
