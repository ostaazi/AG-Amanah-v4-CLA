// Fix: Added Buffer import for Node.js environment compatibility
import { Buffer } from 'buffer';
import crypto from 'crypto';

export type IntegrityPayload = {
  incident_id: string;
  artifact_type: string;
  snapshot_sha256: string;
  created_at_iso: string;
  version: number;
};

// Fix: Correctly typed Buffer parameter
export function sha256Hex(input: string | Buffer) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function signHmac(payload: IntegrityPayload, secret: string) {
  const normalized = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

export function verifyHmac(payload: IntegrityPayload, signature: string, secret: string) {
  const expected = signHmac(payload, secret);
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string) {
  try {
    // Fix: Using imported Buffer to convert hex strings
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function requireIntegritySecret() {
  const secret = process.env.AMANA_INTEGRITY_SECRET || 'DEFAULT_UNSAFE_SECRET_FOR_DEV_ONLY_32_CHARS';
  if (!secret || secret.length < 32) {
    console.warn('Integrity secret is weak or not configured');
  }
  return secret;
}