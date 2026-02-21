import { Capacitor, registerPlugin } from '@capacitor/core';

export type ParentSecuritySettingTarget =
  | 'system_update'
  | 'developer_options'
  | 'security'
  | 'device_lock'
  | 'unknown_sources'
  | 'accessibility';

export interface ParentAndroidSecurityFinding {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  remediationMode: 'AUTO' | 'GUIDED';
  guidanceEn: string;
  guidanceAr: string;
  autoAction?: {
    type: 'OPEN_SETTING';
    target: ParentSecuritySettingTarget;
  };
}

export interface ParentAndroidSecurityScanResult {
  scannedAtMs: number;
  apiLevel: number;
  osVersion: string;
  securityPatchLevel: string;
  deviceModel: string;
  isDeviceOwner: boolean;
  riskScore: number;
  findings: ParentAndroidSecurityFinding[];
}

interface ParentSecurityPlugin {
  scanDeviceSecurity(options?: { deep?: boolean }): Promise<ParentAndroidSecurityScanResult>;
  openSecuritySetting(options: { target: ParentSecuritySettingTarget }): Promise<{ ok: boolean; target: string }>;
}

const ParentSecurityPlugin = registerPlugin<ParentSecurityPlugin>('ParentSecurityPlugin');

const isNativeAndroid = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

export const isParentAndroidSecurityBridgeAvailable = (): boolean => isNativeAndroid();

export const scanParentAndroidSecuritySurface = async (): Promise<{
  available: boolean;
  result: ParentAndroidSecurityScanResult | null;
}> => {
  if (!isNativeAndroid()) {
    return { available: false, result: null };
  }
  try {
    const result = await ParentSecurityPlugin.scanDeviceSecurity({ deep: true });
    return { available: true, result };
  } catch (error) {
    console.warn('[parent-android-security] scan bridge failed:', error);
    return { available: false, result: null };
  }
};

export const openParentSecuritySetting = async (
  target: ParentSecuritySettingTarget
): Promise<boolean> => {
  if (!isNativeAndroid()) return false;
  try {
    const response = await ParentSecurityPlugin.openSecuritySetting({ target });
    return response?.ok === true;
  } catch (error) {
    console.warn('[parent-android-security] open setting failed:', error);
    return false;
  }
};
