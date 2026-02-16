
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { sendInstantCommandSignal } from '../../../../../lib/push/pushService';
import { notifyFamily } from '../../../../../lib/notify/notify';
import { predictCommandFailureCause } from '../../../../../services/geminiService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const TIMEOUT_MS = 30000; // 30 ثانية
    const MAX_RETRIES = 2;

    // جلب الأوامر العالقة التي لم يتم تأكيدها
    const stuckCmds = await (prisma as any).deviceCommand.findMany({
      where: {
        status: { in: ['queued', 'sent', 'delivered'] },
        issued_at: { lt: new Date(Date.now() - TIMEOUT_MS) }
      },
      take: 20
    });

    for (const cmd of stuckCmds) {
      if (cmd.retry_count >= MAX_RETRIES) {
        // فشل نهائي - استدعاء Gemini للتحليل
        const analysis = await predictCommandFailureCause(cmd, []);
        
        await (prisma as any).deviceCommand.update({
          where: { cmd_id: cmd.cmd_id },
          data: { status: 'timed_out' }
        });

        await notifyFamily({
          familyId: cmd.family_id,
          severity: 'critical',
          title: `فشل تنفيذ أمر سيادي: ${cmd.cmd_type}`,
          body: `تحليل الذكاء الاصطناعي: ${analysis.predictedCause}. احتمال التلاعب: ${analysis.tamperProbability * 100}%`,
          data: { analysis, cmd_id: cmd.cmd_id },
          roleTarget: 'father'
        });
      } else {
        // محاولة إعادة الإرسال
        await (prisma as any).deviceCommand.update({
          where: { cmd_id: cmd.cmd_id },
          data: { retry_count: { increment: 1 }, status: 'queued' }
        });

        await sendInstantCommandSignal({
          familyId: cmd.family_id,
          deviceId: cmd.device_id,
          cmdId: cmd.cmd_id
        });
      }
    }

    return NextResponse.json({ ok: true, processed: stuckCmds.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
