
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getPrincipal, HttpError } from '../../../../../lib/auth';
import { generateStepUpToken } from '../../../../../lib/step-up';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const principal = getPrincipal(req);
    const body = await req.json().catch(() => ({}));
    
    // في بيئة حقيقية، نتحقق من Firebase Auth أو كلمة المرور المخزنة
    // هنا سنقوم بمحاكاة التحقق من "كلمة مرور الأمان"
    const { secret_code } = body;
    
    if (!principal.user_id || !principal.family_id) throw new HttpError(401, 'Unauthorized');
    if (!secret_code) throw new HttpError(400, 'Security code is required');

    // محاكاة: نعتبر الكود صحيحاً إذا كان "123456" أو يطابق منطقاً معيناً
    // (يجب ربط هذا بكلمة مرور الحساب في الإنتاج)
    const isAuthorized = secret_code === "123456" || secret_code.length > 5;

    if (!isAuthorized) {
      // تسجيل محاولة فاشلة في سجل الحيازة (Anti-Brute Force Audit)
      await prisma.custodyEvent.create({
        data: {
          family_id: principal.family_id,
          actor: 'PARENT_CONSOLE',
          event_key: 'STEP_UP_FAILED',
          event_at: new Date(),
          event_json: { user_id: principal.user_id, reason: 'Invalid secret code' },
          hash_hex: sha256Hex(`failed-${Date.now()}`),
          prev_hash_hex: null
        } as any
      });
      throw new HttpError(403, 'Invalid security credentials');
    }

    // إصدار التوكن
    const token = generateStepUpToken(principal.user_id, principal.family_id);

    // تسجيل منح الصلاحية في سجل الحيازة (Forensic requirement)
    await prisma.custodyEvent.create({
      data: {
        family_id: principal.family_id,
        actor: 'PARENT_CONSOLE',
        event_key: 'STEP_UP_GRANTED',
        event_at: new Date(),
        event_json: { user_id: principal.user_id, ttl_min: 3 },
        hash_hex: sha256Hex(`granted-${token.slice(-10)}`),
        prev_hash_hex: null
      } as any
    });

    return NextResponse.json({ ok: true, step_up_token: token });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: { status, message: e?.message ?? 'Internal error' } }, { status });
  }
}
