import crypto from 'crypto';
import { Buffer } from 'buffer';

export type SignedEvidenceUrl = {
  url: string;
  exp: number;
  mode: 'download' | 'preview';
};

function mustGetEnv(name: string, fallback = '') {
  const v = process.env[name] || fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function hmacSha256Hex(secret: string, data: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Payload format:
 * evidence_id|exp|mode
 */
export function signEvidenceUrl(
  evidence_id: string,
  mode: 'download' | 'preview' = 'download',
  expiresInSec = 120
): SignedEvidenceUrl {
  const secret = mustGetEnv('STORAGE_SIGNING_SECRET', 'DEV_ONLY_CHANGE_ME_LONG_SECRET_KEY');
  const exp = Math.floor(Date.now() / 1000) + Math.max(30, expiresInSec);

  const payload = `${evidence_id}|${exp}|${mode}`;
  const sig = hmacSha256Hex(secret, payload);

  const url =
    `/api/storage/blob?evidence_id=${encodeURIComponent(evidence_id)}` +
    `&exp=${exp}&mode=${mode}&sig=${sig}`;

  return { url, exp, mode };
}

export function verifyEvidenceSignature(
  evidence_id: string,
  exp: number,
  mode: 'download' | 'preview',
  sig: string
) {
  const secret = mustGetEnv('STORAGE_SIGNING_SECRET', 'DEV_ONLY_CHANGE_ME_LONG_SECRET_KEY');
  const payload = `${evidence_id}|${exp}|${mode}`;
  const expected = hmacSha256Hex(secret, payload);

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig || '', 'hex');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
