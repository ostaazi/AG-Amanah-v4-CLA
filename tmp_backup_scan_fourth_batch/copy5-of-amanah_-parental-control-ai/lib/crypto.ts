
import crypto from 'crypto';

const PEPPER = process.env.TOKEN_PEPPER || 'AMANAH_SOVEREIGN_SYSTEM_PEPPER_2024';

export function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hashWithPepper(secret: string) {
  return sha256Hex(`${secret}:${PEPPER}`);
}

export function randomCodeNumeric(length = 6) {
  const digits = '0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += digits[Math.floor(Math.random() * digits.length)];
  }
  return out;
}

export function randomTokenBase64Url(bytes = 32) {
  const raw = crypto.randomBytes(bytes);
  return raw
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
