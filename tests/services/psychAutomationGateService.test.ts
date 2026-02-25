import { describe, expect, it } from 'vitest';
import { AlertSeverity } from '../../types';
import { buildPsychAutomationGate } from '../../services/psychAutomationGateService';

describe('psychAutomationGateService', () => {
  it('keeps lock/containment actions gated when trajectories are below threshold', () => {
    const gate = buildPsychAutomationGate({
      activeScenarioId: 'threat_exposure',
      dominantSeverity: AlertSeverity.MEDIUM,
      trajectories: [
        {
          id: 't1',
          titleAr: 'مسار تجريبي',
          titleEn: 'Test Trajectory',
          stage: 'watch',
          riskScore: 41,
          confidence: 44,
          scenarioHints: ['threat_exposure'],
          primarySources: ['conversation_text'],
          evidenceKey: 'k1',
          explanationAr: 'x',
          explanationEn: 'x',
        },
      ],
    });

    expect(gate.lockEnabled).toBe(false);
    expect(gate.containmentEnabled).toBe(false);
    expect(gate.commandDecisions.lockDevice.allowed).toBe(false);
    expect(gate.commandDecisions.cutInternet.allowed).toBe(false);
    expect(gate.commandDecisions.takeScreenshot.allowed).toBe(true);
  });

  it('enables containment without lock in escalating trajectory phase', () => {
    const gate = buildPsychAutomationGate({
      activeScenarioId: 'phishing_links',
      dominantSeverity: AlertSeverity.MEDIUM,
      trajectories: [
        {
          id: 't2',
          titleAr: 'تصاعد روابط',
          titleEn: 'Escalating links',
          stage: 'escalating',
          riskScore: 72,
          confidence: 70,
          scenarioHints: ['phishing_links'],
          primarySources: ['dns_network', 'web_link'],
          evidenceKey: 'k2',
          explanationAr: 'x',
          explanationEn: 'x',
        },
      ],
    });

    expect(gate.containmentEnabled).toBe(true);
    expect(gate.lockEnabled).toBe(false);
    expect(gate.commandDecisions.cutInternet.allowed).toBe(true);
    expect(gate.commandDecisions.lockDevice.allowed).toBe(false);
  });

  it('enables lock/blackout when a critical trajectory is present', () => {
    const gate = buildPsychAutomationGate({
      activeScenarioId: 'self_harm',
      dominantSeverity: AlertSeverity.HIGH,
      trajectories: [
        {
          id: 't3',
          titleAr: 'مسار حرج',
          titleEn: 'Critical path',
          stage: 'critical',
          riskScore: 88,
          confidence: 79,
          scenarioHints: ['self_harm'],
          primarySources: ['conversation_text', 'activity_pattern'],
          evidenceKey: 'k3',
          explanationAr: 'x',
          explanationEn: 'x',
        },
      ],
    });

    expect(gate.lockEnabled).toBe(true);
    expect(gate.containmentEnabled).toBe(true);
    expect(gate.commandDecisions.lockDevice.allowed).toBe(true);
    expect(gate.commandDecisions.lockscreenBlackout.allowed).toBe(true);
  });

  it('forces lock path on critical severity even without matching trajectory', () => {
    const gate = buildPsychAutomationGate({
      activeScenarioId: 'bullying',
      dominantSeverity: AlertSeverity.CRITICAL,
      trajectories: [],
    });

    expect(gate.lockEnabled).toBe(true);
    expect(gate.containmentEnabled).toBe(true);
    expect(gate.commandDecisions.lockDevice.allowed).toBe(true);
    expect(gate.ruleEngineConfidence).toBeGreaterThanOrEqual(80);
  });
});
