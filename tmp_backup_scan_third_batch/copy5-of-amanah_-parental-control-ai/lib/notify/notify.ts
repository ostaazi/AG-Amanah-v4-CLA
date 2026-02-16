
import { prisma } from '../prisma';

export type NotifySeverity = 'info' | 'warning' | 'critical';
export type NotifyTarget = 'father' | 'mother' | 'both';

export async function notifyFamily(args: {
  familyId: string;
  severity: NotifySeverity;
  title: string;
  body: string;
  data?: any;
  roleTarget?: NotifyTarget;
  userId?: string | null;
}) {
  return await (prisma as any).notificationEvent.create({
    data: {
      family_id: args.familyId,
      user_id: args.userId || null,
      role_target: args.roleTarget || 'both',
      severity: args.severity,
      title: args.title,
      body: args.body,
      data_json: JSON.stringify(args.data || {}),
      is_read: false,
    },
  });
}
