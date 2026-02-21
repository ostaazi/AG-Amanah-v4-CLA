export interface ThresholdRangeConfig {
  min: number;
  max: number;
  step: number;
  digits: number;
}

export interface VisualThresholdDraft {
  nsfwExplicitCritical: number;
  nsfwSexyMedium: number;
  violenceMedium: number;
  violenceHigh: number;
  violenceCritical: number;
  violenceSafeSuppression: number;
  violenceMarginGuard: number;
  injuryFastPathScore: number;
  injuryClusterCellRatio: number;
  injuryMinDangerRatio: number;
  injuryVarianceGuard: number;
}

export interface TextThresholdDraft {
  severityMedium: number;
  severityHigh: number;
  severityCritical: number;
  gatePredator: number;
  gateSelfHarm: number;
  gateBlackmail: number;
  gateViolence: number;
  gateAdultContent: number;
  gateBullying: number;
}

export const VISUAL_THRESHOLD_RANGES: Record<keyof VisualThresholdDraft, ThresholdRangeConfig> = {
  nsfwExplicitCritical: { min: 0.3, max: 0.95, step: 0.01, digits: 2 },
  nsfwSexyMedium: { min: 0.4, max: 0.98, step: 0.01, digits: 2 },
  violenceMedium: { min: 0.45, max: 0.9, step: 0.01, digits: 2 },
  violenceHigh: { min: 0.55, max: 0.96, step: 0.01, digits: 2 },
  violenceCritical: { min: 0.65, max: 0.99, step: 0.01, digits: 2 },
  violenceSafeSuppression: { min: 0.2, max: 0.9, step: 0.01, digits: 2 },
  violenceMarginGuard: { min: 0.02, max: 0.3, step: 0.01, digits: 2 },
  injuryFastPathScore: { min: 0.6, max: 0.99, step: 0.01, digits: 2 },
  injuryClusterCellRatio: { min: 0.2, max: 0.7, step: 0.01, digits: 2 },
  injuryMinDangerRatio: { min: 0.01, max: 0.2, step: 0.005, digits: 3 },
  injuryVarianceGuard: { min: 20, max: 300, step: 1, digits: 0 },
};

export const TEXT_RULE_THRESHOLD_RANGES: Record<keyof TextThresholdDraft, ThresholdRangeConfig> = {
  severityMedium: { min: 0.45, max: 0.9, step: 0.01, digits: 2 },
  severityHigh: { min: 0.55, max: 0.97, step: 0.01, digits: 2 },
  severityCritical: { min: 0.7, max: 0.99, step: 0.01, digits: 2 },
  gatePredator: { min: 0.45, max: 0.99, step: 0.01, digits: 2 },
  gateSelfHarm: { min: 0.45, max: 0.99, step: 0.01, digits: 2 },
  gateBlackmail: { min: 0.45, max: 0.99, step: 0.01, digits: 2 },
  gateViolence: { min: 0.45, max: 0.99, step: 0.01, digits: 2 },
  gateAdultContent: { min: 0.45, max: 0.99, step: 0.01, digits: 2 },
  gateBullying: { min: 0.45, max: 0.99, step: 0.01, digits: 2 },
};

export const VISUAL_THRESHOLD_DEFAULTS: VisualThresholdDraft = {
  nsfwExplicitCritical: 0.5,
  nsfwSexyMedium: 0.75,
  violenceMedium: 0.64,
  violenceHigh: 0.78,
  violenceCritical: 0.9,
  violenceSafeSuppression: 0.57,
  violenceMarginGuard: 0.1,
  injuryFastPathScore: 0.9,
  injuryClusterCellRatio: 0.35,
  injuryMinDangerRatio: 0.05,
  injuryVarianceGuard: 95,
};

export const TEXT_RULE_THRESHOLD_DEFAULTS: TextThresholdDraft = {
  severityMedium: 0.7,
  severityHigh: 0.82,
  severityCritical: 0.94,
  gatePredator: 0.9,
  gateSelfHarm: 0.84,
  gateBlackmail: 0.9,
  gateViolence: 0.8,
  gateAdultContent: 0.82,
  gateBullying: 0.72,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const normalizeVisualThresholdDraft = (draft: VisualThresholdDraft): VisualThresholdDraft => {
  const normalized = { ...draft };

  (Object.keys(VISUAL_THRESHOLD_RANGES) as Array<keyof VisualThresholdDraft>).forEach((key) => {
    const range = VISUAL_THRESHOLD_RANGES[key];
    normalized[key] = clamp(Number(normalized[key]), range.min, range.max);
  });

  const high = Math.max(normalized.violenceHigh, normalized.violenceMedium + 0.02);
  const critical = Math.max(normalized.violenceCritical, high + 0.02);
  normalized.violenceHigh = clamp(high, VISUAL_THRESHOLD_RANGES.violenceHigh.min, VISUAL_THRESHOLD_RANGES.violenceHigh.max);
  normalized.violenceCritical = clamp(
    critical,
    VISUAL_THRESHOLD_RANGES.violenceCritical.min,
    VISUAL_THRESHOLD_RANGES.violenceCritical.max
  );
  return normalized;
};

export const normalizeTextThresholdDraft = (draft: TextThresholdDraft): TextThresholdDraft => {
  const normalized = { ...draft };

  (Object.keys(TEXT_RULE_THRESHOLD_RANGES) as Array<keyof TextThresholdDraft>).forEach((key) => {
    const range = TEXT_RULE_THRESHOLD_RANGES[key];
    normalized[key] = clamp(Number(normalized[key]), range.min, range.max);
  });

  const high = Math.max(normalized.severityHigh, normalized.severityMedium + 0.02);
  const critical = Math.max(normalized.severityCritical, high + 0.02);
  normalized.severityHigh = clamp(high, TEXT_RULE_THRESHOLD_RANGES.severityHigh.min, TEXT_RULE_THRESHOLD_RANGES.severityHigh.max);
  normalized.severityCritical = clamp(
    critical,
    TEXT_RULE_THRESHOLD_RANGES.severityCritical.min,
    TEXT_RULE_THRESHOLD_RANGES.severityCritical.max
  );
  return normalized;
};
