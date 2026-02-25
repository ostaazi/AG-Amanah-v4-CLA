import { AlertSeverity, Child, ChildSignalEvent, MonitoringAlert, PsychologicalProfile } from '../types';
import type { AlertPsychDiagnosis, PsychScenarioId } from './psychDiagnosticService';
import { analyzePsychConversationContext, PsychConversationContextAnalysis } from './psychContextEngine';
import { buildUnifiedPsychSignals, PsychSignalFusionResult } from './psychSignalFusionService';

export interface PsychForecastInput {
  childName: string;
  child?: Child;
  alerts: MonitoringAlert[];
  signalEvents?: ChildSignalEvent[];
  profile?: PsychologicalProfile;
  diagnosis?: AlertPsychDiagnosis | null;
}

type ForecastTrend = 'rising' | 'stable' | 'cooling';

export interface PsychScenarioForecast {
  scenarioId: PsychScenarioId;
  scenarioLabelAr: string;
  scenarioLabelEn: string;
  riskScore: number;
  probability: number;
  confidence: number;
  trend: ForecastTrend;
  keyDrivers: string[];
  recommendationAr: string;
  recommendationEn: string;
  explanationAr: string;
  explanationEn: string;
}

export interface PsychForecastWindow {
  horizonDays: 7 | 30;
  generatedAt: Date;
  topPredictions: PsychScenarioForecast[];
}

export interface PsychRiskForecastResult {
  childName: string;
  context: PsychConversationContextAnalysis;
  signalFusion: PsychSignalFusionResult;
  sevenDay: PsychForecastWindow;
  thirtyDay: PsychForecastWindow;
}

const SCENARIOS: PsychScenarioId[] = [
  'bullying',
  'threat_exposure',
  'gaming',
  'inappropriate_content',
  'cyber_crime',
  'crypto_scams',
  'phishing_links',
  'self_harm',
  'sexual_exploitation',
  'account_theft_fraud',
  'gambling_betting',
  'privacy_tracking',
  'harmful_challenges',
];

const scenarioLabelMap: Record<PsychScenarioId, { ar: string; en: string }> = {
  bullying: { ar: 'تنمر رقمي', en: 'Digital Bullying' },
  threat_exposure: { ar: 'تهديد وابتزاز', en: 'Threat and Coercion' },
  gaming: { ar: 'استنزاف اللعب', en: 'Gaming Exhaustion' },
  inappropriate_content: { ar: 'محتوى غير لائق', en: 'Inappropriate Content' },
  cyber_crime: { ar: 'انجراف سيبراني', en: 'Cyber Misuse Drift' },
  crypto_scams: { ar: 'احتيال مالي/كريبتو', en: 'Financial/Crypto Scam' },
  phishing_links: { ar: 'روابط تصيد', en: 'Phishing Links' },
  self_harm: { ar: 'خطر إيذاء النفس', en: 'Self-harm Risk' },
  sexual_exploitation: { ar: 'استغلال جنسي', en: 'Sexual Exploitation' },
  account_theft_fraud: { ar: 'سرقة حساب/هوية', en: 'Account/Identity Theft' },
  gambling_betting: { ar: 'مراهنات وقمار', en: 'Gambling/Betting' },
  privacy_tracking: { ar: 'تتبع وخرق خصوصية', en: 'Privacy Tracking' },
  harmful_challenges: { ar: 'تحديات ضارة', en: 'Harmful Challenges' },
};

const recommendationMap: Record<PsychScenarioId, { ar: string; en: string }> = {
  bullying: {
    ar: 'تفعيل الاحتواء: توثيق، حظر المصادر المؤذية، وتمكين دعم نفسي تدريجي.',
    en: 'Contain early: document, block aggressors, and start gradual emotional support.',
  },
  threat_exposure: {
    ar: 'مسار طوارئ: لا تفاوض، حفظ الأدلة، وتأمين الحسابات فورًا.',
    en: 'Emergency path: no negotiation, preserve evidence, and secure accounts immediately.',
  },
  gaming: {
    ar: 'تقليل وقت اللعب تدريجيًا مع بدائل سلوكية يومية.',
    en: 'Reduce gaming time progressively with daily behavioral alternatives.',
  },
  inappropriate_content: {
    ar: 'تشديد الفلاتر مع حوار وقائي بلا لوم لتقليل إعادة التعرض.',
    en: 'Tighten filters and run non-judgmental preventive dialogue to reduce re-exposure.',
  },
  cyber_crime: {
    ar: 'عزل القنوات الخطرة وتحويل الاهتمام لمسار تقني آمن.',
    en: 'Isolate risky channels and redirect interest to a safe technical learning path.',
  },
  crypto_scams: {
    ar: 'إيقاف التحويلات غير المعتمدة وتفعيل تحقق مالي متعدد الطبقات.',
    en: 'Stop unapproved transfers and enforce multi-layer financial verification.',
  },
  phishing_links: {
    ar: 'فرض فحص الروابط قبل الفتح وتدوير كلمات المرور الحساسة.',
    en: 'Enforce pre-open link scanning and rotate sensitive passwords.',
  },
  self_harm: {
    ar: 'احتواء نفسي فوري مع تصعيد مختص عند أي إشارة حادة.',
    en: 'Immediate emotional containment with specialist escalation on any acute signal.',
  },
  sexual_exploitation: {
    ar: 'حماية فورية، منع قنوات الاستدراج، وحفظ الأدلة القانونية.',
    en: 'Immediate protection, block luring channels, and preserve legal evidence.',
  },
  account_theft_fraud: {
    ar: 'إغلاق الجلسات النشطة، تغيير كلمات المرور، وتفعيل 2FA.',
    en: 'Terminate active sessions, rotate passwords, and enable 2FA.',
  },
  gambling_betting: {
    ar: 'تجميد المدفوعات عالية المخاطر ووضع سقف إنفاق صارم.',
    en: 'Freeze high-risk payments and enforce strict spending caps.',
  },
  privacy_tracking: {
    ar: 'مراجعة أذونات الجهاز وإزالة أدوات التتبع المشبوهة.',
    en: 'Audit device permissions and remove suspicious tracking tools.',
  },
  harmful_challenges: {
    ar: 'عزل منصات التحريض وتطبيق متابعة يومية قصيرة المدى.',
    en: 'Isolate incitement channels and run short-cycle daily monitoring.',
  },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampScore = (value: number) => clamp(Math.round(value), 0, 100);

const normalizeScenarioScores = (
  rawScores: Partial<Record<PsychScenarioId, number>>
): Record<PsychScenarioId, number> => {
  const result = Object.fromEntries(SCENARIOS.map((scenario) => [scenario, 0])) as Record<
    PsychScenarioId,
    number
  >;
  const maxValue = Math.max(1, ...SCENARIOS.map((scenario) => rawScores[scenario] || 0));
  SCENARIOS.forEach((scenario) => {
    result[scenario] = ((rawScores[scenario] || 0) / maxValue) * 100;
  });
  return result;
};

const deriveTrend = (escalationIndex: number): ForecastTrend => {
  if (escalationIndex >= 0.62) return 'rising';
  if (escalationIndex <= 0.42) return 'cooling';
  return 'stable';
};

const trendLabel = (trend: ForecastTrend, lang: 'ar' | 'en') => {
  if (lang === 'ar') {
    if (trend === 'rising') return 'اتجاه تصاعدي';
    if (trend === 'cooling') return 'اتجاه هابط';
    return 'اتجاه مستقر';
  }
  if (trend === 'rising') return 'Rising trend';
  if (trend === 'cooling') return 'Cooling trend';
  return 'Stable trend';
};

const buildExplanation = (
  scenarioId: PsychScenarioId,
  horizonDays: 7 | 30,
  trend: ForecastTrend,
  confidence: number,
  drivers: string[],
  lang: 'ar' | 'en'
) => {
  const scenarioLabel = scenarioLabelMap[scenarioId];
  const topDrivers = drivers.slice(0, 2).join(lang === 'ar' ? '، ' : ', ');
  if (lang === 'ar') {
    return `توقع ${horizonDays} يوم لـ ${scenarioLabel.ar}: ${trendLabel(
      trend,
      'ar'
    )} بثقة ${confidence}%. الدوافع الأقوى: ${topDrivers || 'إشارات سياق متراكمة'}.`;
  }
  return `${horizonDays}-day forecast for ${scenarioLabel.en}: ${trendLabel(
    trend,
    'en'
  )} with ${confidence}% confidence. Strongest drivers: ${topDrivers || 'stacked context signals'}.`;
};

const computeProfilePressure = (profile?: PsychologicalProfile): number => {
  if (!profile) return 32;
  const anxiety = clamp(profile.anxietyLevel || 0, 0, 100);
  const isolation = clamp(profile.isolationRisk || 0, 0, 100);
  const moodInverse = 100 - clamp(profile.moodScore || 0, 0, 100);
  return clampScore(anxiety * 0.4 + isolation * 0.35 + moodInverse * 0.25);
};

const predictionForWindow = (
  horizonDays: 7 | 30,
  scenarioId: PsychScenarioId,
  baseScore: number,
  contextScore: number,
  fusionScore: number,
  profilePressure: number,
  context: PsychConversationContextAnalysis,
  sourceCount: number,
  sourceDepth: number,
  diagnosisConfidence: number,
  keyDrivers: string[]
): PsychScenarioForecast => {
  const trend = deriveTrend(context.temporal.escalationIndex);
  const horizonFactor = horizonDays === 7 ? 1.04 : 0.92;
  const persistenceBoost =
    horizonDays === 30 ? context.temporal.pressureIndex * 12 : context.temporal.recencyWeight * 10;
  const sourceDiversityBoost = Math.min(12, sourceCount * 1.8 + sourceDepth * 0.05);
  const blendedScore =
    baseScore * 0.34 +
    contextScore * 0.24 +
    fusionScore * 0.3 +
    profilePressure * 0.12 +
    sourceDiversityBoost +
    persistenceBoost;
  const riskScore = clampScore(blendedScore * horizonFactor);
  const probability = clampScore(riskScore * 0.82 + context.temporal.recencyWeight * 10 + sourceDiversityBoost);
  const confidence = clampScore(
    42 +
      diagnosisConfidence * 0.26 +
      keyDrivers.length * 7 +
      context.analyzedMessages * 1.4 +
      sourceCount * 3.5 +
      context.temporal.pressureIndex * 16
  );

  return {
    scenarioId,
    scenarioLabelAr: scenarioLabelMap[scenarioId].ar,
    scenarioLabelEn: scenarioLabelMap[scenarioId].en,
    riskScore,
    probability,
    confidence,
    trend,
    keyDrivers,
    recommendationAr: recommendationMap[scenarioId].ar,
    recommendationEn: recommendationMap[scenarioId].en,
    explanationAr: buildExplanation(scenarioId, horizonDays, trend, confidence, keyDrivers, 'ar'),
    explanationEn: buildExplanation(scenarioId, horizonDays, trend, confidence, keyDrivers, 'en'),
  };
};

export const buildPsychRiskForecast = (input: PsychForecastInput): PsychRiskForecastResult => {
  const alerts = input.alerts || [];
  const signalEvents = input.signalEvents || [];
  const context = analyzePsychConversationContext(alerts);
  const signalFusion = buildUnifiedPsychSignals({
    child: input.child,
    alerts,
    signalEvents,
  });
  const hasAnySignal =
    alerts.length > 0 || signalEvents.length > 0 || signalFusion.events.length > 0 || !!input.profile;
  if (!hasAnySignal) {
    return {
      childName: input.childName,
      context,
      signalFusion,
      sevenDay: {
        horizonDays: 7,
        generatedAt: new Date(),
        topPredictions: [],
      },
      thirtyDay: {
        horizonDays: 30,
        generatedAt: new Date(),
        topPredictions: [],
      },
    };
  }
  const diagnosisScores = normalizeScenarioScores(input.diagnosis?.scoreByScenario || {});
  const contextScores = normalizeScenarioScores(context.scenarioSignalScore || {});
  const fusionScores = normalizeScenarioScores(signalFusion.scenarioScore || {});
  const profilePressure = computeProfilePressure(input.profile);
  const diagnosisConfidence = input.diagnosis?.confidence || 0;

  const driverMap = new Map<PsychScenarioId, string[]>();
  SCENARIOS.forEach((scenario) => {
    const contextDrivers = context.patternSignals
      .filter((signal) => signal.scenarioId === scenario)
      .slice(0, 3)
      .map((signal) => `${signal.labelEn} (${signal.hits})`);
    const fusionDrivers = signalFusion.events
      .filter((event) => event.scenarioHints.includes(scenario))
      .slice(0, 2)
      .map((event) => event.driverLabelEn);
    const trajectoryDrivers = signalFusion.trajectories
      .filter((trajectory) => trajectory.scenarioHints.includes(scenario))
      .slice(0, 2)
      .map((trajectory) => trajectory.titleEn);
    const drivers = Array.from(
      new Set([...contextDrivers, ...fusionDrivers, ...trajectoryDrivers])
    ).slice(0, 4);
    if (drivers.length === 0 && context.repeatedTerms.length > 0) {
      const repeated = context.repeatedTerms.slice(0, 2).map((term) => `repeat:${term.term}x${term.count}`);
      driverMap.set(scenario, repeated);
    } else if (drivers.length === 0 && signalFusion.topDriversEn.length > 0) {
      driverMap.set(scenario, signalFusion.topDriversEn.slice(0, 2));
    } else {
      driverMap.set(scenario, drivers);
    }
  });

  const sevenDayPredictions = SCENARIOS.map((scenarioId) =>
    predictionForWindow(
      7,
      scenarioId,
      diagnosisScores[scenarioId],
      contextScores[scenarioId],
      fusionScores[scenarioId],
      profilePressure,
      context,
      signalFusion.sourceCoverage.sourceCount,
      signalFusion.sourceCoverage.depthScore,
      diagnosisConfidence,
      driverMap.get(scenarioId) || []
    )
  )
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);

  const thirtyDayPredictions = SCENARIOS.map((scenarioId) =>
    predictionForWindow(
      30,
      scenarioId,
      diagnosisScores[scenarioId],
      contextScores[scenarioId],
      fusionScores[scenarioId],
      profilePressure,
      context,
      signalFusion.sourceCoverage.sourceCount,
      signalFusion.sourceCoverage.depthScore,
      diagnosisConfidence,
      driverMap.get(scenarioId) || []
    )
  )
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);

  return {
    childName: input.childName,
    context,
    signalFusion,
    sevenDay: {
      horizonDays: 7,
      generatedAt: new Date(),
      topPredictions: sevenDayPredictions,
    },
    thirtyDay: {
      horizonDays: 30,
      generatedAt: new Date(),
      topPredictions: thirtyDayPredictions,
    },
  };
};
