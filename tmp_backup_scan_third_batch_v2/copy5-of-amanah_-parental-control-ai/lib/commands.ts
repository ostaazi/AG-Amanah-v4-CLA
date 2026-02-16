import crypto from 'crypto';
import { prisma } from './prisma';
import { CommandEnvelope, signCommand } from './command-signing';

export function randomNonce() {
  return crypto.randomBytes(16).toString('hex');
}

export async function getDeviceKeys(device_id: string) {
  const k = await prisma.deviceKey.findUnique({
    where: { device_id },
    select: {
      shared_key_b64: true,
      family_id: true,
      key_version: true,
      next_shared_key_b64: true,
      next_key_version: true,
    },
  });
  if (!k) throw new Error('Device shared secret not initialized');
  return k;
}

export async function createSignedDeviceCommand(args: {
  device_id: string;
  incident_id?: string | null;
  command_type: string;
  payload: any;
  expiresInSec?: number;
}) {
  const expiresInSec = Math.max(15, Math.min(600, args.expiresInSec ?? 120));
  const nonce = randomNonce();
  
  // جلب المفتاح الحالي للتوقيع
  const keys = await getDeviceKeys(args.device_id);
  const now = new Date();
  const expires = new Date(now.getTime() + expiresInSec * 1000);
  const command_id = crypto.randomUUID();

  const envelope: CommandEnvelope = {
    command_id,
    device_id: args.device_id,
    incident_id: args.incident_id ?? null,
    command_type: args.command_type,
    payload: args.payload ?? {},
    nonce,
    issued_at_iso: now.toISOString(),
    expires_at_iso: expires.toISOString(),
    version: 1,
  };

  // الأوامر تُوقع دائماً بالمفتاح الحالي النشط
  const signature_hmac = signCommand(envelope, keys.shared_key_b64);

  const row = await prisma.deviceCommand.create({
    data: {
      command_id,
      family_id: keys.family_id,
      device_id: args.device_id,
      incident_id: args.incident_id ?? null,
      command_type: args.command_type,
      payload_json: args.payload ?? {},
      nonce,
      issued_at: now,
      expires_at: expires,
      status: 'QUEUED',
      signature_hmac,
    }
  });

  return { row, envelope, signature_hmac };
}