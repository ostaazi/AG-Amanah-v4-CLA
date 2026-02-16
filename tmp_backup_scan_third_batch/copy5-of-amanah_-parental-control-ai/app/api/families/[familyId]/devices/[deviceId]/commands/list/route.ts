
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { familyId: string; deviceId: string } }) {
  try {
    const principal = getPrincipal(req);
    const { familyId, deviceId } = params;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');

    const device = await prisma.childDevice.findUnique({ where: { device_id: deviceId } });
    if (!device || device.family_id !== familyId) throw new HttpError(404, 'Device not found');

    const commands = await prisma.deviceCommand.findMany({
      where: { family_id: familyId, device_id: deviceId },
      orderBy: { requested_at: 'desc' },
      take: 50,
    });

    // جلب الـ ACKs المرتبطة بالأوامر
    const acks = await prisma.deviceCommandAck.findMany({
      where: { command_id: { in: commands.map(c => c.command_id) } }
    });

    return NextResponse.json({
      ok: true,
      device,
      commands: commands.map(c => ({
        ...c,
        payload: JSON.parse(c.payload_json),
        acks: acks.filter(a => a.command_id === c.command_id).map(a => ({
          ...a,
          details: JSON.parse(a.details_json)
        }))
      }))
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
