import React, { useEffect, useMemo, useState } from 'react';
import { Child } from '../../types';
import {
  createOfflineUnlockProvisioning,
  generateOfflineUnlockCode,
  getOfflineUnlockCodeRemainingSec,
  getParentOfflineUnlockKit,
  OfflineUnlockParentKit,
  saveParentOfflineUnlockKit,
} from '../../services/offlineUnlockService';
import { runParentDeviceVulnerabilityScan } from '../../services/vulnerabilityIntelService';

interface DeviceCommandControlProps {
  lang: 'ar' | 'en';
  children: Child[];
  onSendCommand: (childId: string, command: string, payload?: any) => Promise<void>;
  allLocksDisabled?: boolean;
  lockDisableLabel?: string;
}

const DeviceCommandControl: React.FC<DeviceCommandControlProps> = ({
  children,
  onSendCommand,
  allLocksDisabled = false,
  lockDisableLabel = '',
}) => {
  const [childId, setChildId] = useState(children[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [blackoutMessage, setBlackoutMessage] = useState(
    'Device locked for safety. Please contact a parent.'
  );
  const [dnsMode, setDnsMode] = useState<'family' | 'strict' | 'custom' | 'sandbox'>('family');
  const [dnsDomains, setDnsDomains] = useState('');
  const [offlineKit, setOfflineKit] = useState<OfflineUnlockParentKit | null>(null);
  const [offlineCurrentCode, setOfflineCurrentCode] = useState('');
  const [offlineCodeRemainingSec, setOfflineCodeRemainingSec] = useState(0);
  const [latestProvisionedBackupCodes, setLatestProvisionedBackupCodes] = useState<string[]>([]);

  const current = useMemo(
    () => children.find((c) => c.id === childId) || children[0],
    [children, childId]
  );

  useEffect(() => {
    if (!current) {
      setOfflineKit(null);
      setOfflineCurrentCode('');
      setOfflineCodeRemainingSec(0);
      return;
    }
    const saved = getParentOfflineUnlockKit(current.id);
    setOfflineKit(saved);
    setLatestProvisionedBackupCodes([]);
  }, [current?.id]);

  const run = async (command: string, payload: any = true) => {
    if (!current) return;
    setBusy(true);
    setCommandError('');
    try {
      await onSendCommand(current.id, command, payload);
    } catch (error: any) {
      setCommandError(`Command failed: ${String(error?.message || 'Unknown error')}`);
    } finally {
      setBusy(false);
    }
  };

  const runUnlockFlow = async () => {
    if (!current) return;
    setBusy(true);
    setCommandError('');
    try {
      await onSendCommand(current.id, 'lockDevice', false);
      await onSendCommand(current.id, 'lockscreenBlackout', {
        enabled: false,
        message: '',
        source: 'parent_ops_manual_unlock',
      });
    } catch (error: any) {
      setCommandError(`Unlock failed: ${String(error?.message || 'Unknown error')}`);
    } finally {
      setBusy(false);
    }
  };

  const refreshOfflineCode = async (kit: OfflineUnlockParentKit | null) => {
    if (!kit) {
      setOfflineCurrentCode('');
      setOfflineCodeRemainingSec(0);
      return;
    }
    try {
      const code = await generateOfflineUnlockCode(kit.totpSecret, {
        digits: kit.digits,
        periodSec: kit.periodSec,
      });
      setOfflineCurrentCode(code);
      setOfflineCodeRemainingSec(getOfflineUnlockCodeRemainingSec(kit.periodSec));
    } catch {
      setOfflineCurrentCode('');
      setOfflineCodeRemainingSec(0);
    }
  };

  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (!active) return;
      await refreshOfflineCode(offlineKit);
    };
    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [offlineKit?.totpSecret, offlineKit?.digits, offlineKit?.periodSec]);

  const provisionOfflineUnlock = async () => {
    if (!current) return;
    setBusy(true);
    setCommandError('');
    try {
      const { parentKit, commandPayload } = await createOfflineUnlockProvisioning(current.id);
      await onSendCommand(current.id, 'syncOfflineUnlockConfig', commandPayload);
      saveParentOfflineUnlockKit(parentKit);
      setOfflineKit(parentKit);
      setLatestProvisionedBackupCodes(parentKit.backupCodes);
      await refreshOfflineCode(parentKit);
    } catch (error: any) {
      setCommandError(`Offline unlock provisioning failed: ${String(error?.message || 'Unknown error')}`);
    } finally {
      setBusy(false);
    }
  };

  const triggerVulnerabilityScan = async () => {
    if (current?.parentId) {
      try {
        await runParentDeviceVulnerabilityScan(current.parentId);
      } catch {
        // Parent-side scan failure should not block child scan command.
      }
    }
    await run('runVulnerabilityScan', {
      enabled: true,
      deep: true,
      includeParentSurface: true,
      source: 'parent_ops_manual',
    });
  };

  const normalizeDomainToken = (raw: string): string => {
    return raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .replace(/^\*\./, '');
  };

  const buildDnsPayload = (enabled: boolean) => {
    const customDomains = Array.from(
      new Set(
        dnsDomains
          .split(/[\n,;]+/)
          .map(normalizeDomainToken)
          .filter((entry) => entry && /^[a-z0-9.-]+$/.test(entry))
      )
    ).slice(0, 200);

    return {
      enabled,
      mode: dnsMode,
      domains: customDomains,
      source: 'parent_manual_dns_control',
    };
  };

  return (
    <div
      className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-4"
      dir="ltr"
    >
      <h4 className="text-lg font-black text-slate-900">
        Direct Device Commands
      </h4>

      <select
        value={current?.id || ''}
        onChange={(e) => setChildId(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
      >
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => run('lockDevice', true)}
          disabled={busy || allLocksDisabled}
          className="py-2 rounded-xl bg-slate-900 text-white text-sm font-black disabled:opacity-50"
        >
          Lock Device
        </button>

        <button
          onClick={runUnlockFlow}
          disabled={busy}
          className="py-2 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50"
        >
          Unlock Device
        </button>

        <button
          onClick={provisionOfflineUnlock}
          disabled={busy}
          className="py-2 rounded-xl bg-amber-700 text-white text-sm font-black disabled:opacity-50"
        >
          Provision Offline Unlock
        </button>

        <button
          onClick={triggerVulnerabilityScan}
          disabled={busy}
          className="py-2 rounded-xl bg-rose-800 text-white text-sm font-black disabled:opacity-50"
        >
          Run Vulnerability Scan
        </button>

        <button
          onClick={() => run('takeScreenshot', true)}
          disabled={busy}
          className="py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50"
        >
          Screenshot
        </button>

        <button
          onClick={() => run('playSiren', true)}
          disabled={busy}
          className="py-2 rounded-xl bg-rose-600 text-white text-sm font-black disabled:opacity-50"
        >
          Siren
        </button>

        <button
          onClick={() => run('startLiveStream', { videoSource: 'screen', audioSource: 'mic' })}
          disabled={busy}
          className="py-2 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50"
        >
          Start Stream
        </button>

        <button
          onClick={() =>
            run('lockscreenBlackout', {
              enabled: true,
              message: blackoutMessage,
              source: 'parent_ops_manual',
            })
          }
          disabled={busy || allLocksDisabled}
          className="py-2 rounded-xl bg-violet-600 text-white text-sm font-black disabled:opacity-50"
        >
          Blackout Screen
        </button>

        <button
          onClick={() =>
            run('lockscreenBlackout', {
              enabled: false,
              message: '',
              source: 'parent_ops_manual_clear',
            })
          }
          disabled={busy}
          className="py-2 rounded-xl bg-slate-700 text-white text-sm font-black disabled:opacity-50"
        >
          Disable Blackout
        </button>

        <button
          onClick={() =>
            run('walkieTalkieEnable', {
              enabled: true,
              source: 'mic',
              sourceTag: 'parent_ops_manual',
            })
          }
          disabled={busy}
          className="py-2 rounded-xl bg-amber-600 text-white text-sm font-black disabled:opacity-50"
        >
          Enable Walkie-Talkie
        </button>

        <button
          onClick={() => run('dnsFiltering', buildDnsPayload(true))}
          disabled={busy}
          className="py-2 rounded-xl bg-cyan-700 text-white text-sm font-black disabled:opacity-50"
        >
          Enable DNS Filter
        </button>

        <button
          onClick={() => run('dnsFiltering', buildDnsPayload(false))}
          disabled={busy}
          className="py-2 rounded-xl bg-cyan-900 text-white text-sm font-black disabled:opacity-50"
        >
          Disable DNS Filter
        </button>
      </div>

      <input
        value={blackoutMessage}
        onChange={(e) => setBlackoutMessage(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
        placeholder="Blackout message..."
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <p className="text-xs font-black text-slate-700">
          DNS-Level Network Filtering Settings
        </p>

        <select
          value={dnsMode}
          onChange={(e) => setDnsMode(e.target.value as 'family' | 'strict' | 'custom' | 'sandbox')}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold"
        >
          <option value="family">Family Safe</option>
          <option value="strict">Strict</option>
          <option value="custom">Custom</option>
          <option value="sandbox">Sandbox (Quarantine)</option>
        </select>

        <p className="text-[11px] font-bold text-slate-500">
          {dnsMode === 'sandbox'
            ? 'Sandbox mode uses automatic on-device domain scoring to allow or block instantly.'
            : 'Other modes treat the domain list as additional blocked entries.'}
        </p>

        <textarea
          value={dnsDomains}
          onChange={(e) => setDnsDomains(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold min-h-20"
          placeholder={'Custom blocked domains (one per line or comma)\nexample.com\nbad-site.net'}
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black text-amber-900">
            Offline Unlock Codes
          </p>
          <button
            onClick={() => void refreshOfflineCode(offlineKit)}
            disabled={busy || !offlineKit}
            className="px-3 py-1 rounded-lg bg-amber-800 text-white text-[11px] font-black disabled:opacity-50"
          >
            Refresh Code
          </button>
        </div>

        {offlineKit ? (
          <>
            <p className="text-2xl tracking-[0.18em] font-black text-amber-950 text-center">
              {offlineCurrentCode || '--------'}
            </p>
            <p className="text-[11px] font-bold text-amber-800 text-center">
              {`Rotates in ${offlineCodeRemainingSec}s`}
            </p>
          </>
        ) : (
          <p className="text-[11px] font-bold text-amber-800">
            No offline unlock kit found. Use "Provision Offline Unlock".
          </p>
        )}

        {latestProvisionedBackupCodes.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-white/70 px-2 py-2">
            <p className="text-[10px] font-black text-amber-900 mb-1">
              Backup codes (shown once, store securely)
            </p>
            <p className="text-[11px] font-black text-amber-950 break-words">
              {latestProvisionedBackupCodes.join(' - ')}
            </p>
          </div>
        )}
      </div>

      {!!commandError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-700">
          {commandError}
        </div>
      )}

      {allLocksDisabled && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700">
          {lockDisableLabel ||
            'All lock actions are disabled from settings.'}
        </div>
      )}
    </div>
  );
};

export default DeviceCommandControl;
