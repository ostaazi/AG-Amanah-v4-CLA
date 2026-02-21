export function canExport(role) {
    return role === 'FAMILY_OWNER';
}
export function canDelete(role) {
    return role === 'FAMILY_OWNER';
}
export function canWrite(role) {
    return role === 'FAMILY_OWNER' || role === 'FAMILY_COADMIN_LIMITED';
}
export function getPrincipal(req) {
    // DEV MODE: Extraction from cookies or mock session
    const role = req.cookies.get('amana_role')?.value || 'FAMILY_OWNER';
    const family_id = req.cookies.get('amana_family')?.value || '00000000-0000-0000-0000-000000000001';
    const principal_id = req.cookies.get('amana_user')?.value || '00000000-0000-0000-0000-000000000002';
    return {
        principal_id,
        family_id,
        role,
        display_name: role === 'FAMILY_OWNER' ? 'Family Owner' : 'User',
    };
}
export function requireFamilyAccess(principal, family_id) {
    return principal.family_id === family_id || principal.role === 'SYSTEM_ADMIN';
}
export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
