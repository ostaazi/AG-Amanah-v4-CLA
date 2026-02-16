import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import PsychologicalInsightView from '../../components/PsychologicalInsightView';
import { AlertSeverity, Category, Child } from '../../types';

vi.mock('../../services/firestoreService', () => ({
  fetchPlaybooks: vi.fn(async () => []),
  sendRemoteCommand: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../services/ruleEngineService', () => ({
  getDefenseActionsWithPlaybooks: vi.fn(() => []),
}));

const baseChild: Child = {
  id: 'child-1',
  parentId: 'parent-1',
  name: 'أحمد',
  role: 'CHILD',
  avatar: 'avatar-1',
  age: 13,
  status: 'online',
  batteryLevel: 74,
  signalStrength: 4,
  screenTimeLimit: 180,
  currentScreenTime: 96,
  deviceLocked: false,
  cameraBlocked: false,
  micBlocked: false,
  preventAppInstall: false,
  preventDeviceLock: false,
  appUsage: [
    { id: 'app-1', appName: 'Discord', icon: '💬', minutesUsed: 45, isBlocked: false },
    { id: 'app-2', appName: 'YouTube', icon: '▶️', minutesUsed: 40, isBlocked: false },
  ],
  psychProfile: {
    anxietyLevel: 62,
    moodScore: 44,
    dominantEmotion: 'قلق',
    isolationRisk: 58,
    recentKeywords: ['تنمر', 'تهديد'],
    recommendation: 'التدخل الهادئ مع متابعة يومية.',
    priorityScenario: 'bullying',
    weeklyTrend: [
      { label: 'الاثنين', value: 52 },
      { label: 'الثلاثاء', value: 49 },
      { label: 'الأربعاء', value: 55 },
    ],
    riskSignals: [
      {
        id: 'sig-1',
        title: 'تنبيه اختبار',
        severity: AlertSeverity.HIGH,
        reason: 'مؤشر خطر متكرر',
        suggestedAction: 'توثيق + حظر + إبلاغ',
      },
    ],
  },
};

const baseAlerts = [
  {
    id: 'a-1',
    childName: 'أحمد',
    platform: 'Discord',
    content: 'تنمر متكرر',
    category: Category.BULLYING,
    severity: AlertSeverity.HIGH,
    timestamp: new Date(),
    aiAnalysis: 'bullying',
  },
];

const renderView = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <PsychologicalInsightView
          theme="light"
          child={baseChild}
          alerts={baseAlerts}
          onAcceptPlan={() => {}}
        />
      </MemoryRouter>
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

describe('PsychologicalInsightView', () => {
  it('renders without runtime crash and shows scenario hub', async () => {
    const { container, cleanup } = await renderView();
    try {
      expect(container.textContent).toContain('مركز النبض النفسي');
      expect(container.textContent).toContain('التنمر الإلكتروني');
    } finally {
      await cleanup();
    }
  });

  it('expands scenario cards safely across available toggles', async () => {
    const { container, cleanup } = await renderView();
    try {
      const toggleButtons = Array.from(container.querySelectorAll('button')).filter((button) => {
        const label = button.textContent || '';
        return label.includes('اعرض المزيد') || label.includes('إخفاء التفاصيل');
      });

      expect(toggleButtons.length).toBeGreaterThan(5);

      for (const button of toggleButtons.slice(0, 8)) {
        await act(async () => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      }

      expect(container.textContent).toContain('الأعراض التفصيلية');
      expect(container.textContent).toContain('طرق الاستدراج التفصيلية');
    } finally {
      await cleanup();
    }
  });
});
