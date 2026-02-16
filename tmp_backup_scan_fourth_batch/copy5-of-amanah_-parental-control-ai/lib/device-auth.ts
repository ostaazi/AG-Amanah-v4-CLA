
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { hashWithPepper } from './crypto';

export type DevicePrincipal = {
  family_id: string;
  device_id: string;
  token_id: string;
};

export class DeviceAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireDevicePrincipal(req: NextRequest): Promise<DevicePrincipal> {
  const token = req.headers.get('x-device-token') || '';
  if (!token || token.length < 20) throw new DeviceAuthError(401, 'Missing device token');

  const token_hash = hashWithPepper(token);

  const row = await prisma.deviceToken.findFirst({
    where: {
      token_hash,
      revoked_at: null,
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: {
      token_id: true,
      family_id: true,
      device_id: true,
    },
  });

  if (!row) throw new DeviceAuthError(401, 'Invalid or expired device token');

  // تحديث حالة النشاط الآني للجهاز والتوكن
  await prisma.deviceToken.update({
    where: { token_id: row.token_id },
    data: { last_used_at: new Date() },
  });

  await prisma.device.update({
    where: { device_id: row.device_id },
    data: { last_seen_at: new Date() },
  });

  return {
    family_id: row.family_id,
    device_id: row.device_id,
    token_id: row.token_id,
  };
}
