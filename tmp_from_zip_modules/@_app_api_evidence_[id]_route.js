import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '@/lib/auth';
import { CustodyAction } from '@prisma/client';
export const dynamic = 'force-dynamic';
export async function GET(req, { params }) {
    try {
        const principal = getPrincipal(req);
        const id = params.id;
        const item = await prisma.evidence.findUnique({
            where: { evidence_id: id },
            include: { custody: { orderBy: { created_at: 'asc' } } }
        });
        if (!item)
            throw new HttpError(404, 'Evidence not found');
        if (!requireFamilyAccess(principal, item.family_id))
            throw new HttpError(403, 'Forbidden');
        // Custody record: VIEW (Recorded for audit)
        await prisma.custodyLog.create({
            data: {
                evidence_id: id,
                actor_user_id: principal.principal_id,
                action: CustodyAction.VIEW,
                reason: "Manual Review"
            }
        });
        return NextResponse.json({
            item,
            custody: item.custody,
            notes: item.notes
        });
    }
    catch (e) {
        return NextResponse.json({ error: e?.message }, { status: e?.status ?? 500 });
    }
}
