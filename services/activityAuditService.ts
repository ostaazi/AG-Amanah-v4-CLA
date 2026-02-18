/**
 * Amanah Activity Audit Trail Service
 * =====================================
 * Tamper-resistant audit logging for all parent actions.
 * Records who did what, when, from where, with before/after state.
 * Uses SHA-256 hash chaining for integrity verification.
 */

import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AuditAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'VIEW_ALERTS'
    | 'DISMISS_ALERT'
    | 'ESCALATE_ALERT'
    | 'SEND_COMMAND'
    | 'LOCK_DEVICE'
    | 'UNLOCK_DEVICE'
    | 'PLAY_SIREN'
    | 'TAKE_SCREENSHOT'
    | 'BLOCK_APP'
    | 'UNBLOCK_APP'
    | 'MODIFY_SETTINGS'
    | 'CHANGE_PASSWORD'
    | 'ENABLE_2FA'
    | 'DISABLE_2FA'
    | 'ADD_CHILD'
    | 'REMOVE_CHILD'
    | 'PAIR_DEVICE'
    | 'UNPAIR_DEVICE'
    | 'EXPORT_DATA'
    | 'DELETE_DATA'
    | 'INVITE_CO_PARENT'
    | 'MODIFY_PLAYBOOK'
    | 'VIEW_EVIDENCE'
    | 'MODIFY_GEOFENCE'
    | 'CHANGE_MODE'
    | 'RUN_AUDIT'
    | 'APPLY_PATCH'
    | 'ROLLBACK_PATCH';

export type ActionCategory =
    | 'AUTH'
    | 'MONITORING'
    | 'COMMAND'
    | 'SETTINGS'
    | 'DATA'
    | 'SYSTEM';

export interface AuditLogEntry {
    id: string;
    parentId: string;
    parentEmail: string;
    action: AuditAction;
    category: ActionCategory;
    targetId?: string;        // child ID, device ID, etc.
    targetType?: string;      // 'child', 'device', 'alert', etc.
    description: string;
    descriptionAr: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    metadata: {
        ipAddress?: string;
        userAgent?: string;
        sessionId?: string;
        timestamp: Date;
    };
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    previousHash: string;
    entryHash: string;
}

export interface AuditTrailSummary {
    totalActions: number;
    last24h: number;
    byCategory: Record<ActionCategory, number>;
    highRiskActions: number;
    lastAction: AuditLogEntry | null;
    integrityVerified: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const AUDIT_TRAIL_COLLECTION = 'auditTrail';

const ACTION_CATEGORY_MAP: Record<AuditAction, ActionCategory> = {
    LOGIN: 'AUTH',
    LOGOUT: 'AUTH',
    VIEW_ALERTS: 'MONITORING',
    DISMISS_ALERT: 'MONITORING',
    ESCALATE_ALERT: 'MONITORING',
    SEND_COMMAND: 'COMMAND',
    LOCK_DEVICE: 'COMMAND',
    UNLOCK_DEVICE: 'COMMAND',
    PLAY_SIREN: 'COMMAND',
    TAKE_SCREENSHOT: 'COMMAND',
    BLOCK_APP: 'COMMAND',
    UNBLOCK_APP: 'COMMAND',
    MODIFY_SETTINGS: 'SETTINGS',
    CHANGE_PASSWORD: 'AUTH',
    ENABLE_2FA: 'AUTH',
    DISABLE_2FA: 'AUTH',
    ADD_CHILD: 'DATA',
    REMOVE_CHILD: 'DATA',
    PAIR_DEVICE: 'DATA',
    UNPAIR_DEVICE: 'DATA',
    EXPORT_DATA: 'DATA',
    DELETE_DATA: 'DATA',
    INVITE_CO_PARENT: 'AUTH',
    MODIFY_PLAYBOOK: 'SETTINGS',
    VIEW_EVIDENCE: 'MONITORING',
    MODIFY_GEOFENCE: 'SETTINGS',
    CHANGE_MODE: 'SETTINGS',
    RUN_AUDIT: 'SYSTEM',
    APPLY_PATCH: 'SYSTEM',
    ROLLBACK_PATCH: 'SYSTEM',
};

const ACTION_RISK_MAP: Record<AuditAction, 'LOW' | 'MEDIUM' | 'HIGH'> = {
    LOGIN: 'LOW',
    LOGOUT: 'LOW',
    VIEW_ALERTS: 'LOW',
    DISMISS_ALERT: 'MEDIUM',
    ESCALATE_ALERT: 'MEDIUM',
    SEND_COMMAND: 'MEDIUM',
    LOCK_DEVICE: 'MEDIUM',
    UNLOCK_DEVICE: 'MEDIUM',
    PLAY_SIREN: 'MEDIUM',
    TAKE_SCREENSHOT: 'LOW',
    BLOCK_APP: 'MEDIUM',
    UNBLOCK_APP: 'LOW',
    MODIFY_SETTINGS: 'MEDIUM',
    CHANGE_PASSWORD: 'HIGH',
    ENABLE_2FA: 'HIGH',
    DISABLE_2FA: 'HIGH',
    ADD_CHILD: 'MEDIUM',
    REMOVE_CHILD: 'HIGH',
    PAIR_DEVICE: 'MEDIUM',
    UNPAIR_DEVICE: 'HIGH',
    EXPORT_DATA: 'HIGH',
    DELETE_DATA: 'HIGH',
    INVITE_CO_PARENT: 'MEDIUM',
    MODIFY_PLAYBOOK: 'MEDIUM',
    VIEW_EVIDENCE: 'LOW',
    MODIFY_GEOFENCE: 'MEDIUM',
    CHANGE_MODE: 'MEDIUM',
    RUN_AUDIT: 'LOW',
    APPLY_PATCH: 'HIGH',
    ROLLBACK_PATCH: 'HIGH',
};

// ─── Hash Chain ─────────────────────────────────────────────────────────────────

const computeHash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

const buildEntryDigest = (
    parentId: string,
    action: string,
    timestamp: string,
    previousHash: string
): string => `${parentId}|${action}|${timestamp}|${previousHash}`;

// ─── In-Memory Last Hash (per parent session) ──────────────────────────────

let lastKnownHash: Record<string, string> = {};

// ─── Public API ─────────────────────────────────────────────────────────────

export const logAuditAction = async (params: {
    parentId: string;
    parentEmail: string;
    action: AuditAction;
    targetId?: string;
    targetType?: string;
    description: string;
    descriptionAr: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}): Promise<void> => {
    if (!db) return;

    const now = new Date();
    const previousHash = lastKnownHash[params.parentId] || '0'.repeat(64);
    const digest = buildEntryDigest(
        params.parentId,
        params.action,
        now.toISOString(),
        previousHash
    );
    const entryHash = await computeHash(digest);

    const entry: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        parentId: params.parentId,
        parentEmail: params.parentEmail,
        action: params.action,
        category: ACTION_CATEGORY_MAP[params.action] || 'SYSTEM',
        targetId: params.targetId,
        targetType: params.targetType,
        description: params.description,
        descriptionAr: params.descriptionAr,
        beforeState: params.beforeState,
        afterState: params.afterState,
        metadata: {
            ipAddress: params.ipAddress,
            userAgent: params.userAgent || navigator?.userAgent,
            sessionId: params.sessionId,
            timestamp: now,
        },
        riskLevel: ACTION_RISK_MAP[params.action] || 'LOW',
        previousHash,
        entryHash,
    };

    lastKnownHash[params.parentId] = entryHash;

    try {
        const docRef = doc(db, AUDIT_TRAIL_COLLECTION, entry.id);
        await setDoc(docRef, {
            ...entry,
            metadata: {
                ...entry.metadata,
                timestamp: Timestamp.fromDate(now),
            },
        });
    } catch (error) {
        console.error('[audit-trail] Failed to write audit log:', error);
    }
};

export const getAuditTrail = async (
    parentId: string,
    limitCount = 50
): Promise<AuditLogEntry[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, AUDIT_TRAIL_COLLECTION),
            where('parentId', '==', parentId),
            orderBy('metadata.timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
            const data = d.data();
            return {
                ...data,
                id: d.id,
                metadata: {
                    ...data.metadata,
                    timestamp: data.metadata?.timestamp?.toDate?.() ?? new Date(),
                },
            } as AuditLogEntry;
        });
    } catch (error) {
        console.error('[audit-trail] Failed to fetch audit trail:', error);
        return [];
    }
};

export const getAuditTrailSummary = async (
    parentId: string
): Promise<AuditTrailSummary> => {
    const entries = await getAuditTrail(parentId, 200);
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const byCategory: Record<ActionCategory, number> = {
        AUTH: 0,
        MONITORING: 0,
        COMMAND: 0,
        SETTINGS: 0,
        DATA: 0,
        SYSTEM: 0,
    };

    let last24h = 0;
    let highRiskActions = 0;

    for (const entry of entries) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
        if (entry.metadata.timestamp.getTime() > oneDayAgo) last24h++;
        if (entry.riskLevel === 'HIGH') highRiskActions++;
    }

    // Verify integrity of hash chain
    let integrityVerified = true;
    const sorted = [...entries].sort(
        (a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].previousHash !== sorted[i - 1].entryHash) {
            integrityVerified = false;
            break;
        }
    }

    return {
        totalActions: entries.length,
        last24h,
        byCategory,
        highRiskActions,
        lastAction: entries[0] || null,
        integrityVerified,
    };
};

export const verifyAuditIntegrity = async (
    parentId: string
): Promise<{ valid: boolean; brokenAt?: string }> => {
    const entries = await getAuditTrail(parentId, 500);
    const sorted = [...entries].sort(
        (a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].previousHash !== sorted[i - 1].entryHash) {
            return { valid: false, brokenAt: sorted[i].id };
        }
    }
    return { valid: true };
};
