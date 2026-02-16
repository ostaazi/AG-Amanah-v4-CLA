import { AppPermission, UserRole } from '../types';

interface RoleConfig {
  allow: string[];
  deny: string[];
}

const ROLE_MATRIX: Record<UserRole, RoleConfig> = {
  FAMILY_OWNER: { allow: ['*'], deny: [] },
  FAMILY_COADMIN: {
    allow: [
      'family.read',
      'family.update',
      'member.invite',
      'member.remove',
      'child.create',
      'child.update',
      'child.view_reports',
      'device.enroll',
      'device.lock',
      'device.net.block',
      'device.app.block',
      'device.camera.block',
      'device.mic.block',
      'device.location.view_live',
      'alert.read',
      'alert.ack',
      'policy.read',
      'mode.read',
      'evidence.read',
      'custody.read',
    ],
    deny: [
      'evidence.delete',
      'evidence.export',
      'evidence.legal_hold',
      'playbook.write',
      'member.update_role',
      'family.manage_security',
      'realtime.screenshot.request',
      'realtime.camera.view_live',
      'realtime.audio.listen',
    ],
  },
  FAMILY_AUDITOR: {
    allow: ['alert.read', 'evidence.read', 'custody.read', 'report.read', 'child.view_reports'],
    deny: ['device.*', 'realtime.*', 'evidence.delete', 'evidence.export', 'playbook.*', 'mode.write', 'policy.write'],
  },
  PLATFORM_ADMIN: { allow: ['*'], deny: [] },
  DEVELOPER: { allow: ['*'], deny: [] },
  ADMIN: { allow: ['*'], deny: [] },
  SRE: { allow: ['*'], deny: ['evidence.read', 'alert.read'] },
  SOC_ANALYST: { allow: ['family.read', 'report.read'], deny: ['evidence.*', 'realtime.*', 'child.*', 'device.*'] },
  RELEASE_MANAGER: { allow: ['*'], deny: [] },
  EMERGENCY_GUARDIAN: {
    allow: ['alert.read', 'alert.ack', 'device.lock', 'device.location.view_live'],
    deny: ['evidence.*', 'playbook.*', 'policy.*', 'realtime.*', 'device.unlock'],
  },
  SUPPORT_TECH: { allow: ['family.read'], deny: ['evidence.*', 'realtime.*', 'alert.read', 'child.view_reports', 'device.location.*'] },
  SUPERVISOR: { allow: ['family.read', 'alert.read'], deny: [] },
  PARENT_OWNER: { allow: ['*'], deny: [] },
  PARENT_GUARDIAN: {
    allow: ['family.read', 'alert.read', 'mode.read', 'device.lock', 'device.location.view_live', 'evidence.read'],
    deny: ['evidence.delete', 'evidence.export', 'playbook.write', 'family.manage_security'],
  },
  CHILD: { allow: ['child.self.read'], deny: ['*'] },
  DEVICE_IDENTITY: { allow: ['agent.heartbeat', 'agent.report'], deny: ['*'] },
};

const matchesWildcard = (permission: string, pattern: string): boolean => {
  if (pattern === '*') return true;
  if (pattern === permission) return true;
  if (!pattern.endsWith('.*')) return false;
  return permission.startsWith(pattern.slice(0, -1));
};

export const hasPermission = (role: UserRole, permission: AppPermission): boolean => {
  const config = ROLE_MATRIX[role] || { allow: [], deny: ['*'] };
  const denies = config.deny || [];
  const allows = config.allow || [];

  if (denies.some((pattern) => matchesWildcard(permission, pattern))) return false;
  return allows.some((pattern) => matchesWildcard(permission, pattern));
};

export const canPerform = (role: UserRole, permission: AppPermission): boolean =>
  hasPermission(role, permission);
