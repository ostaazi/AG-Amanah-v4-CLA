/**
 * مصفوفة الصلاحيات السيادية (Sovereign RBAC Matrix)
 * تم دمج قيود STRIDE لضمان فصل المهام (SoD) وحماية الأدلة الجنائية.
 * ملاحظة: FAMILY_COADMIN (الأم عادةً) لديها "Hard Deny" على تصدير الأدلة والخصائص الحية.
 */
const ROLE_MATRIX = {
    'FAMILY_OWNER': {
        allow: ['*'],
        deny: []
    },
    'FAMILY_COADMIN': {
        allow: [
            'family.read', 'family.update', 'member.invite', 'member.remove',
            'child.create', 'child.update', 'child.view_reports',
            'device.enroll', 'device.lock', 'device.net.block', 'device.app.block',
            'device.camera.block', 'device.mic.block', 'device.location.view_live',
            'alert.read', 'alert.ack', 'policy.read', 'mode.read', 'evidence.read', 'custody.read'
        ],
        // وثيقة v1: Mother لا يمكنها التصدير أو الحذف أو تفعيل الميزات الحية دون إذن صريح
        deny: [
            'evidence.delete', 'evidence.export', 'evidence.legal_hold',
            'playbook.write', 'member.update_role', 'family.manage_security',
            'realtime.screenshot.request', 'realtime.camera.view_live', 'realtime.audio.listen'
        ]
    },
    'FAMILY_AUDITOR': {
        allow: ['alert.read', 'evidence.read', 'custody.read', 'report.read', 'child.view_reports'],
        deny: ['device.*', 'realtime.*', 'evidence.delete', 'evidence.export', 'playbook.*', 'mode.write', 'policy.write']
    },
    'EMERGENCY_GUARDIAN': {
        allow: ['alert.read', 'alert.ack', 'device.lock', 'device.location.view_live'],
        deny: ['evidence.*', 'playbook.*', 'policy.*', 'realtime.*', 'device.unlock']
    },
    'SUPPORT_TECH': {
        allow: ['family.read'],
        deny: ['evidence.*', 'realtime.*', 'alert.read', 'child.view_reports', 'device.location.*']
    },
    'SOC_ANALYST': {
        allow: ['family.read', 'report.read'], // يرى مقاييس المنصة فقط
        deny: ['evidence.*', 'alert.read', 'realtime.*', 'child.*', 'device.*']
    },
    'SRE': {
        allow: ['*'],
        deny: ['evidence.read', 'alert.read'] // SRE لا يحتاج لرؤية المحتوى أبداً
    },
    'DEVELOPER': { allow: ['*'], deny: [] },
    'ADMIN': { allow: ['*'], deny: [] },
    'SUPERVISOR': { allow: ['family.read', 'alert.read'], deny: [] },
    'RELEASE_MANAGER': { allow: ['*'], deny: [] },
    'PLATFORM_ADMIN': { allow: ['*'], deny: [] },
    'CHILD': { allow: ['alert.read'], deny: ['*'] },
    'DEVICE_IDENTITY': { allow: ['evidence.read'], deny: ['*'] }
};
export const hasPermission = (role, permission) => {
    const config = ROLE_MATRIX[role] || { allow: [], deny: ['*'] };
    const denies = config.deny;
    if (denies.includes('*') || denies.includes(permission))
        return false;
    const allows = config.allow;
    if (allows.includes('*'))
        return true;
    const [resource] = permission.split('.');
    if (allows.includes(`${resource}.*`))
        return true;
    return allows.includes(permission);
};
export const canPerform = (role, permission) => hasPermission(role, permission);
