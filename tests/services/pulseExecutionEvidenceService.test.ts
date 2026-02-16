import { describe, expect, it } from 'vitest';
import { AlertSeverity, Category } from '../../types';
import {
  PulseExecutionEvidenceInput,
  buildPulseExecutionEvidenceAlert,
} from '../../services/pulseExecutionEvidenceService';

const buildPayload = (timeline: PulseExecutionEvidenceInput['timeline']): PulseExecutionEvidenceInput => ({
  childId: 'child-1',
  childName: 'Lina',
  scenarioId: 'bullying',
  scenarioTitle: 'Cyberbullying',
  severity: AlertSeverity.HIGH,
  dominantPlatform: 'Discord',
  summary: { done: 3, failed: 1, skipped: 2 },
  timeline,
});

describe('pulseExecutionEvidenceService', () => {
  it('sorts timeline ascending and keeps only latest 20 entries', () => {
    const base = Date.UTC(2026, 0, 1, 10, 0, 0);
    const timeline = Array.from({ length: 25 }, (_, i) => ({
      title: `Step ${i}`,
      detail: `Detail ${i}`,
      status: (i % 2 === 0 ? 'done' : 'skipped') as const,
      at: new Date(base + i * 1000).toISOString(),
    })).reverse();

    const result = buildPulseExecutionEvidenceAlert(buildPayload(timeline), 'en');

    expect(result.timelineForLog).toHaveLength(20);
    expect(result.timelineForLog[0].title).toBe('Step 5');
    expect(result.timelineForLog[19].title).toBe('Step 24');
    expect(result.alertData.type).toBe('PULSE_EXECUTION');
    expect(result.alertData.category).toBe(Category.SAFE);
    expect(result.alertData.latency).toContain('Done:3');
  });

  it('builds Arabic summary and maps error entries to Engine Error sender', () => {
    const timeline: PulseExecutionEvidenceInput['timeline'] = [
      {
        title: 'لقطة شاشة',
        detail: 'تم التقاطها',
        status: 'done',
        at: '2026-01-01T10:00:00.000Z',
      },
      {
        title: 'قفل الجهاز',
        detail: 'فشل التنفيذ',
        status: 'error',
        at: '2026-01-01T10:00:05.000Z',
      },
    ];

    const result = buildPulseExecutionEvidenceAlert(buildPayload(timeline), 'ar');

    expect(result.compactSummary).toContain('تم:3');
    expect(result.compactSummary).toContain('فشل:1');
    expect(result.alertData.content).toContain('تنفيذ خطة التوازن الرقمي');
    expect(result.alertData.conversationLog[1].sender).toBe('Engine Error');
    expect(result.alertData.conversationLog[0].sender).toBe('Amanah Engine');
  });

  it('sanitizes malformed payload fields and normalizes timeline safely', () => {
    const malformedPayload = {
      ...buildPayload([
        {
          title: '   ',
          detail: '   ',
          status: 'oops',
          at: 'not-a-date',
        },
      ] as unknown as PulseExecutionEvidenceInput['timeline']),
      childId: '   ',
      childName: '   ',
      scenarioId: '   ',
      scenarioTitle: '   ',
      dominantPlatform: '   ',
      summary: {
        done: -3,
        failed: Number.POSITIVE_INFINITY,
        skipped: 3.8,
      },
    } as unknown as PulseExecutionEvidenceInput;

    const result = buildPulseExecutionEvidenceAlert(malformedPayload, 'en');

    expect(result.compactSummary).toBe('Done:0 | Skipped:3 | Failed:0');
    expect(result.alertData.childName).toBe('Unknown Child');
    expect(result.alertData.platform).toBe('Pulse / Unknown Platform');
    expect(result.alertData.content).toContain('Unknown Scenario');
    expect(result.alertData.suspectId).toBe('pulse-unknown-child');
    expect(result.alertData.suspectUsername).toBe('pulse_unknown-scenario');
    expect(result.timelineForLog[0]).toMatchObject({
      title: 'Step 1',
      detail: 'No details provided',
      status: 'info',
      at: '1970-01-01T00:00:00.000Z',
    });
  });
});
