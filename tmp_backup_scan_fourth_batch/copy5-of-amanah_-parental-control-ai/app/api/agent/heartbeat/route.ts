
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireDevicePrincipal, DeviceAuthError } from '../../../lib/device-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const devicePrincipal = await requireDevicePrincipal(req);
    const body = await req.json().catch(() => ({}));

    await prisma.agentEvent.create({
      data: {
        family_id: devicePrincipal.family_id,
        device_id: devicePrincipal.device_id,
        event_key: 'AGENT_HEARTBEAT',
        event_json: body,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e instanceof DeviceAuthError ? e.status : 500;
    return NextResponse.json({ error: e?.message }, { status });
  }
}
