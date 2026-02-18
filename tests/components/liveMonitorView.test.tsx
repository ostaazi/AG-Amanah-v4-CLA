import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LiveMonitorView from '../../components/LiveMonitorView';
import type { Child } from '../../types';
import { sendRemoteCommand } from '../../services/firestoreService';

vi.mock('../../services/firestoreService', () => ({
  sendRemoteCommand: vi.fn(async () => ({ ok: true })),
  subscribeToAlerts: vi.fn(() => () => {}),
}));

const baseChild: Child = {
  id: 'child-1',
  parentId: 'parent-1',
  name: 'Child One',
  role: 'CHILD',
  avatar: 'avatar-1',
  age: 12,
  status: 'online',
  batteryLevel: 80,
  signalStrength: 4,
  screenTimeLimit: 180,
  currentScreenTime: 60,
  deviceLocked: false,
  cameraBlocked: false,
  micBlocked: false,
  preventAppInstall: false,
  preventDeviceLock: false,
  appUsage: [],
};

const renderView = async (childOverride: Partial<Child>, allLocksDisabled: boolean) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(
      <LiveMonitorView
        children={[{ ...baseChild, ...childOverride }]}
        lang="en"
        allLocksDisabled={allLocksDisabled}
      />
    );
  });

  return {
    container,
    root,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
};

describe('LiveMonitorView lock controls', () => {
  beforeEach(() => {
    vi.mocked(sendRemoteCommand).mockClear();
  });

  it('keeps unlock action enabled when all locks are disabled and child is currently locked', async () => {
    const { container, cleanup } = await renderView({ deviceLocked: true }, true);
    try {
      const lockButton = container.querySelector('[data-testid="live-lock-toggle"]') as HTMLButtonElement | null;
      expect(lockButton).toBeTruthy();
      expect(lockButton?.disabled).toBe(false);

      await act(async () => {
        lockButton?.click();
      });

      expect(sendRemoteCommand).toHaveBeenCalledWith('child-1', 'lockDevice', false);
    } finally {
      await cleanup();
    }
  });

  it('disables lock activation when all locks are disabled and child is already unlocked', async () => {
    const { container, cleanup } = await renderView({ deviceLocked: false }, true);
    try {
      const lockButton = container.querySelector('[data-testid="live-lock-toggle"]') as HTMLButtonElement | null;
      expect(lockButton).toBeTruthy();
      expect(lockButton?.disabled).toBe(true);

      await act(async () => {
        lockButton?.click();
      });

      expect(sendRemoteCommand).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });
});
