
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, requireFatherRole, HttpError } from '../../../../lib/auth';
import { enqueueCommands } from '../../../../lib/policy-engine';
import { consumeStepUpToken } from '../../../../lib/stepup/stepup';
import { CommandType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const principal = getPrincipal(req);
    const device_id = params.id;
    const body = await req.json().catch(() => ({}));

    // 1. التحقق الأساسي من الصلاحيات
    if (!principal.user_id || !principal.family_id) throw new HttpError(401, 'Unauthorized');
    requireFatherRole(principal, principal.family_id);

    // 2. فرض التحقق من توكن Step-Up (إلزامي للعمليات السيادية)
    const stepUpToken = req.headers.get('x-step-up-token') || '';
    await consumeStepUpToken({
      token: stepUpToken,
      familyId: principal.family_id,
      userId: principal.user_id,
      requiredScope: 'lock:device'
    });

    const device = await prisma.device.findUnique({
      where: { device_id },
      select: { device_id: true, family_id: true },
    });

    if (!device) throw new HttpError(404, 'Device not found');
    if (!requireFamilyAccess(principal, device.family_id)) throw new HttpError(403, 'Forbidden');

    const commands = [
      { type: CommandType.LOCKSCREEN_BLACKOUT, payload: { enabled: true, message: body.message || 'Emergency Lock' } },
      { type: CommandType.NET_QUARANTINE, payload: { mode: 'deny_all_except_amanah' } },
      { type: CommandType.SCREENSHOT_CAPTURE, payload: { reason: 'manual_lockdown_step_up' } },
    ];

    const queued = await enqueueCommands({
      family_id: device.family_id,
      device_id: device.device_id,
      issued_by_user_id: principal.user_id,
      commands,
      ttl_sec: 120,
    });

    return NextResponse.json({ ok: true, commands_sent: queued.length });
  } catch (e: any) {
    const status = e?.status || 403;
    return NextResponse.json({ error: { status, message: e?.message ?? 'Action Blocked' } }, { status });
  }
}
