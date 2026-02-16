import { describe, expect, it } from 'vitest';
import { diagnosePsychScenarioFromAlerts } from '../../services/psychDiagnosticService';
import { AlertSeverity, Category, MonitoringAlert } from '../../types';

const buildAlert = (partial: Partial<MonitoringAlert>): MonitoringAlert => ({
  id: partial.id || 'a1',
  childName: partial.childName || 'Lina',
  platform: partial.platform || 'discord',
  content: partial.content || '',
  category: partial.category || Category.BLACKMAIL,
  severity: partial.severity || AlertSeverity.HIGH,
  timestamp: partial.timestamp || new Date(),
  aiAnalysis: partial.aiAnalysis || partial.content || 'signal',
  imageData: partial.imageData,
  actionTaken: partial.actionTaken,
  latency: partial.latency,
  suspectId: partial.suspectId,
  status: partial.status,
});

describe('psychDiagnosticService threat subtype', () => {
  it('classifies sexual exploitation as standalone when exploitation signals dominate', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'sx-1',
        category: Category.SEXUAL_EXPLOITATION,
        content: 'sextortion with private photos',
        aiAnalysis: 'sexual blackmail attempt detected',
        severity: AlertSeverity.CRITICAL,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);

    expect(diagnosis?.scenarioId).toBe('sexual_exploitation');
    expect(diagnosis?.threatSubtype).toBeUndefined();
  });

  it('classifies financial blackmail track when payment coercion dominates', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'fin-1',
        category: Category.SCAM,
        content: 'urgent payment transfer to crypto wallet',
        aiAnalysis: 'blackmail payment pressure via gift card',
        severity: AlertSeverity.HIGH,
      }),
      buildAlert({
        id: 'fin-2',
        category: Category.BLACKMAIL,
        content: 'send transfer now',
        aiAnalysis: 'demanding bitcoin transfer',
        severity: AlertSeverity.HIGH,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);

    expect(diagnosis?.scenarioId).toBe('threat_exposure');
    expect(diagnosis?.threatSubtype).toBe('financial_blackmail');
  });

  it('does not attach threat subtype when top scenario is not threat exposure', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'game-1',
        category: Category.SAFE,
        content: 'gaming rank grind and long screen time',
        aiAnalysis: 'gaming overuse and sleep disruption',
        severity: AlertSeverity.HIGH,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);

    expect(diagnosis?.scenarioId).toBe('gaming');
    expect(diagnosis?.threatSubtype).toBeUndefined();
  });

  it('classifies phishing links as a standalone scenario when phishing category dominates', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'ph-1',
        category: Category.PHISHING_LINK,
        content: 'suspicious url requesting otp and password reset',
        aiAnalysis: 'phishing attempt via fake login page',
        severity: AlertSeverity.CRITICAL,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);

    expect(diagnosis?.scenarioId).toBe('phishing_links');
    expect(diagnosis?.threatSubtype).toBeUndefined();
  });

  it('classifies inappropriate content with sexual-content track', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'ic-1',
        category: Category.ADULT_CONTENT,
        content: 'adult explicit content detected',
        aiAnalysis: 'porn exposure risk',
        severity: AlertSeverity.HIGH,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);

    expect(diagnosis?.scenarioId).toBe('inappropriate_content');
    expect(diagnosis?.contentSubtype).toBe('sexual_content');
  });

  it('classifies inappropriate content with violent-content track', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'ic-2',
        category: Category.ADULT_CONTENT,
        content: 'gore violent blood scenes',
        aiAnalysis: 'violent harmful media exposure',
        severity: AlertSeverity.HIGH,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);

    expect(diagnosis?.scenarioId).toBe('inappropriate_content');
    expect(diagnosis?.contentSubtype).toBe('violent_content');
  });

  it('classifies self-harm as a standalone scenario', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'sh-1',
        category: Category.SELF_HARM,
        content: 'self harm and suicide thoughts',
        aiAnalysis: 'explicit self harm ideation',
        severity: AlertSeverity.CRITICAL,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);
    expect(diagnosis?.scenarioId).toBe('self_harm');
  });

  it('classifies sexual exploitation as a standalone scenario', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'se-1',
        category: Category.SEXUAL_EXPLOITATION,
        content: 'predator grooming and sexual exploitation behavior',
        aiAnalysis: 'grooming signals with coercive request',
        severity: AlertSeverity.CRITICAL,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);
    expect(diagnosis?.scenarioId).toBe('sexual_exploitation');
  });

  it('classifies account-theft/fraud as a standalone scenario', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'af-1',
        category: Category.SCAM,
        content: 'account stolen reset code credential stuffing attempt',
        aiAnalysis: 'stolen account and reset token fraud sequence',
        severity: AlertSeverity.HIGH,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);
    expect(diagnosis?.scenarioId).toBe('account_theft_fraud');
  });

  it('classifies gambling/betting as a standalone scenario', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'gb-1',
        category: Category.SAFE,
        content: 'casino bet odds and skin betting pressure',
        aiAnalysis: 'repeated gambling and betting behavior',
        severity: AlertSeverity.HIGH,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);
    expect(diagnosis?.scenarioId).toBe('gambling_betting');
  });

  it('classifies privacy/tracking as a standalone scenario', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'pt-1',
        category: Category.SAFE,
        content: 'tracking link with doxxing and location leak',
        aiAnalysis: 'spy app and privacy breach indicators',
        severity: AlertSeverity.HIGH,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);
    expect(diagnosis?.scenarioId).toBe('privacy_tracking');
  });

  it('classifies harmful challenges as a standalone scenario', () => {
    const alerts: MonitoringAlert[] = [
      buildAlert({
        id: 'hc-1',
        category: Category.VIOLENCE,
        content: 'dangerous challenge and harmful challenge coordination',
        aiAnalysis: 'violent trend escalation',
        severity: AlertSeverity.CRITICAL,
      }),
    ];

    const diagnosis = diagnosePsychScenarioFromAlerts('Lina', alerts);
    expect(diagnosis?.scenarioId).toBe('harmful_challenges');
  });
});
