import React, { useMemo, useRef, useState } from 'react';
import { Child, AppUsage } from '../types';
import { ICONS } from '../constants';
import { analyzeLocationSafety } from '../services/geminiService';
import type { LocationSafetyIntel } from '../services/geminiService';

interface DevicesViewProps {
  children: Child[];
  onToggleAppBlock: (childId: string, appId: string) => void;
  onUpdateDevice: (childId: string, updates: Partial<Child>) => void;
  onToggleDeviceLock?: (childId: string, shouldLock: boolean) => Promise<void> | void;
  lang: 'ar' | 'en';
}

const DEVICE_ICONS = [
  { label: 'Smartphone', icon: 'PH' },
  { label: 'Tablet', icon: 'TB' },
  { label: 'Laptop', icon: 'LP' },
  { label: 'Gaming', icon: 'GM' },
];

const UI_TEXT = {
  en: {
    noChildren: 'No child devices found.',
    resolvingAddress: 'Resolving address...',
    enableLocationPermission: 'Please enable location permission.',
    previous: 'Previous',
    next: 'Next',
    selectDevice: 'Select Device',
    battery: 'Battery',
    network: 'Network',
    mapSubtitle: 'Live tracking with geofencing support.',
    refreshLocation: 'Refresh location',
    waitingGpsPrefix: 'Waiting for GPS signal for',
    hardwareControls: 'Hardware Controls',
    readinessTitle: 'Child readiness',
    waitingReadiness: 'Waiting for the child device to report its control readiness.',
    controlReady: 'App control is ready on the child device.',
    needsAccessibility: 'Enable Amanah Accessibility on the child device for app, camera, and microphone enforcement.',
    needsCameraPermission: 'Grant child camera permission so live camera streaming can start.',
    needsMicPermission: 'Grant child microphone permission so live microphone streaming can start.',
    blockMic: 'Block microphone',
    blockCamera: 'Block camera',
    preventInstall: 'Prevent app install',
    preventDeviceLock: 'Prevent device lock',
    customizeDevice: 'Customize device',
    lockNow: 'Lock device now',
    unlockNow: 'Unlock device',
    ambientTitle: 'Ambient Safety AI',
    ambientWaiting: 'Waiting for location data to generate safety guidance.',
    appWallTitle: 'App Protection Wall',
    appWallCountPrefix: 'Total',
    appWallCountSuffix: 'monitored apps',
    changeAvatar: 'Change',
    childName: 'Child Name',
    deviceNickname: 'Device Nickname',
    nicknamePlaceholder: 'Example: iPhone 15 Pro',
    deviceType: 'Device Type',
    saveDeviceSettings: 'Save Device Settings',
    blockMark: 'X',
    tempGeminiBannerTitle: 'Temporary Diagnostic',
    tempGeminiBannerBody:
      'Cloud location analysis fallback is active. GPS map still works normally.',
    tempGeminiBannerAction:
      'Future plan: remove this banner after stable Gemini key rollout in all environments.',
  },
  ar: {
    noChildren: 'No child devices found.',
    resolvingAddress: 'Resolving address...',
    enableLocationPermission: 'Please enable location permission.',
    previous: 'Previous',
    next: 'Next',
    selectDevice: 'Select Device',
    battery: 'Battery',
    network: 'Network',
    mapSubtitle: 'Live tracking with geofencing support.',
    refreshLocation: 'Refresh location',
    waitingGpsPrefix: 'Waiting for GPS signal for',
    hardwareControls: 'Hardware Controls',
    readinessTitle: 'جاهزية جهاز الطفل',
    waitingReadiness: 'بانتظار أن يرسل جهاز الطفل حالة الجاهزية الحالية.',
    controlReady: 'الجهاز جاهز الآن لتطبيق أوامر التحكم.',
    needsAccessibility: 'فعّل خدمة Amanah Accessibility على جهاز الطفل حتى يعمل حجب التطبيقات والكاميرا والمايك.',
    needsCameraPermission: 'امنح صلاحية الكاميرا على جهاز الطفل حتى يبدأ البث بالكاميرا.',
    needsMicPermission: 'امنح صلاحية الميكروفون على جهاز الطفل حتى يبدأ بث الميكروفون.',
    blockMic: 'Block microphone',
    blockCamera: 'Block camera',
    preventInstall: 'Prevent app install',
    preventDeviceLock: 'Prevent device lock',
    customizeDevice: 'Customize device',
    lockNow: 'Lock device now',
    unlockNow: 'Unlock device',
    ambientTitle: 'Ambient Safety AI',
    ambientWaiting: 'Waiting for location data to generate safety guidance.',
    appWallTitle: 'App Protection Wall',
    appWallCountPrefix: 'Total',
    appWallCountSuffix: 'monitored apps',
    changeAvatar: 'Change',
    childName: 'Child Name',
    deviceNickname: 'Device Nickname',
    nicknamePlaceholder: 'Example: iPhone 15 Pro',
    deviceType: 'Device Type',
    saveDeviceSettings: 'Save Device Settings',
    blockMark: 'X',
    tempGeminiBannerTitle: 'Temporary Diagnostic',
    tempGeminiBannerBody:
      'Cloud location analysis fallback is active. GPS map still works normally.',
    tempGeminiBannerAction:
      'Future plan: remove this banner after stable Gemini key rollout in all environments.',
  },
};

const buildOpenStreetMapEmbedUrl = (lat: number, lng: number, delta = 0.006): string => {
  const west = lng - delta;
  const east = lng + delta;
  const south = lat - delta;
  const north = lat + delta;
  const bbox = `${west.toFixed(6)}%2C${south.toFixed(6)}%2C${east.toFixed(6)}%2C${north.toFixed(6)}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
};

const normalizeAppToken = (value: unknown): string => String(value || '').trim().toLowerCase();

const resolveAppIdentity = (app: AppUsage, index: number): string => {
  const idToken = normalizeAppToken(app.id);
  if (idToken) return `id:${idToken}`;
  const nameToken = normalizeAppToken(app.appName);
  if (nameToken) return `name:${nameToken}`;
  return `row:${index}`;
};

const dedupeAppUsage = (apps: AppUsage[]): AppUsage[] => {
  const merged = new Map<string, AppUsage>();

  apps.forEach((app, index) => {
    const identity = resolveAppIdentity(app, index);
    const existing = merged.get(identity);

    if (!existing) {
      merged.set(identity, {
        ...app,
        id: String(app.id || identity),
      });
      return;
    }

    existing.isBlocked = existing.isBlocked || app.isBlocked;
    existing.minutesUsed = Math.max(Number(existing.minutesUsed || 0), Number(app.minutesUsed || 0));
    if (!String(existing.icon || '').trim()) existing.icon = app.icon;
    if (!String(existing.appName || '').trim()) existing.appName = app.appName;
    if (!String(existing.id || '').trim() && String(app.id || '').trim()) existing.id = app.id;
  });

  return Array.from(merged.values());
};

const DevicesView: React.FC<DevicesViewProps> = ({
  children,
  onToggleAppBlock,
  onUpdateDevice,
  onToggleDeviceLock,
  lang,
}) => {
  const ui = UI_TEXT[lang] || UI_TEXT.en;
  const safeChildren = Array.isArray(children) ? children : [];
  const [selectedChildId, setSelectedChildId] = useState(safeChildren[0]?.id || '');
  const child = safeChildren.find((c) => c.id === selectedChildId) || safeChildren[0];
  const childApps = useMemo(
    () => dedupeAppUsage(Array.isArray(child?.appUsage) ? child.appUsage : []),
    [child?.appUsage]
  );
  const batteryLevel = Number.isFinite(child?.batteryLevel as number)
    ? (child?.batteryLevel as number)
    : 0;
  const signalStrength = Number.isFinite(child?.signalStrength as number)
    ? (child?.signalStrength as number)
    : 0;
  const readiness = child.controlReadiness;
  const readinessIssues = [
    readiness && !readiness.accessibilityEnabled ? ui.needsAccessibility : null,
    readiness && !readiness.cameraPermissionGranted ? ui.needsCameraPermission : null,
    readiness && !readiness.microphonePermissionGranted ? ui.needsMicPermission : null,
  ].filter(Boolean) as string[];
  const readinessMessage = !readiness
    ? ui.waitingReadiness
    : readinessIssues.length === 0
      ? ui.controlReady
      : readinessIssues[0];
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationIntel, setLocationIntel] = useState<LocationSafetyIntel | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', nickname: '', avatar: '' });
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const [isLockActionLoading, setIsLockActionLoading] = useState(false);

  if (!child) {
    return <div className="p-10 text-center font-black">{ui.noChildren}</div>;
  }

  const trackLocation = () => {
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onUpdateDevice(child.id, {
          location: {
            lat: latitude,
            lng: longitude,
            address: ui.resolvingAddress,
            lastUpdated: new Date(),
          },
        });
        const intel = await analyzeLocationSafety(latitude, longitude);
        setLocationIntel(intel);
        setLoadingLocation(false);
      },
      () => {
        alert(ui.enableLocationPermission);
        setLoadingLocation(false);
      }
    );
  };

  const handleStartEdit = () => {
    setEditData({
      name: child.name,
      nickname: child.deviceNickname || '',
      avatar: child.avatar,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onUpdateDevice(child.id, {
      name: editData.name,
      deviceNickname: editData.nickname,
      avatar: editData.avatar,
    });
    setIsEditing(false);
  };

  const scrollDevices = (direction: 'next' | 'prev') => {
    if (!selectorRef.current) return;
    const amount = Math.max(220, Math.floor(selectorRef.current.clientWidth * 0.7));
    const sign = direction === 'next' ? 1 : -1;
    selectorRef.current.scrollBy({ left: sign * amount, behavior: 'smooth' });
  };

  const handleDeviceLockAction = async (shouldLock: boolean) => {
    if (!onToggleDeviceLock) return;
    setIsLockActionLoading(true);
    try {
      await onToggleDeviceLock(child.id, shouldLock);
    } finally {
      setIsLockActionLoading(false);
    }
  };

  return (
    <div
      className="space-y-10 pb-40 animate-in fade-in duration-700"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="w-full flex-1 bg-white/70 backdrop-blur-xl border border-slate-100 rounded-[2rem] p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2 px-1">
            <button
              type="button"
              aria-label={ui.previous}
              onClick={() => scrollDevices(lang === 'ar' ? 'next' : 'prev')}
              className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
            >
              {lang === 'ar' ? '>' : '<'}
            </button>
            <div className="flex-1 text-center text-[10px] font-black tracking-wide text-slate-400 uppercase">
              {ui.selectDevice}
            </div>
            <button
              type="button"
              aria-label={ui.next}
              onClick={() => scrollDevices(lang === 'ar' ? 'prev' : 'next')}
              className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
            >
              {lang === 'ar' ? '<' : '>'}
            </button>
          </div>
          <div
            ref={selectorRef}
            className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar items-stretch snap-x snap-mandatory"
          >
            {safeChildren.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedChildId(c.id);
                  setLocationIntel(null);
                }}
                className={`min-w-[220px] flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all whitespace-nowrap text-start snap-start ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:shadow-sm'}`}
              >
                <img
                  src={c.avatar}
                  className="w-11 h-11 rounded-xl object-cover shadow-sm border border-white/50 shrink-0"
                />
                <div className="text-right">
                  <span className="font-black text-sm block leading-none">{c.name}</span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest mt-1 block ${selectedChildId === c.id ? 'text-indigo-200' : 'text-slate-400'}`}
                  >
                    {c.deviceNickname || 'Android Mobile'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] flex items-center gap-8 shadow-2xl border-b-4 border-indigo-600">
          <div className="flex flex-col items-center gap-1">
            <p className="text-[8px] font-black text-indigo-400 uppercase">{ui.battery}</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 rounded-sm border border-white/40 p-0.5 relative">
                <div
                  className={`h-full ${batteryLevel > 20 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${batteryLevel}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-black">{batteryLevel}%</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[8px] font-black text-indigo-400 uppercase">{ui.network}</p>
            <div className="flex items-end gap-0.5 h-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full ${signalStrength >= i ? 'bg-indigo-500' : 'bg-white/10'}`}
                  style={{ height: `${i * 25}%` }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 bg-white/70 backdrop-blur-2xl rounded-[3.5rem] border border-white shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/50">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Live GPS & Geofencing</h3>
              <p className="text-xs font-bold text-slate-400">{ui.mapSubtitle}</p>
              {locationIntel?.status && locationIntel.status !== 'cloud' && (
                <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                  <p className="text-[10px] font-black text-amber-800">{ui.tempGeminiBannerTitle}</p>
                  <p className="text-[10px] font-bold text-amber-700">{ui.tempGeminiBannerBody}</p>
                  <p className="text-[10px] font-bold text-amber-700">
                    {locationIntel.troubleshooting || 'Check Gemini key configuration.'}
                  </p>
                  <p className="text-[10px] font-bold text-amber-700">{ui.tempGeminiBannerAction}</p>
                </div>
              )}
            </div>
            <button
              onClick={trackLocation}
              disabled={loadingLocation}
              className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-3 transition-all active:scale-95 ${loadingLocation ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white shadow-lg'}`}
            >
              {loadingLocation ? '...' : <ICONS.Location />}
              {ui.refreshLocation}
            </button>
          </div>
          <div className="flex-1 relative bg-slate-100 flex items-center justify-center overflow-hidden">
            {child.location ? (
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={buildOpenStreetMapEmbedUrl(child.location.lat, child.location.lng)}
                className="absolute inset-0 grayscale-[0.2] contrast-[1.1]"
              ></iframe>
            ) : (
              <div className="flex flex-col items-center gap-6 opacity-30">
                <div className="text-4xl font-black">MAP</div>
                <p className="font-black text-xl text-center">
                  {ui.waitingGpsPrefix} {child.name}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-xl space-y-6">
            <h3 className="text-xl font-black text-slate-800 border-b pb-4 flex items-center gap-3">
              {ui.hardwareControls}
              <span className="text-[10px] text-red-500 font-black animate-pulse">LIVE</span>
            </h3>
            <div className={`rounded-2xl border px-4 py-3 ${!readiness ? 'border-slate-200 bg-slate-50 text-slate-700' : readinessIssues.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <p className="text-[11px] font-black uppercase tracking-wide">{ui.readinessTitle}</p>
              <p className="mt-1 text-[11px] font-bold">{readinessMessage}</p>
            </div>
            <div className="space-y-4">
              <HardwareToggle
                label={ui.blockMic}
                active={child.micBlocked}
                icon="MIC"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                onToggle={() => onUpdateDevice(child.id, { micBlocked: !child.micBlocked })}
              />
              <HardwareToggle
                label={ui.blockCamera}
                active={child.cameraBlocked}
                icon="CAM"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                onToggle={() => onUpdateDevice(child.id, { cameraBlocked: !child.cameraBlocked })}
              />
              <HardwareToggle
                label={ui.preventInstall}
                active={child.preventAppInstall}
                icon="APP"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                onToggle={() => onUpdateDevice(child.id, { preventAppInstall: !child.preventAppInstall })}
              />
              <HardwareToggle
                label={ui.preventDeviceLock}
                active={child.preventDeviceLock || false}
                icon="LOCK"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                onToggle={() => onUpdateDevice(child.id, { preventDeviceLock: !child.preventDeviceLock })}
              />
            </div>

            <button
              onClick={handleStartEdit}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
            >
              <ICONS.Settings className="w-5 h-5 text-indigo-400" />
              {ui.customizeDevice}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDeviceLockAction(true)}
                disabled={isLockActionLoading}
                className="py-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
              >
                {isLockActionLoading ? '...' : ui.lockNow}
              </button>
              <button
                type="button"
                onClick={() => handleDeviceLockAction(false)}
                disabled={isLockActionLoading}
                className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg disabled:opacity-50"
              >
                {isLockActionLoading ? '...' : ui.unlockNow}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[3rem] p-8 shadow-2xl text-white relative overflow-hidden h-full flex flex-col justify-between group">
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg">
                  <ICONS.Shield />
                </div>
                <h4 className="text-xl font-black tracking-tight">{ui.ambientTitle}</h4>
              </div>
              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl italic text-xs font-bold leading-relaxed text-indigo-100">
                {locationIntel?.text || ui.ambientWaiting}
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl group-hover:scale-150 transition-transform"></div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[4rem] border border-white shadow-2xl">
        <div className="flex justify-between items-center mb-10 px-4">
          <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{ui.appWallTitle}</h3>
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-4 py-1 rounded-full uppercase">
            {ui.appWallCountPrefix} {childApps.length} {ui.appWallCountSuffix}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
          {childApps.map((app, appIdx) => {
            const appId = String(app?.id || '').trim();
            const appKey = appId
              ? `${appId}-${appIdx}`
              : `app-${appIdx}-${String(app?.appName || 'unknown')}`;
            const canToggle = appId.length > 0;

            return (
              <button
                key={appKey}
                onClick={() => {
                  if (!canToggle) return;
                  onToggleAppBlock(child.id, appId);
                }}
                disabled={!canToggle}
                className={`relative w-full aspect-square rounded-[2.5rem] flex flex-col items-center justify-center transition-all border-4 ${app.isBlocked ? 'bg-red-50 border-red-500 shadow-lg' : 'bg-white border-slate-50 hover:scale-105 shadow-sm'} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span className="text-4xl mb-1">{app.icon}</span>
                <p className="text-[9px] font-black truncate w-full px-2 text-center text-slate-700">
                  {app.appName}
                </p>
                {app.isBlocked && (
                  <div className="absolute inset-0 bg-red-600/5 rounded-[2.5rem] flex items-center justify-center text-2xl">
                    {ui.blockMark}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden border-4 border-white">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <button
                onClick={() => setIsEditing(false)}
                className="text-white/60 hover:text-white"
              >
                <ICONS.Close />
              </button>
              <h3 className="text-2xl font-black">{ui.customizeDevice}</h3>
            </div>
            <div className="p-10 space-y-8">
              <div className="flex justify-center">
                <div className="relative group cursor-pointer">
                  <img
                    src={editData.avatar}
                    className="w-24 h-24 rounded-[2rem] object-cover border-4 border-indigo-50 shadow-xl"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-[10px] font-black">{ui.changeAvatar}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-4">
                    {ui.childName}
                  </label>
                  <input
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-right text-lg focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-4">
                    {ui.deviceNickname}
                  </label>
                  <input
                    value={editData.nickname}
                    onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                    placeholder={ui.nicknamePlaceholder}
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-right text-lg focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase px-4">{ui.deviceType}</p>
                <div className="grid grid-cols-4 gap-2">
                  {DEVICE_ICONS.map((di) => (
                    <button
                      key={di.label}
                      onClick={() => setEditData({ ...editData, nickname: di.label })}
                      className={`p-4 rounded-xl text-2xl bg-slate-50 border-2 transition-all ${String(editData.nickname || '').includes(di.label) ? 'border-indigo-500 bg-indigo-50' : 'border-transparent'}`}
                    >
                      {di.icon}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveEdit}
                className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all shadow-indigo-200"
              >
                {ui.saveDeviceSettings}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HardwareToggle: React.FC<{
  label: string;
  active: boolean;
  icon: string;
  onToggle: () => void;
  dir?: 'rtl' | 'ltr';
}> = ({ label, active, icon, onToggle, dir = 'ltr' }) => (
  <div
    onClick={onToggle}
    className={`flex items-center justify-between p-5 rounded-[2.2rem] border-2 cursor-pointer transition-all ${active ? 'bg-red-50 border-red-200 shadow-md' : 'bg-slate-50/50 border-transparent hover:bg-slate-100'}`}
  >
    <div className="flex items-center gap-4">
      <span className="text-xs font-black text-slate-500">{icon}</span>
      <span className="text-xs font-black text-slate-700">{label}</span>
    </div>
    <div
      className={`w-12 h-7 rounded-full p-1 transition-all ${active ? 'bg-red-600' : 'bg-slate-300'}`}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${active ? (dir === 'rtl' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`}
      ></div>
    </div>
  </div>
);

export default DevicesView;
