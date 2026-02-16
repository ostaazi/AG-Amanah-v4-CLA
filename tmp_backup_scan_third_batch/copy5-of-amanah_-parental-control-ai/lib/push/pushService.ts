
import { prisma } from '../prisma';
import { appendCustodyEvent } from '../forensics/custody';

export async function sendInstantCommandSignal(args: {
  familyId: string;
  deviceId: string;
  cmdId: string;
}) {
  // 1. جلب التوكنات النشطة للجهاز
  const tokens = await (prisma as any).devicePushToken.findMany({
    where: { device_id: args.deviceId, is_active: true },
    orderBy: { last_seen_at: 'desc' },
    take: 2
  });

  if (!tokens.length) {
    return { ok: false, mode: 'fallback_polling' };
  }

  // 2. محاكاة إرسال الإشارة عبر FCM (في الإنتاج نستخدم firebase-admin)
  console.log(`[FCM] Sending command_ready signal to device ${args.deviceId}`);
  
  // 3. توثيق محاولة الدفع في سجل الحيازة
  await appendCustodyEvent({
    familyId: args.familyId,
    deviceId: args.deviceId,
    eventKey: 'PUSH_SIGNAL_SENT',
    actor: 'system:push_engine',
    eventJson: { cmd_id: args.cmdId, token_count: tokens.length }
  });

  // تحديث حالة الأمر
  await (prisma as any).deviceCommand.update({
    where: { cmd_id: args.cmdId },
    data: { status: 'sent' }
  });

  return { ok: true, mode: 'push' };
}
