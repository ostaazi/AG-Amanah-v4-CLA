import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '@/app/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(req, { params }) {
    try {
        const principal = getPrincipal(req);
        const incident_id = params.id;
        const incident = await prisma.incident.findUnique({
            where: { incident_id },
            select: { incident_id: true, family_id: true, created_at: true, device_id: true },
        });
        if (!incident)
            throw new HttpError(404, 'Incident not found');
        if (!requireFamilyAccess(principal, incident.family_id))
            throw new HttpError(403, 'Forbidden');
        const [evidence, commands, agentEvents, audits] = await Promise.all([
            prisma.evidence.findMany({ where: { incident_id }, orderBy: { created_at: 'asc' } }),
            prisma.deviceCommand.findMany({
                where: { device_id: incident.device_id, created_at: { gte: new Date(incident.created_at.getTime() - 30000) } },
                orderBy: { created_at: 'asc' }
            }),
            prisma.agentEvent.findMany({
                where: { device_id: incident.device_id, created_at: { gte: new Date(incident.created_at.getTime() - 30000) } },
                orderBy: { created_at: 'asc' }
            }),
            prisma.auditLog.findMany({
                where: { family_id: incident.family_id, created_at: { gte: new Date(incident.created_at.getTime() - 30000) } },
                orderBy: { created_at: 'asc' }
            })
        ]);
        const timeline = [
            ...evidence.map(x => ({ t: x.created_at, type: 'EVIDENCE', data: x })),
            ...commands.map(x => ({ t: x.created_at, type: 'COMMAND', data: x })),
            ...agentEvents.map(x => ({ t: x.created_at, type: 'AGENT_EVENT', data: x })),
            ...audits.map(x => ({ t: x.created_at, type: 'AUDIT', data: x }))
        ].sort((a, b) => a.t.getTime() - b.t.getTime());
        return NextResponse.json({ timeline });
    }
    catch (e) {
        return NextResponse.json({ error: e?.message }, { status: e?.status ?? 500 });
    }
}
