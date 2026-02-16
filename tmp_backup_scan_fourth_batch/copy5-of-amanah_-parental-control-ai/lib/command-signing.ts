import crypto from 'crypto';
import { Buffer } from 'buffer';

export type CommandEnvelope = {
  command_id: string;
  device_id: string;
  incident_id?: string | null;
  command_type: string;
  payload: any;
  nonce: string;
  issued_at_iso: string;
  expires_at_iso: string;
  version: number;
};

export type AckEnvelope = {
  command_id: string;
  device_id: string;
  status: 'ACKED' | 'FAILED';
  executed_at_iso: string;
  result: any;
  nonce: string;
  version: number;
};

export function hmacHex(data: string, keyB64: string) {
  const key = Buffer.from(keyB64, 'base64');
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * ترتيب الحقول بشكل متداخل لضمان ثبات البصمة الرقمية (Canonicalization)
 */
export function canonicalStringify(obj: any): string {
  return JSON.stringify(sortDeep(obj));
}

function sortDeep(x: any): any {
  if (Array.isArray(x)) return x.map(sortDeep);
  if (x && typeof x === 'object') {
    const keys = Object.keys(x).sort();
    const out: any = {};
    for (const k of keys) out[k] = sortDeep(x[k]);
    return out;
  }
  return x;
}

export function signCommand(envelope: CommandEnvelope, deviceKeyB64: string) {
  const canonical = canonicalStringify(envelope);
  return hmacHex(canonical, deviceKeyB64);
}

export function verifyCommand(envelope: CommandEnvelope, signature: string, deviceKeyB64: string) {
  const expected = signCommand(envelope, deviceKeyB64);
  return timingSafeEqualHex(expected, signature);
}

export function signAck(ack: AckEnvelope, deviceKeyB64: string) {
  const canonical = canonicalStringify(ack);
  return hmacHex(canonical, deviceKeyB64);
}

export function verifyAck(ack: AckEnvelope, signature: string, deviceKeyB64: string) {
  const expected = signAck(ack, deviceKeyB64);
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string) {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}