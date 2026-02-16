
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireDevicePrincipal, DeviceAuthError } from '../../../lib/device-auth';
import { CommandStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const devicePrincipal = await requireDevicePrincipal(req);
    const now = new Date();

    const commands = await prisma.deviceCommand.findMany({
      where: {
        device_id: devicePrincipal.device_id,
        status: CommandStatus.QUEUED,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { created_at: 'asc' },
      take: 5,
    });

    if (commands.length > 0) {
      await prisma.deviceCommand.updateMany({
        where: { command_id: { in: commands.map((c) => c.command_id) } },
        data: { status: CommandStatus.SENT },
      });
    }

    return NextResponse.json({ commands });
  } catch (e: any) {
    const status = e instanceof DeviceAuthError ? e.status : 500;
    return NextResponse.json({ error: e?.message }, { status });
  }
}
