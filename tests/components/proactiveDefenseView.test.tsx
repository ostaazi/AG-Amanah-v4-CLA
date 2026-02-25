import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import ProactiveDefenseView from '../../components/ProactiveDefenseView';
import { AlertSeverity, Category, Child, CommandPriority } from '../../types';

vi.mock('../../services/firestoreService', () => ({
  fetchPlaybooks: vi.fn(async () => []),
  sendRemoteCommand: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../services/psychSignalFusionService', () => ({
  buildUnifiedPsychSignals: vi.fn(() => ({
    events: [],
    scenarioScore: {},
    sourceCoverage: { counts: {}, sourceCount: 0, depthScore: 0 },
    trajectories: [],
    topDriversAr: [],
    topDriversEn: [],
  })),
}));

vi.mock('../../services/psychAutomationGateService', () => ({
  buildPsychAutomationGate: vi.fn(() => ({
    lockEnabled: false,
    containmentEnabled: false,
    ruleEngineConfidence: 45,
    summaryAr: 'بوابة المسارات: تحت العتبة.',
    summaryEn: 'Trajectory gate: below threshold, only evidence/follow-up actions are enabled.',
    matchedTrajectories: [],
    topTrajectory: undefined,
    commandDecisions: {
      lockDevice: {
        allowed: false,
        reasonAr: 'تم تعطيل إجراء القفل بسبب المسارات.',
        reasonEn: 'Lock action is gated by trajectories.',
      },
      takeScreenshot: { allowed: true, reasonAr: '', reasonEn: '' },
    },
  })),
}));

vi.mock('../../services/ruleEngineService', () => ({
  getDefenseActionsWithPlaybooks: vi.fn(() => [
    {
      id: 'lock',
      label: 'Emergency Lock',
      command: 'lockDevice',
      payload: true,
      priority: CommandPriority.CRITICAL,
    },
    {
      id: 'shot',
      label: 'Capture Evidence',
      command: 'takeScreenshot',
      payload: true,
      priority: CommandPriority.HIGH,
    },
  ]),
}));

const baseChild: Child = {
  id: 'child-1',
  parentId: 'parent-1',
  name: 'Sara',
  role: 'CHILD',
  avatar: 'avatar-1',
  age: 12,
  status: 'online',
  batteryLevel: 80,
  signalStrength: 4,
  currentScreenTime: 50,
  screenTimeLimit: 120,
  deviceLocked: false,
  cameraBlocked: false,
  micBlocked: false,
  preventAppInstall: false,
  preventDeviceLock: false,
  appUsage: [{ id: 'a1', appName: 'Telegram', icon: 'T', minutesUsed: 30, isBlocked: false }],
};

describe('ProactiveDefenseView trajectory gate', () => {
  it('filters gated lock actions and keeps safe actions visible', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <ProactiveDefenseView
          children={[baseChild]}
          lang="en"
          parentId="parent-1"
          onUpdateDefense={() => Promise.resolve()}
          alerts={[
            {
              id: 'alert-1',
              childId: 'child-1',
              childName: 'Sara',
              platform: 'Screen Monitor',
              content: 'test',
              category: Category.BULLYING,
              severity: AlertSeverity.HIGH,
              timestamp: new Date(),
              aiAnalysis: 'test',
            },
          ]}
          signalEvents={[]}
        />
      );
    });

    try {
      const text = container.textContent || '';
      expect(text).toContain('Trajectory Gate');
      expect(text).toContain('Capture Evidence');
      expect(text).not.toContain('Emergency Lock');
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
