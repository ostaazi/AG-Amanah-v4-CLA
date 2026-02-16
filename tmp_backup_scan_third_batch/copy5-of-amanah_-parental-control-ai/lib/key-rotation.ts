import crypto from 'crypto';
import { prisma } from './prisma';

export function generateDeviceKeyB64(bytes = 32) {
  const buf = crypto.randomBytes(bytes);
  return buf.toString('base64');
}

/**
 * تجهيز المفتاح القادم دون تفعيل (Staging)
 */
export async function stageNextDeviceKey(device_id: string) {
  const dk = await prisma.deviceKey.findUnique({
    where: { device_id },
  });

  if (!dk) throw new Error('DeviceKey not found');

  if (dk.next_shared_key_b64) {
    return {
      next_version: dk.next_key_version,
      next_key_b64: dk.next_shared_key_b64,
      already_staged: true,
    };
  }

  const nextKey = generateDeviceKeyB64(32);
  const nextVersion = dk.key_version + 1;

  await prisma.deviceKey.update({
    where: { device_id },
    data: {
      next_key_version: nextVersion,
      next_shared_key_b64: nextKey,
    },
  });

  return {
    next_version: nextVersion,
    next_key_b64: nextKey,
    already_staged: false,
  };
}

/**
 * اعتماد المفتاح الجديد رسمياً بعد تأكد تثبيته في الجهاز
 */
export async function commitRotatedKey(device_id: string) {
  const dk = await prisma.deviceKey.findUnique({
    where: { device_id },
  });

  if (!dk || !dk.next_shared_key_b64) throw new Error('No next key staged');

  return await prisma.deviceKey.update({
    where: { device_id },
    data: {
      key_version: dk.next_key_version!,
      shared_key_b64: dk.next_shared_key_b64,
      next_key_version: null,
      next_shared_key_b64: null,
      rotated_at: new Date(),
    },
  });
}