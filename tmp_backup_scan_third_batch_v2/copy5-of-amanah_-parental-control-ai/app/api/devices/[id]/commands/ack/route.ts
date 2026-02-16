import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { verifyAck } from '../../../../../lib/command-signing';
import { commitRotatedKey } from '../../../../../lib/key-rotation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const device_id = params.id;
    const body = await req.json();
    const { ack, ack_signature } = body;

    const dk = await prisma.deviceKey.findUnique({ where: { device_id } });
    if (!dk) return NextResponse.json({ error: 'Keys not found' }, { status: 404 });

    const cmd = await prisma.deviceCommand.findUnique({ where: { command_id: ack.command_id } });
    if (!cmd) return NextResponse.json({ error: 'Command not found' }, { status: 404 });

    // 1. التحقق بالمفتاح الحالي أولاً
    let verified = verifyAck(ack, ack_signature, dk.shared_key_b64);
    let rotation_committed = false;

    // 2. حالة خاصة: إذا كان الأمر "تدوير مفتاح"، نتحقق بالمفتاح الجديد المتوقع
    if (!verified && cmd.command_type === 'ROTATE_KEY' && dk.next_shared_key_b64) {
      verified = verifyAck(ack, ack_signature, dk.next_shared_key_b64);
      if (verified && ack.status === 'ACKED') {
        await commitRotatedKey(device_id);
        rotation_committed = true;
      }
    }

    if (!verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

    await prisma.deviceCommand.update({
      where: { command_id: ack.command_id },
      data: { status: ack.status, acked_at: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        family_id: dk.family_id,
        actor_user_id: `device:${device_id}`,
        event_key: rotation_committed ? 'KEY_ROTATION_SUCCESS' : 'COMMAND_ACK',
        event_json: { command_id: ack.command_id, rotation: rotation_committed },
      }
    });

    return NextResponse.json({ ok: true, rotation_committed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}