
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, requireFatherRole, HttpError } from '../../../../../../lib/auth';
import { verifyStepUpToken } from '../../../../../../lib/step-up';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
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

    // التحقق من توكن Step-Up (إلزامي في هذه العملية)
    const stepUpToken = req.headers.get('x-step-up-token');
    if (!stepUpToken || !verifyStepUpToken(stepUpToken, principal.user_id!)) {
      throw new HttpError(403, 'Step-up verification required for this action');
    }

    const policy = await prisma.familyPolicy.findUnique({ where: { family_id: familyId } });
    const retention_days = policy?.retention_days ?? 90;

    const row = await prisma.evidenceDeleteRequest.findUnique({ where: { request_id: requestId } });
    if (!row) throw new HttpError(404, 'Request not found');
    if (row.family_id !== familyId) throw new HttpError(403, 'Forbidden');
    if (row.status !== 'APPROVED') throw new HttpError(409, 'Request must be APPROVED first');
    
    // بقية المنطق البرمجي...
    await prisma.evidenceItem.update({
      where: { evidence_id: row.evidence_id },
      data: {
        deleted_at: new Date(),
        deleted_by_user_id: principal.user_id,
        delete_request_id: requestId
      }
    });

    const updated = await prisma.evidenceDeleteRequest.update({
      where: { request_id: requestId },
      data: { status: 'EXECUTED', executed_at: new Date() }
    });

    return NextResponse.json({ ok: true, request: updated });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Unexpected error');
  }
}
