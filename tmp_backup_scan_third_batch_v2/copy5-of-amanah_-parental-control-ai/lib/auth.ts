
import { NextRequest } from 'next/server';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Principal = {
  user_id: string | null;
  family_id: string | null;
  family_role: 'PARENT_OWNER' | 'PARENT_GUARDIAN' | 'ADMIN' | 'SUPPORT' | 'DEV' | 'SECURITY' | 'UNKNOWN';
};

/**
 * استخراج هوية المستخدم من الترويسات (Headers)
 */
export function getPrincipal(req: NextRequest): Principal {
  const user_id = req.headers.get('x-user-id');
  const family_id = req.headers.get('x-family-id');
  const family_role_raw = (req.headers.get('x-family-role') || 'UNKNOWN').toUpperCase();

  const allowed = new Set([
    'PARENT_OWNER',
    'PARENT_GUARDIAN',
    'ADMIN',
    'SUPPORT',
    'DEV',
    'SECURITY',
    'UNKNOWN',
  ]);

  const family_role = (allowed.has(family_role_raw) ? family_role_raw : 'UNKNOWN') as Principal['family_role'];

  return {
    user_id: user_id ? String(user_id) : null,
    family_id: family_id ? String(family_id) : null,
    family_role,
  };
}

export function requireFamilyAccess(principal: Principal, family_id: string): boolean {
  if (principal.family_id && principal.family_id === family_id) return true;
  if (principal.family_role === 'ADMIN' || principal.family_role === 'SECURITY') return true;
  return false;
}

export function requireOwnerRole(principal: Principal) {
  if (principal.family_role !== 'PARENT_OWNER') {
    throw new HttpError(403, 'Required PARENT_OWNER role');
  }
}

export function requireFatherRole(principal: Principal, family_id: string) {
  // Enterprise terminology: Father usually maps to PARENT_OWNER
  if (principal.family_role !== 'PARENT_OWNER') {
    throw new HttpError(403, 'Required Father/Owner role for this operation');
  }
  if (!requireFamilyAccess(principal, family_id)) {
    throw new HttpError(403, 'Forbidden family context');
  }
}
