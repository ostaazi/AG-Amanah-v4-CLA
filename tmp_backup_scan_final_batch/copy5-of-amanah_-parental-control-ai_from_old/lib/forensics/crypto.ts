
import nacl from 'tweetnacl';
import stringify from 'fast-json-stable-stringify';
import { Buffer } from 'buffer';

function b64ToUint8(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

function uint8ToB64(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64');
}

export function canonicalJson(obj: any): string {
  // Stable keys + no whitespace
  return stringify(obj);
}

export function signManifest(manifestObj: any, privateKeyBase64: string): { manifestJson: string; signatureBase64: string } {
  const manifestJson = canonicalJson(manifestObj);
  const msg = new TextEncoder().encode(manifestJson);

  const priv = b64ToUint8(privateKeyBase64);
  // Ed25519 private key should be 64 bytes (secretKey)
  if (priv.length !== 64) {
    throw new Error(`Invalid Ed25519 private key length: ${priv.length} (expected 64 bytes secretKey)`);
  }

  const sig = nacl.sign.detached(msg, priv);
  return { manifestJson, signatureBase64: uint8ToB64(sig) };
}

export function verifyManifest(manifestJson: string, signatureBase64: string, publicKeyBase64: string): boolean {
  const msg = new TextEncoder().encode(manifestJson);
  const sig = b64ToUint8(signatureBase64);
  const pub = b64ToUint8(publicKeyBase64);

  if (pub.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: ${pub.length} (expected 32 bytes)`);
  }

  return nacl.sign.detached.verify(msg, sig, pub);
}
