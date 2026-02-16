
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import { Buffer } from 'buffer';
import { appendCustodyEvent } from '../forensics/custody';

const STEPUP_JWT_SECRET = process.env.STEPUP_JWT_SECRET || 'AMANAH_SOVEREIGN_SECRET_KEY_MIN_64_CHARS';

export type StepUpScope =
  | 'export:evidence'
  | 'delete:evidence'
  | 'lock:device'
  | 'policy:edit'
  | 'admin:roles';

export type StepUpTokenPayload = {
  iss: 'amana-parent-console';
  sub: string; // user_id
  fam: string; // family_id
  jti: string; // stepup_id
  scopes: StepUpScope[];
};

export async function createStepUpSession(args: {
  familyId: string;
  userId: string;
  purpose: string;
  scopes: StepUpScope[];
  ip?: string;
  userAgent?: string;
}) {
  const otp = crypto.randomInt(100000, 999999).toString();
  const codeHash = crypto.createHash('sha256').update(otp).digest('hex');
  const stepupId = `su_${nanoid(24)}`;
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

  await (prisma as any).stepUpSession.create({
    data: {
      stepup_id: stepupId,
      family_id: args.familyId,
      user_id: args.userId,
      purpose: args.purpose,
      scopes_json: JSON.stringify(args.scopes),
      code_hash: codeHash,
      expires_at: expiresAt,
      ip: args.ip || null,
      user_agent: args.userAgent || null,
    },
  });

  // توثيق طلب التحقق في سجل الحيازة
  await appendCustodyEvent({
    familyId: args.familyId,
    userId: args.userId,
    eventKey: 'STEPUP_REQUESTED',
    actor: `parent:${args.userId}`,
    eventJson: { purpose: args.purpose, scopes: args.scopes, stepupId },
    ip: args.ip,
    userAgent: args.userAgent
  });

  return { stepupId, expiresAt, otp_dev: otp };
}

export async function verifyStepUpCode(args: {
  stepupId: string;
  familyId: string;
  userId: string;
  code: string;
}) {
  const s = await (prisma as any).stepUpSession.findUnique({ where: { stepup_id: args.stepupId } });
  
  if (!s || s.family_id !== args.familyId || s.user_id !== args.userId) throw new Error('Forbidden');
  if (new Date() > s.expires_at) throw new Error('OTP Expired');

  const inputHash = crypto.createHash('sha256').update(args.code).digest('hex');
  if (inputHash !== s.code_hash) {
     await appendCustodyEvent({
        familyId: args.familyId,
        userId: args.userId,
        eventKey: 'STEPUP_FAILED',
        actor: `parent:${args.userId}`,
        eventJson: { stepupId: args.stepupId, reason: 'Invalid OTP' }
     });
     throw new Error('Invalid code');
  }

  const scopes = JSON.parse(s.scopes_json || '[]') as StepUpScope[];
  const payload: StepUpTokenPayload = {
    iss: 'amana-parent-console',
    sub: args.userId,
    fam: args.familyId,
    jti: s.stepup_id,
    scopes,
  };

  const token = jwt.sign(payload, STEPUP_JWT_SECRET, { expiresIn: '5m' });

  await (prisma as any).stepUpSession.update({
    where: { stepup_id: s.stepup_id },
    data: { verified_at: new Date() }
  });

  await appendCustodyEvent({
    familyId: args.familyId,
    userId: args.userId,
    eventKey: 'STEPUP_VERIFIED',
    actor: `parent:${args.userId}`,
    eventJson: { stepupId: s.stepup_id, scopes }
  });

  return { token };
}

export async function consumeStepUpToken(args: {
  token: string;
  familyId: string;
  userId: string;
  requiredScope: StepUpScope;
}) {
  try {
    const decoded = jwt.verify(args.token, STEPUP_JWT_SECRET) as StepUpTokenPayload;
    if (decoded.fam !== args.familyId || decoded.sub !== args.userId) throw new Error('Identity mismatch');
    if (!decoded.scopes.includes(args.requiredScope)) throw new Error('Missing scope');

    const s = await (prisma as any).stepUpSession.findUnique({ where: { stepup_id: decoded.jti } });
    if (!s || !s.verified_at || s.used_at) throw new Error('Token already used or invalid');

    await (prisma as any).stepUpSession.update({
      where: { stepup_id: s.stepup_id },
      data: { used_at: new Date() }
    });

    await appendCustodyEvent({
      familyId: args.familyId,
      userId: args.userId,
      eventKey: 'STEPUP_CONSUMED',
      actor: `parent:${args.userId}`,
      eventJson: { stepupId: s.stepup_id, scope: args.requiredScope }
    });

    return true;
  } catch (e) {
    throw new Error('Unauthorized Action: Step-Up verification failed');
  }
}
