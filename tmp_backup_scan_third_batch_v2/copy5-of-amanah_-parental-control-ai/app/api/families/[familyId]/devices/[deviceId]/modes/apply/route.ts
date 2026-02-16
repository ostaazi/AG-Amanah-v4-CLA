
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, requireFatherRole, HttpError } from '../../../../../../lib/auth';
import { appendCustodyEvent } from '../../../../../../lib/forensics/custody';

export const dynamic = 'force-dynamic';

function getModeProfile(modeKey: string) {
  const profiles: Record<string, any> = {
    'STUDY': [
      { key: 'APP_KILL_AND_BLOCK', payload: { categories: ['social', 'games'], msg: 'وقت المذاكرة نشط' }, severity: 'high' },
      { key: 'BLOCK_INTERNET', payload: { whitelist: ['*.edu.sa', 'wikipedia.org'] }, severity: 'high' }
    ],
    'SLEEP': [
      { key: 'LOCK_SCREEN', payload: { message: 'حان وقت النوم الآن' }, severity: 'critical' },
      { key: 'BLOCK_INTERNET', payload: { mode: 'full_block' }, severity: 'critical' }
    ]
  };
  return profiles[modeKey] || [];
}

export async function POST(req: NextRequest, { params }: { params: { familyId: string; deviceId: string } }) {
  try {
    const principal = getPrincipal(req);
    const { familyId, deviceId } = params;
    const body = await req.json();
    const { mode_key } = body;

    requireFatherRole(principal, familyId);

    const device = await prisma.childDevice.findUnique({ where: { device_id: deviceId } });
    if (!device || device.family_id !== familyId) throw new HttpError(404, 'Device not found');

    const commands = getModeProfile(mode_key);
    const issuedIds: string[] = [];

    // تنفيذ المعاملة (Transaction) لإصدار الأوامر وتحديث حالة الوضع
    await prisma.$transaction([
      prisma.deviceMode.updateMany({
        where: { family_id: familyId, device_id: deviceId },
        data: { is_active: false }
      }),
      // ملاحظة: في الإنتاج يتم استخدام createMany أو Loop داخل الـ Transaction
      ...commands.map((cmd: any) => prisma.deviceCommand.create({
        data: {
          family_id: familyId,
          device_id: deviceId,
          command_key: cmd.key,
          payload_json: JSON.stringify(cmd.payload),
          requested_by: principal.user_id!,
          status: 'queued',
          priority: cmd.severity === 'critical' ? 10 : 7
        }
      }))
    ]);

    await appendCustodyEvent({
      familyId,
      deviceId,
      userId: principal.user_id,
      eventKey: 'DEVICE_MODE_APPLIED',
      actor: `parent:${principal.user_id}`,
      eventJson: { mode_key, command_count: commands.length }
    });

    return NextResponse.json({ ok: true, mode: mode_key });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
