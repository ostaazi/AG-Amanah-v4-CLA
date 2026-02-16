
import crypto from 'crypto';
import { Buffer } from 'buffer';

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

export function signManifestJson(manifestObj: any) {
  const privateKeyPem = getEnv('MANIFEST_SIGN_PRIVATE_KEY_PEM');
  if (!privateKeyPem) throw new Error('Missing MANIFEST_SIGN_PRIVATE_KEY_PEM');

  const canonical = JSON.stringify(manifestObj);
  const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKeyPem);

  return {
    canonical,
    signatureBase64: signature.toString('base64'),
    alg: 'Ed25519',
  };
}

export function verifyManifestSignature(manifestObj: any, signatureBase64: string) {
  const publicKeyPem = getEnv('MANIFEST_SIGN_PUBLIC_KEY_PEM');
  if (!publicKeyPem) throw new Error('Missing MANIFEST_SIGN_PUBLIC_KEY_PEM');

  const canonical = JSON.stringify(manifestObj);
  const sig = Buffer.from(signatureBase64, 'base64');

  return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKeyPem, sig);
}
