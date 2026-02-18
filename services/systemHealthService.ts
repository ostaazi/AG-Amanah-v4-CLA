/**
 * Amanah System Health Monitor Service
 * =====================================
 * Collects and monitors real-time device health metrics from child devices.
 * Provides heartbeat tracking, anomaly detection, and health scoring.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DeviceHealthSnapshot {
    childId: string;
    childName: string;
    batteryLevel: number;
    batteryCharging: boolean;
    storageUsedMB: number;
    storageTotalMB: number;
    memoryUsedMB: number;
    memoryTotalMB: number;
    networkType: 'wifi' | 'mobile' | 'none' | 'unknown';
    networkStrength: number; // 0-100
    cpuTemperature?: number;
    uptimeMinutes: number;
    lastHeartbeat: Date;
    permissionsGranted: PermissionStatus[];
    isAccessibilityEnabled: boolean;
    isDeviceAdminEnabled: boolean;
    isRemoteServiceRunning: boolean;
    appVersion: string;
    osVersion: string;
    deviceModel: string;
}

export interface PermissionStatus {
    name: string;
    granted: boolean;
    required: boolean;
}

export interface HealthAlert {
    id: string;
    childId: string;
    type: HealthAlertType;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    messageAr: string;
    detectedAt: Date;
    resolved: boolean;
}

export type HealthAlertType =
    | 'BATTERY_LOW'
    | 'BATTERY_CRITICAL'
    | 'STORAGE_FULL'
    | 'CONNECTIVITY_LOST'
    | 'HEARTBEAT_MISSED'
    | 'PERMISSION_REVOKED'
    | 'SERVICE_STOPPED'
    | 'TAMPER_DETECTED'
    | 'TEMPERATURE_HIGH';

export interface HealthScore {
    overall: number; // 0-100
    battery: number;
    storage: number;
    connectivity: number;
    permissions: number;
    services: number;
    trend: 'up' | 'down' | 'stable';
}

export interface HealthHistoryPoint {
    timestamp: Date;
    batteryLevel: number;
    networkType: string;
    storageUsedPercent: number;
    score: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const HEALTH_COLLECTION = 'deviceHealth';
const HEALTH_HISTORY_SUBCOLLECTION = 'history';
const HEALTH_ALERTS_COLLECTION = 'healthAlerts';

const HEARTBEAT_TIMEOUT_MINUTES = 15;
const BATTERY_LOW_THRESHOLD = 20;
const BATTERY_CRITICAL_THRESHOLD = 5;
const STORAGE_FULL_THRESHOLD = 90; // percent
const TEMPERATURE_HIGH_THRESHOLD = 45; // celsius

// ─── Health Score Calculation ───────────────────────────────────────────────────

const calculateBatteryScore = (level: number, charging: boolean): number => {
    if (charging) return Math.min(100, level + 20);
    if (level >= 50) return 100;
    if (level >= 20) return 60 + level;
    if (level >= 5) return level * 3;
    return 0;
};

const calculateStorageScore = (usedMB: number, totalMB: number): number => {
    if (totalMB <= 0) return 50; // unknown
    const usedPercent = (usedMB / totalMB) * 100;
    if (usedPercent < 60) return 100;
    if (usedPercent < 80) return 80;
    if (usedPercent < 90) return 50;
    return 10;
};

const calculateConnectivityScore = (
    type: string,
    strength: number
): number => {
    if (type === 'none') return 0;
    if (type === 'wifi') return Math.min(100, 70 + strength * 0.3);
    if (type === 'mobile') return Math.min(90, 50 + strength * 0.4);
    return 30;
};

const calculatePermissionsScore = (
    permissions: PermissionStatus[]
): number => {
    const required = permissions.filter((p) => p.required);
    if (required.length === 0) return 100;
    const granted = required.filter((p) => p.granted).length;
    return Math.round((granted / required.length) * 100);
};

const calculateServicesScore = (
    accessibility: boolean,
    admin: boolean,
    remote: boolean
): number => {
    let score = 0;
    if (accessibility) score += 40;
    if (admin) score += 30;
    if (remote) score += 30;
    return score;
};

export const computeHealthScore = (
    snapshot: DeviceHealthSnapshot
): HealthScore => {
    const battery = calculateBatteryScore(
        snapshot.batteryLevel,
        snapshot.batteryCharging
    );
    const storage = calculateStorageScore(
        snapshot.storageUsedMB,
        snapshot.storageTotalMB
    );
    const connectivity = calculateConnectivityScore(
        snapshot.networkType,
        snapshot.networkStrength
    );
    const permissions = calculatePermissionsScore(snapshot.permissionsGranted);
    const services = calculateServicesScore(
        snapshot.isAccessibilityEnabled,
        snapshot.isDeviceAdminEnabled,
        snapshot.isRemoteServiceRunning
    );

    const overall = Math.round(
        battery * 0.15 +
        storage * 0.1 +
        connectivity * 0.2 +
        permissions * 0.25 +
        services * 0.3
    );

    return { overall, battery, storage, connectivity, permissions, services, trend: 'stable' };
};

// ─── Health Alerts Detection ────────────────────────────────────────────────────

export const detectHealthAlerts = (
    snapshot: DeviceHealthSnapshot
): Omit<HealthAlert, 'id' | 'detectedAt' | 'resolved'>[] => {
    const alerts: Omit<HealthAlert, 'id' | 'detectedAt' | 'resolved'>[] = [];

    // Battery
    if (snapshot.batteryLevel <= BATTERY_CRITICAL_THRESHOLD && !snapshot.batteryCharging) {
        alerts.push({
            childId: snapshot.childId,
            type: 'BATTERY_CRITICAL',
            severity: 'CRITICAL',
            message: `Battery critically low (${snapshot.batteryLevel}%)`,
            messageAr: `البطارية منخفضة جداً (${snapshot.batteryLevel}%)`,
        });
    } else if (snapshot.batteryLevel <= BATTERY_LOW_THRESHOLD && !snapshot.batteryCharging) {
        alerts.push({
            childId: snapshot.childId,
            type: 'BATTERY_LOW',
            severity: 'MEDIUM',
            message: `Battery low (${snapshot.batteryLevel}%)`,
            messageAr: `البطارية منخفضة (${snapshot.batteryLevel}%)`,
        });
    }

    // Storage
    if (snapshot.storageTotalMB > 0) {
        const usedPercent = (snapshot.storageUsedMB / snapshot.storageTotalMB) * 100;
        if (usedPercent >= STORAGE_FULL_THRESHOLD) {
            alerts.push({
                childId: snapshot.childId,
                type: 'STORAGE_FULL',
                severity: 'HIGH',
                message: `Storage nearly full (${Math.round(usedPercent)}%)`,
                messageAr: `التخزين ممتلئ تقريباً (${Math.round(usedPercent)}%)`,
            });
        }
    }

    // Connectivity
    if (snapshot.networkType === 'none') {
        alerts.push({
            childId: snapshot.childId,
            type: 'CONNECTIVITY_LOST',
            severity: 'HIGH',
            message: 'Device has no network connection',
            messageAr: 'الجهاز بدون اتصال بالشبكة',
        });
    }

    // Heartbeat
    const minutesSinceHeartbeat =
        (Date.now() - snapshot.lastHeartbeat.getTime()) / (1000 * 60);
    if (minutesSinceHeartbeat > HEARTBEAT_TIMEOUT_MINUTES) {
        alerts.push({
            childId: snapshot.childId,
            type: 'HEARTBEAT_MISSED',
            severity: 'HIGH',
            message: `No heartbeat for ${Math.round(minutesSinceHeartbeat)} minutes`,
            messageAr: `لا يوجد نبض منذ ${Math.round(minutesSinceHeartbeat)} دقيقة`,
        });
    }

    // Permissions
    const revokedRequired = snapshot.permissionsGranted.filter(
        (p) => p.required && !p.granted
    );
    if (revokedRequired.length > 0) {
        alerts.push({
            childId: snapshot.childId,
            type: 'PERMISSION_REVOKED',
            severity: 'CRITICAL',
            message: `${revokedRequired.length} required permission(s) revoked`,
            messageAr: `${revokedRequired.length} صلاحية مطلوبة تم سحبها`,
        });
    }

    // Services
    if (!snapshot.isAccessibilityEnabled || !snapshot.isRemoteServiceRunning) {
        alerts.push({
            childId: snapshot.childId,
            type: 'SERVICE_STOPPED',
            severity: 'CRITICAL',
            message: 'Protection service is not running',
            messageAr: 'خدمة الحماية متوقفة',
        });
    }

    // Temperature
    if (snapshot.cpuTemperature && snapshot.cpuTemperature > TEMPERATURE_HIGH_THRESHOLD) {
        alerts.push({
            childId: snapshot.childId,
            type: 'TEMPERATURE_HIGH',
            severity: 'MEDIUM',
            message: `Device temperature high (${snapshot.cpuTemperature}°C)`,
            messageAr: `حرارة الجهاز مرتفعة (${snapshot.cpuTemperature}°م)`,
        });
    }

    return alerts;
};

// ─── Firestore Integration ──────────────────────────────────────────────────────

export const getDeviceHealth = async (
    childId: string
): Promise<DeviceHealthSnapshot | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, HEALTH_COLLECTION, childId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;

        const data = snap.data();
        return {
            childId,
            childName: data.childName || '',
            batteryLevel: data.batteryLevel ?? 0,
            batteryCharging: data.batteryCharging ?? false,
            storageUsedMB: data.storageUsedMB ?? 0,
            storageTotalMB: data.storageTotalMB ?? 0,
            memoryUsedMB: data.memoryUsedMB ?? 0,
            memoryTotalMB: data.memoryTotalMB ?? 0,
            networkType: data.networkType ?? 'unknown',
            networkStrength: data.networkStrength ?? 0,
            cpuTemperature: data.cpuTemperature,
            uptimeMinutes: data.uptimeMinutes ?? 0,
            lastHeartbeat: data.lastHeartbeat?.toDate?.() ?? new Date(0),
            permissionsGranted: data.permissionsGranted ?? [],
            isAccessibilityEnabled: data.isAccessibilityEnabled ?? false,
            isDeviceAdminEnabled: data.isDeviceAdminEnabled ?? false,
            isRemoteServiceRunning: data.isRemoteServiceRunning ?? false,
            appVersion: data.appVersion ?? 'unknown',
            osVersion: data.osVersion ?? 'unknown',
            deviceModel: data.deviceModel ?? 'unknown',
        };
    } catch (error) {
        console.error('[health] Failed to fetch device health:', error);
        return null;
    }
};

export const getAllDeviceHealth = async (
    parentId: string
): Promise<DeviceHealthSnapshot[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, HEALTH_COLLECTION),
            where('parentId', '==', parentId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
            const data = d.data();
            return {
                childId: d.id,
                childName: data.childName || '',
                batteryLevel: data.batteryLevel ?? 0,
                batteryCharging: data.batteryCharging ?? false,
                storageUsedMB: data.storageUsedMB ?? 0,
                storageTotalMB: data.storageTotalMB ?? 0,
                memoryUsedMB: data.memoryUsedMB ?? 0,
                memoryTotalMB: data.memoryTotalMB ?? 0,
                networkType: data.networkType ?? 'unknown',
                networkStrength: data.networkStrength ?? 0,
                cpuTemperature: data.cpuTemperature,
                uptimeMinutes: data.uptimeMinutes ?? 0,
                lastHeartbeat: data.lastHeartbeat?.toDate?.() ?? new Date(0),
                permissionsGranted: data.permissionsGranted ?? [],
                isAccessibilityEnabled: data.isAccessibilityEnabled ?? false,
                isDeviceAdminEnabled: data.isDeviceAdminEnabled ?? false,
                isRemoteServiceRunning: data.isRemoteServiceRunning ?? false,
                appVersion: data.appVersion ?? 'unknown',
                osVersion: data.osVersion ?? 'unknown',
                deviceModel: data.deviceModel ?? 'unknown',
            };
        });
    } catch (error) {
        console.error('[health] Failed to fetch all device health:', error);
        return [];
    }
};

export const getHealthHistory = async (
    childId: string,
    hoursBack = 24
): Promise<HealthHistoryPoint[]> => {
    if (!db) return [];
    try {
        const cutoff = Timestamp.fromDate(
            new Date(Date.now() - hoursBack * 60 * 60 * 1000)
        );
        const q = query(
            collection(db, HEALTH_COLLECTION, childId, HEALTH_HISTORY_SUBCOLLECTION),
            where('timestamp', '>=', cutoff),
            orderBy('timestamp', 'asc'),
            limit(288) // max 1 point per 5 min for 24h
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
            const data = d.data();
            return {
                timestamp: data.timestamp?.toDate?.() ?? new Date(),
                batteryLevel: data.batteryLevel ?? 0,
                networkType: data.networkType ?? 'unknown',
                storageUsedPercent:
                    data.storageTotalMB > 0
                        ? Math.round((data.storageUsedMB / data.storageTotalMB) * 100)
                        : 0,
                score: data.score ?? 0,
            };
        });
    } catch (error) {
        console.error('[health] Failed to fetch health history:', error);
        return [];
    }
};

export const subscribeToDeviceHealth = (
    childId: string,
    callback: (snapshot: DeviceHealthSnapshot | null) => void
): (() => void) => {
    if (!db) return () => { };
    const docRef = doc(db, HEALTH_COLLECTION, childId);
    return onSnapshot(
        docRef,
        (snap) => {
            if (!snap.exists()) {
                callback(null);
                return;
            }
            const data = snap.data();
            callback({
                childId,
                childName: data.childName || '',
                batteryLevel: data.batteryLevel ?? 0,
                batteryCharging: data.batteryCharging ?? false,
                storageUsedMB: data.storageUsedMB ?? 0,
                storageTotalMB: data.storageTotalMB ?? 0,
                memoryUsedMB: data.memoryUsedMB ?? 0,
                memoryTotalMB: data.memoryTotalMB ?? 0,
                networkType: data.networkType ?? 'unknown',
                networkStrength: data.networkStrength ?? 0,
                cpuTemperature: data.cpuTemperature,
                uptimeMinutes: data.uptimeMinutes ?? 0,
                lastHeartbeat: data.lastHeartbeat?.toDate?.() ?? new Date(0),
                permissionsGranted: data.permissionsGranted ?? [],
                isAccessibilityEnabled: data.isAccessibilityEnabled ?? false,
                isDeviceAdminEnabled: data.isDeviceAdminEnabled ?? false,
                isRemoteServiceRunning: data.isRemoteServiceRunning ?? false,
                appVersion: data.appVersion ?? 'unknown',
                osVersion: data.osVersion ?? 'unknown',
                deviceModel: data.deviceModel ?? 'unknown',
            });
        },
        (error) => {
            console.error('[health] Realtime listener error:', error);
            callback(null);
        }
    );
};
