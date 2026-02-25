import { AlertSeverity } from '../types';
import type { PsychScenarioId } from './psychDiagnosticService';
import type { PsychSignalTrajectory } from './psychSignalFusionService';

export type PsychAutomationCommand =
  | 'takeScreenshot'
  | 'blockApp'
  | 'setVideoSource'
  | 'setAudioSource'
  | 'startLiveStream'
  | 'lockDevice'
  | 'playSiren'
  | 'lockscreenBlackout'
  | 'walkieTalkieEnable'
  | 'cutInternet'
  | 'blockCameraAndMic'
  | 'notifyParent';

export interface PsychAutomationCommandDecision {
  allowed: boolean;
  reasonAr: string;
  reasonEn: string;
}

export interface PsychAutomationGateResult {
  lockEnabled: boolean;
  containmentEnabled: boolean;
  ruleEngineConfidence: number;
  summaryAr: string;
  summaryEn: string;
  matchedTrajectories: PsychSignalTrajectory[];
  topTrajectory?: PsychSignalTrajectory;
  commandDecisions: Record<PsychAutomationCommand, PsychAutomationCommandDecision>;
}

interface BuildPsychAutomationGateInput {
  activeScenarioId: PsychScenarioId;
  dominantSeverity: AlertSeverity;
  trajectories: PsychSignalTrajectory[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const severityRank: Record<AlertSeverity, number> = {
  [AlertSeverity.LOW]: 1,
  [AlertSeverity.MEDIUM]: 2,
  [AlertSeverity.HIGH]: 3,
  [AlertSeverity.CRITICAL]: 4,
};

const defaultDecision = (allowed = true): PsychAutomationCommandDecision => ({
  allowed,
  reasonAr: '',
  reasonEn: '',
});

const denyDecision = (reasonAr: string, reasonEn: string): PsychAutomationCommandDecision => ({
  allowed: false,
  reasonAr,
  reasonEn,
});

const severityFallbackConfidence = (severity: AlertSeverity): number => {
  if (severity === AlertSeverity.CRITICAL) return 88;
  if (severity === AlertSeverity.HIGH) return 74;
  if (severity === AlertSeverity.MEDIUM) return 61;
  return 45;
};

export const buildPsychAutomationGate = (
  input: BuildPsychAutomationGateInput
): PsychAutomationGateResult => {
  const matchedTrajectories = (input.trajectories || [])
    .filter((trajectory) => trajectory.scenarioHints.includes(input.activeScenarioId))
    .sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      return b.confidence - a.confidence;
    });
  const topTrajectory = matchedTrajectories[0];

  const hasCriticalTrajectory = matchedTrajectories.some(
    (trajectory) =>
      trajectory.stage === 'critical' &&
      trajectory.riskScore >= 78 &&
      trajectory.confidence >= 64
  );
  const hasContainmentTrajectory = matchedTrajectories.some(
    (trajectory) =>
      (trajectory.stage === 'critical' || trajectory.stage === 'escalating') &&
      trajectory.riskScore >= 62 &&
      trajectory.confidence >= 56
  );

  const lockEnabled =
    hasCriticalTrajectory || input.dominantSeverity === AlertSeverity.CRITICAL;
  const containmentEnabled =
    lockEnabled ||
    hasContainmentTrajectory ||
    severityRank[input.dominantSeverity] >= severityRank[AlertSeverity.HIGH];

  const computedTrajectoryConfidence = topTrajectory
    ? topTrajectory.confidence * 0.62 + topTrajectory.riskScore * 0.38
    : severityFallbackConfidence(input.dominantSeverity);
  const ruleEngineConfidence = clamp(computedTrajectoryConfidence, 35, 99);

  const decisions: Record<PsychAutomationCommand, PsychAutomationCommandDecision> = {
    takeScreenshot: defaultDecision(true),
    notifyParent: defaultDecision(true),
    setVideoSource: defaultDecision(true),
    setAudioSource: defaultDecision(true),
    startLiveStream: defaultDecision(true),
    walkieTalkieEnable: defaultDecision(true),
    blockApp: defaultDecision(true),
    cutInternet: defaultDecision(true),
    blockCameraAndMic: defaultDecision(true),
    lockDevice: defaultDecision(true),
    lockscreenBlackout: defaultDecision(true),
    playSiren: defaultDecision(true),
  };

  if (!containmentEnabled) {
    const reasonAr =
      'تم تعطيل هذا الإجراء تلقائيًا لأن المسارات الحالية لم تتجاوز عتبة الاحتواء.';
    const reasonEn =
      'This action was auto-gated because current trajectories are below containment threshold.';
    decisions.startLiveStream = denyDecision(reasonAr, reasonEn);
    decisions.walkieTalkieEnable = denyDecision(reasonAr, reasonEn);
    decisions.blockApp = denyDecision(reasonAr, reasonEn);
    decisions.cutInternet = denyDecision(reasonAr, reasonEn);
    decisions.blockCameraAndMic = denyDecision(reasonAr, reasonEn);
  }

  if (!lockEnabled) {
    const reasonAr =
      'تم تعطيل هذا الإجراء تلقائيًا لأن المسارات الحالية لم تصل إلى مرحلة حرجة.';
    const reasonEn =
      'This action was auto-gated because trajectories did not reach critical stage.';
    decisions.lockDevice = denyDecision(reasonAr, reasonEn);
    decisions.lockscreenBlackout = denyDecision(reasonAr, reasonEn);
    decisions.playSiren = denyDecision(reasonAr, reasonEn);
  }

  const summaryAr = lockEnabled
    ? 'بوابة المسارات: مرحلة حرجة، تم فتح إجراءات الاحتواء والإغلاق.'
    : containmentEnabled
      ? 'بوابة المسارات: مرحلة تصاعد، تم فتح إجراءات الاحتواء فقط.'
      : 'بوابة المسارات: تحت العتبة، مسموح بالتوثيق والمتابعة فقط.';
  const summaryEn = lockEnabled
    ? 'Trajectory gate: critical stage, containment and lock actions are enabled.'
    : containmentEnabled
      ? 'Trajectory gate: escalating stage, containment actions only are enabled.'
      : 'Trajectory gate: below threshold, only evidence/follow-up actions are enabled.';

  return {
    lockEnabled,
    containmentEnabled,
    ruleEngineConfidence,
    summaryAr,
    summaryEn,
    matchedTrajectories,
    topTrajectory,
    commandDecisions: decisions,
  };
};
