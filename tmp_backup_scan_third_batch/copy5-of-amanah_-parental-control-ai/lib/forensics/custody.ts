
import { Buffer } from 'buffer';
import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';
import { prisma } from '../prisma';

/**
 * محرك النزاهة الجنائية لـ Amanah
 */

function sha256Hex(text: string): string {
  // Fix: Added Buffer import for Node.js environment compatibility
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf-8')).digest('hex');
}

function canonicalJson(obj: any): string {
  return stringify(obj);
}

export type CustodyWriteArgs = {
  familyId: string;
  incidentId?: string | null;
  deviceId?: string | null;
  userId?: string | null;
  eventKey: string;
  actor: string; 
  eventJson: any;
  ip?: string | null;
  userAgent?: string | null;
};

export async function appendCustodyEvent(args: CustodyWriteArgs) {
  // جلب آخر حدث في السلسلة لربط الهاش (Blockchain-like chaining)
  const last = await prisma.custodyEvent.findFirst({
    where: {
      family_id: args.familyId,
      ...(args.incidentId ? { incident_id: args.incidentId } : {}),
    } as any,
    orderBy: { event_at: 'desc' } as any,
  });

  const prevHash = last?.hash_hex || 'ROOT_GENESIS';

  const payload = {
    family_id: args.familyId,
    incident_id: args.incidentId || null,
    device_id: args.deviceId || null,
    user_id: args.userId || null,
    event_key: args.eventKey,
    actor: args.actor,
    event_at_iso: new Date().toISOString(),
    event_json: args.eventJson,
    prev_hash_hex: prevHash,
    ip: args.ip || null,
    user_agent: args.userAgent || null,
  };

  const hashHex = sha256Hex(canonicalJson(payload));

  return await prisma.custodyEvent.create({
    data: {
      family_id: args.familyId,
      incident_id: args.incidentId || null,
      device_id: args.deviceId || null,
      actor_user_id: args.userId || null,
      event_key: args.eventKey,
      actor: args.actor,
      event_at: new Date(),
      event_json: args.eventJson,
      prev_hash_hex: prevHash,
      hash_hex: hashHex,
    } as any,
  });
}
