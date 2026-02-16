
import crypto from 'crypto';
import { Buffer } from 'buffer';

const STEP_UP_SECRET = process.env.STEP_UP_SECRET || 'AMANAH_INTERNAL_STEP_UP_SECRET_MIN_32_CHARS';
const TOKEN_TTL_MS = 3 * 60 * 1000; // 3 دقائق

export type StepUpTokenPayload = {
  user_id: string;
  family_id: string;
  exp: number;
};

/**
 * توليد توكن HMAC قصير العمر
 */
export function generateStepUpToken(user_id: string, family_id: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = JSON.stringify({ user_id, family_id, exp });
  
  const hmac = crypto.createHmac('sha256', STEP_UP_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  // ندمج الحمولة مع التوقيع في سلسلة واحدة مشفرة بـ Base64
  return Buffer.from(JSON.stringify({ p: payload, s: signature })).toString('base64');
}

/**
 * التحقق من سلامة وصلاحية التوكن
 */
export function verifyStepUpToken(token: string, expected_user_id: string): boolean {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const { p: payloadStr, s: signature } = raw;
    
    // 1. التحقق من التوقيع (Integrity Check)
    const hmac = crypto.createHmac('sha256', STEP_UP_SECRET);
    hmac.update(payloadStr);
    const expectedSignature = hmac.digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return false;
    }
    
    // 2. التحقق من البيانات والوقت (Expiration Check)
    const payload: StepUpTokenPayload = JSON.parse(payloadStr);
    if (payload.user_id !== expected_user_id) return false;
    if (Date.now() > payload.exp) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}
