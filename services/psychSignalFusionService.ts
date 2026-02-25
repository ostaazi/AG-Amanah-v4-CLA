import {
  AlertSeverity,
  Category,
  Child,
  ChildSignalEvent,
  ChildSignalEventType,
  MonitoringAlert,
} from '../types';
import type { PsychScenarioId } from './psychDiagnosticService';

export type PsychSignalSource =
  | 'conversation_text'
  | 'visual_detection'
  | 'web_link'
  | 'dns_network'
  | 'location_risk'
  | 'app_behavior'
  | 'psych_profile'
  | 'activity_pattern';

export interface UnifiedPsychSignalEvent {
  id: string;
  source: PsychSignalSource;
  scenarioHints: PsychScenarioId[];
  severity: AlertSeverity;
  score: number;
  timestamp: number;
  evidence: string;
  driverLabelAr: string;
  driverLabelEn: string;
}

export interface PsychSignalCoverage {
  counts: Record<PsychSignalSource, number>;
  sourceCount: number;
  depthScore: number;
}

export interface PsychSignalTrajectory {
  id: string;
  titleAr: string;
  titleEn: string;
  stage: 'watch' | 'escalating' | 'critical';
  riskScore: number;
  confidence: number;
  scenarioHints: PsychScenarioId[];
  primarySources: PsychSignalSource[];
  evidenceKey: string;
  explanationAr: string;
  explanationEn: string;
}

export interface PsychSignalFusionResult {
  events: UnifiedPsychSignalEvent[];
  scenarioScore: Record<PsychScenarioId, number>;
  sourceCoverage: PsychSignalCoverage;
  trajectories: PsychSignalTrajectory[];
  topDriversAr: string[];
  topDriversEn: string[];
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

const severityWeight: Record<AlertSeverity, number> = {
  [AlertSeverity.LOW]: 1,
  [AlertSeverity.MEDIUM]: 1.8,
  [AlertSeverity.HIGH]: 2.8,
  [AlertSeverity.CRITICAL]: 4.2,
};

const normalize = (value?: string) =>
  (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const likelyLink = (text: string): boolean =>
  /(https?:\/\/|www\.|t\.me\/|bit\.ly|tinyurl|discord\.gg|[a-z0-9-]+\.(com|net|org|io|me|app|ai|co))/i.test(
    text
  );

const extractDomainCandidate = (text: string): string => {
  const match = (text || '').match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/i);
  return match?.[0]?.toLowerCase() || '';
};

const recencyFactor = (timestamp: number): number => {
  const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
  if (ageHours <= 6) return 1.3;
  if (ageHours <= 24) return 1.18;
  if (ageHours <= 72) return 1.08;
  if (ageHours <= 7 * 24) return 0.95;
  return 0.78;
};

const signalEventSourceMap: Record<ChildSignalEventType, PsychSignalSource> = {
  search_intent: 'web_link',
  watch_intent: 'visual_detection',
  audio_transcript: 'conversation_text',
  link_intent: 'web_link',
  conversation_pattern: 'conversation_text',
  behavioral_drift: 'activity_pattern',
};

const signalDriverLabelMap: Record<ChildSignalEventType, { ar: string; en: string }> = {
  search_intent: {
    ar: 'نية بحث متكرر عالي الحساسية',
    en: 'Repeated high-sensitivity search intent',
  },
  watch_intent: {
    ar: 'نمط مشاهدة يتطلب متابعة',
    en: 'Watch pattern requiring follow-up',
  },
  audio_transcript: {
    ar: 'إشارات صوتية/نصية من الحوار',
    en: 'Audio/text conversational signal',
  },
  link_intent: {
    ar: 'نية فتح روابط/دومينات',
    en: 'Link/domain opening intent',
  },
  conversation_pattern: {
    ar: 'نمط حوار مقلق',
    en: 'Concerning conversation pattern',
  },
  behavioral_drift: {
    ar: 'انحراف سلوكي زمني',
    en: 'Temporal behavioral drift',
  },
};

const locationAddressScenarioHints = (addressNorm: string): PsychScenarioId[] => {
  const hints = new Set<PsychScenarioId>();
  if (/(casino|gambl|bet|poker|قمار|مراهن|كازينو)/.test(addressNorm)) {
    hints.add('gambling_betting');
    hints.add('crypto_scams');
  }
  if (/(night.?club|bar|pub|adult|ملهى|بار|للبالغين)/.test(addressNorm)) {
    hints.add('inappropriate_content');
    hints.add('sexual_exploitation');
  }
  if (/(weapon|gun|knife|ammo|range|سلاح|ذخيرة|رماية)/.test(addressNorm)) {
    hints.add('harmful_challenges');
    hints.add('threat_exposure');
  }
  return Array.from(hints);
};

const coerceScenarioHints = (hints: unknown): PsychScenarioId[] => {
  const input = Array.isArray(hints) ? hints : [];
  const scenarioSet = new Set<PsychScenarioId>();
  input.forEach((value) => {
    const norm = String(value || '')
      .trim()
      .toLowerCase() as PsychScenarioId;
    if ((SCENARIOS as string[]).includes(norm)) {
      scenarioSet.add(norm);
    }
  });
  return Array.from(scenarioSet);
};

interface SignalWindowStats {
  h1: number;
  h6: number;
  h24: number;
  acceleration: number;
  burstRatio: number;
}

const SIGNAL_EVENT_TYPES: ChildSignalEventType[] = [
  'search_intent',
  'watch_intent',
  'audio_transcript',
  'link_intent',
  'conversation_pattern',
  'behavioral_drift',
];

const signalDefaultScenarioHints: Record<ChildSignalEventType, PsychScenarioId[]> = {
  search_intent: ['phishing_links', 'inappropriate_content'],
  watch_intent: ['inappropriate_content', 'harmful_challenges'],
  audio_transcript: ['bullying', 'threat_exposure'],
  link_intent: ['phishing_links', 'account_theft_fraud'],
  conversation_pattern: ['threat_exposure', 'sexual_exploitation'],
  behavioral_drift: ['gaming', 'self_harm', 'bullying'],
};

const buildSignalWindowStats = (
  signalEvents: ChildSignalEvent[],
  nowMs: number
): Record<ChildSignalEventType, SignalWindowStats> => {
  const windows = Object.fromEntries(
    SIGNAL_EVENT_TYPES.map((type) => [
      type,
      { h1: 0, h6: 0, h24: 0, acceleration: 0, burstRatio: 0 } as SignalWindowStats,
    ])
  ) as Record<ChildSignalEventType, SignalWindowStats>;

  signalEvents.forEach((event) => {
    const type = event.eventType as ChildSignalEventType;
    if (!SIGNAL_EVENT_TYPES.includes(type)) return;
    const timestamp = normalizeTimestamp(event.timestamp);
    const ageHours = (nowMs - timestamp) / (1000 * 60 * 60);
    if (ageHours < 0 || ageHours > 24) return;
    if (ageHours <= 24) windows[type].h24 += 1;
    if (ageHours <= 6) windows[type].h6 += 1;
    if (ageHours <= 1) windows[type].h1 += 1;
  });

  SIGNAL_EVENT_TYPES.forEach((type) => {
    const stats = windows[type];
    stats.acceleration = stats.h24 > 0 ? stats.h6 / stats.h24 : 0;
    stats.burstRatio = stats.h6 > 0 ? stats.h1 / stats.h6 : 0;
  });
  return windows;
};

const resolveSignalBurstBoost = (eventType: ChildSignalEventType, stats: SignalWindowStats): number => {
  let boost = 1;
  if (stats.h1 >= 6) boost += 0.34;
  else if (stats.h6 >= 8) boost += 0.24;
  else if (stats.h24 >= 18) boost += 0.14;

  if (stats.h24 >= 6 && stats.acceleration >= 0.55) boost += 0.12;
  if (stats.h6 >= 3 && stats.burstRatio >= 0.5) boost += 0.08;

  if (eventType === 'link_intent' || eventType === 'conversation_pattern') {
    boost += 0.06;
  }

  return Math.max(1, Math.min(1.7, boost));
};

const resolveBurstSeverity = (eventType: ChildSignalEventType, stats: SignalWindowStats): AlertSeverity => {
  if (
    (eventType === 'link_intent' && (stats.h1 >= 6 || stats.h6 >= 12)) ||
    (eventType === 'conversation_pattern' && stats.h6 >= 10)
  ) {
    return AlertSeverity.CRITICAL;
  }
  if (stats.h6 >= 6 || (stats.h24 >= 12 && stats.acceleration >= 0.55)) return AlertSeverity.HIGH;
  if (stats.h24 >= 8 || stats.h6 >= 3) return AlertSeverity.MEDIUM;
  return AlertSeverity.LOW;
};

const shouldEmitBurstSummary = (stats: SignalWindowStats): boolean =>
  stats.h6 >= 6 || stats.h24 >= 16 || (stats.h24 >= 8 && stats.acceleration >= 0.55);

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const stageFromRisk = (riskScore: number): 'watch' | 'escalating' | 'critical' => {
  if (riskScore >= 78) return 'critical';
  if (riskScore >= 52) return 'escalating';
  return 'watch';
};

const stageToConfidenceBase = (stage: 'watch' | 'escalating' | 'critical'): number => {
  if (stage === 'critical') return 74;
  if (stage === 'escalating') return 62;
  return 48;
};

const buildTrajectoryExplanations = (params: {
  titleAr: string;
  titleEn: string;
  stage: 'watch' | 'escalating' | 'critical';
  riskScore: number;
  confidence: number;
  evidenceKey: string;
}): { ar: string; en: string } => {
  const stageAr =
    params.stage === 'critical'
      ? 'مرحلة حرجة'
      : params.stage === 'escalating'
        ? 'مرحلة تصاعد'
        : 'مرحلة رصد';
  const stageEn =
    params.stage === 'critical'
      ? 'Critical stage'
      : params.stage === 'escalating'
        ? 'Escalating stage'
        : 'Watch stage';
  return {
    ar: `${params.titleAr} | ${stageAr} | risk=${params.riskScore}% | conf=${params.confidence}% | ${params.evidenceKey}`,
    en: `${params.titleEn} | ${stageEn} | risk=${params.riskScore}% | conf=${params.confidence}% | ${params.evidenceKey}`,
  };
};

const categoryScenarioHints = (category: Category): PsychScenarioId[] => {
  const key = String(category || '');
  if (key === Category.BULLYING) return ['bullying', 'threat_exposure'];
  if (key === Category.SELF_HARM) return ['self_harm', 'harmful_challenges'];
  if (key === Category.ADULT_CONTENT) return ['inappropriate_content', 'sexual_exploitation'];
  if (key === Category.SCAM) return ['crypto_scams', 'phishing_links', 'account_theft_fraud'];
  if (key === Category.PREDATOR) return ['sexual_exploitation', 'threat_exposure'];
  if (key === Category.VIOLENCE) return ['harmful_challenges', 'threat_exposure'];
  if (key === Category.BLACKMAIL) return ['threat_exposure', 'sexual_exploitation'];
  if (key === Category.SEXUAL_EXPLOITATION) return ['sexual_exploitation', 'threat_exposure'];
  if (key === Category.PHISHING_LINK) return ['phishing_links', 'account_theft_fraud'];
  if (key === Category.TAMPER) return ['cyber_crime', 'account_theft_fraud'];
  return [];
};

const keywordScenarioHints = (textNorm: string): PsychScenarioId[] => {
  const hints = new Set<PsychScenarioId>();
  if (/(bully|harass|loser|worthless|تنمر|إهانة|سخرية)/.test(textNorm)) hints.add('bullying');
  if (/(threat|blackmail|or else|ابتزاز|تهديد|ادفع)/.test(textNorm)) hints.add('threat_exposure');
  if (/(suicide|kill myself|cut|انتحار|إيذاء النفس)/.test(textNorm)) hints.add('self_harm');
  if (/(nude|porn|adult|صور خاصة|إباحية)/.test(textNorm)) hints.add('inappropriate_content');
  if (/(meet alone|تعال وحدك|secret|لا تخبر)/.test(textNorm)) hints.add('sexual_exploitation');
  if (/(otp|verify account|login now|رمز التحقق|صفحة تسجيل)/.test(textNorm)) hints.add('phishing_links');
  if (/(wallet|crypto|gift card|bitcoin|تحويل|محفظة)/.test(textNorm)) hints.add('crypto_scams');
  if (/(tracking|spy|stalker|تتبع|تجسس)/.test(textNorm)) hints.add('privacy_tracking');
  if (/(challenge|weapon|knife|تحريض|تحدي خطير|سلاح)/.test(textNorm)) hints.add('harmful_challenges');
  if (/(hack|exploit|ddos|اختراق|تهكير)/.test(textNorm)) hints.add('cyber_crime');
  if (/(gambl|bet|casino|قمار|مراهنة)/.test(textNorm)) hints.add('gambling_betting');
  if (/(stolen account|credential|reset code|سرقة حساب)/.test(textNorm))
    hints.add('account_theft_fraud');
  if (/(game|gaming|roblox|pubg|fortnite|discord)/.test(textNorm)) hints.add('gaming');
  return Array.from(hints);
};

const normalizeTimestamp = (value: unknown): number => {
  const ts = new Date(value as any).getTime();
  return Number.isFinite(ts) ? ts : Date.now();
};

const scenarioScoreSeed = (): Record<PsychScenarioId, number> =>
  Object.fromEntries(SCENARIOS.map((scenario) => [scenario, 0])) as Record<PsychScenarioId, number>;

const pushScoredEvent = (
  bucket: UnifiedPsychSignalEvent[],
  scenarioScore: Record<PsychScenarioId, number>,
  event: UnifiedPsychSignalEvent
) => {
  bucket.push(event);
  event.scenarioHints.forEach((scenario) => {
    scenarioScore[scenario] += event.score;
  });
};

const buildSignalTrajectories = (
  signalWindows: Record<ChildSignalEventType, SignalWindowStats>,
  events: UnifiedPsychSignalEvent[],
  nowMs: number
): PsychSignalTrajectory[] => {
  const trajectories: PsychSignalTrajectory[] = [];
  const h24Ms = 24 * 60 * 60 * 1000;
  const recentEvents = events.filter((event) => nowMs - event.timestamp <= h24Ms);
  const dnsRecentCount = recentEvents.filter((event) => event.source === 'dns_network').length;

  const pushTrajectory = (row: Omit<PsychSignalTrajectory, 'explanationAr' | 'explanationEn'>) => {
    const explanations = buildTrajectoryExplanations({
      titleAr: row.titleAr,
      titleEn: row.titleEn,
      stage: row.stage,
      riskScore: row.riskScore,
      confidence: row.confidence,
      evidenceKey: row.evidenceKey,
    });
    trajectories.push({
      ...row,
      explanationAr: explanations.ar,
      explanationEn: explanations.en,
    });
  };

  const search = signalWindows.search_intent;
  const link = signalWindows.link_intent;
  const searchLinkIntensity =
    search.h1 * 1.2 +
    search.h6 * 1.1 +
    link.h1 * 1.6 +
    link.h6 * 1.9 +
    (search.acceleration + link.acceleration) * 7;
  if (search.h6 >= 3 && link.h6 >= 3) {
    const riskScore = clampScore(24 + searchLinkIntensity * 2.6 + Math.max(0, dnsRecentCount - 1) * 4);
    const stage = stageFromRisk(riskScore);
    const confidence = clampScore(
      stageToConfidenceBase(stage) + Math.min(24, search.h24 + link.h24) + Math.min(8, dnsRecentCount * 2)
    );
    pushTrajectory({
      id: 'traj-search-link-escalation',
      titleAr: 'مسار تصاعد بحث ثم روابط',
      titleEn: 'Search-to-Link Escalation',
      stage,
      riskScore,
      confidence,
      scenarioHints: ['phishing_links', 'account_theft_fraud', 'cyber_crime'],
      primarySources: dnsRecentCount > 0 ? ['web_link', 'dns_network'] : ['web_link'],
      evidenceKey: `s6=${search.h6},l6=${link.h6},dns24=${dnsRecentCount}`,
    });
  }

  const audio = signalWindows.audio_transcript;
  const convo = signalWindows.conversation_pattern;
  const watch = signalWindows.watch_intent;
  const convoWatchIntensity =
    (audio.h6 + convo.h6) * 1.5 +
    watch.h6 * 1.2 +
    (audio.burstRatio + convo.burstRatio + watch.burstRatio) * 5;
  if ((audio.h6 + convo.h6) >= 4 && watch.h6 >= 2) {
    const riskScore = clampScore(18 + convoWatchIntensity * 3.1);
    const stage = stageFromRisk(riskScore);
    const confidence = clampScore(stageToConfidenceBase(stage) + Math.min(26, audio.h24 + convo.h24 + watch.h24));
    pushTrajectory({
      id: 'traj-conversation-watch-pressure',
      titleAr: 'مسار ضغط حواري/مرئي متداخل',
      titleEn: 'Conversation-Visual Pressure Path',
      stage,
      riskScore,
      confidence,
      scenarioHints: ['threat_exposure', 'sexual_exploitation', 'bullying'],
      primarySources: ['conversation_text', 'visual_detection'],
      evidenceKey: `a6=${audio.h6},c6=${convo.h6},w6=${watch.h6}`,
    });
  }

  const drift = signalWindows.behavioral_drift;
  const driftIntensity =
    drift.h6 * 1.8 +
    drift.h24 * 1.1 +
    (watch.h24 + search.h24) * 0.55 +
    drift.acceleration * 8;
  if (drift.h24 >= 4 && (watch.h24 >= 4 || search.h24 >= 4)) {
    const riskScore = clampScore(16 + driftIntensity * 2.7);
    const stage = stageFromRisk(riskScore);
    const confidence = clampScore(stageToConfidenceBase(stage) + Math.min(22, drift.h24 + watch.h24 + search.h24));
    pushTrajectory({
      id: 'traj-behavioral-spiral',
      titleAr: 'مسار انحراف سلوكي متراكم',
      titleEn: 'Compounding Behavioral Drift',
      stage,
      riskScore,
      confidence,
      scenarioHints: ['gaming', 'self_harm', 'harmful_challenges'],
      primarySources: ['activity_pattern', 'visual_detection', 'web_link'],
      evidenceKey: `d24=${drift.h24},w24=${watch.h24},s24=${search.h24}`,
    });
  }

  if (dnsRecentCount >= 2 && (link.h6 >= 2 || search.h6 >= 2)) {
    const riskScore = clampScore(36 + dnsRecentCount * 7 + (link.h6 + search.h6) * 2.4);
    const stage = stageFromRisk(riskScore);
    const confidence = clampScore(stageToConfidenceBase(stage) + Math.min(18, dnsRecentCount * 3 + link.h24 + search.h24));
    pushTrajectory({
      id: 'traj-dns-link-attack-surface',
      titleAr: 'مسار هجوم شبكي عبر DNS/روابط',
      titleEn: 'DNS-Link Attack Surface',
      stage,
      riskScore,
      confidence,
      scenarioHints: ['phishing_links', 'account_theft_fraud', 'cyber_crime'],
      primarySources: ['dns_network', 'web_link'],
      evidenceKey: `dns24=${dnsRecentCount},l6=${link.h6},s6=${search.h6}`,
    });
  }

  return trajectories
    .sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      return b.confidence - a.confidence;
    })
    .slice(0, 6);
};

export const buildUnifiedPsychSignals = (input: {
  child?: Child;
  alerts?: MonitoringAlert[];
  signalEvents?: ChildSignalEvent[];
}): PsychSignalFusionResult => {
  const nowMs = Date.now();
  const child = input.child;
  const alerts = input.alerts || [];
  const signalEvents = input.signalEvents || [];
  const signalWindows = buildSignalWindowStats(signalEvents, nowMs);
  const events: UnifiedPsychSignalEvent[] = [];
  const scenarioScore = scenarioScoreSeed();

  alerts.forEach((alert, index) => {
    const raw = alert as MonitoringAlert & Record<string, unknown>;
    const timestamp = normalizeTimestamp(alert.timestamp);
    const textNorm = normalize(`${alert.content || ''} ${alert.aiAnalysis || ''} ${alert.platform || ''}`);
    const categoryHints = categoryScenarioHints(alert.category);
    const keywordHints = keywordScenarioHints(textNorm);
    const scenarioHints = Array.from(new Set([...categoryHints, ...keywordHints]));
    const severity = alert.severity || AlertSeverity.LOW;
    const confidenceFactor = Number.isFinite(Number(alert.confidence))
      ? Math.max(0.4, Math.min(1.3, Number(alert.confidence) / 100))
      : 1;
    const scoreBase = severityWeight[severity] * recencyFactor(timestamp) * confidenceFactor;
    const evidence = (alert.content || alert.aiAnalysis || '').slice(0, 220);

    const isVisual =
      !!alert.imageData ||
      /visual|injury|blood|nsfw|scene|screenshot|screen monitor|لقطة|بصري|دم|إصابات/i.test(
        `${alert.aiAnalysis || ''} ${alert.content || ''}`
      );
    const triggerType = String(raw.triggerType || '').toUpperCase();
    const dnsMode = String(raw.dnsMode || '').toLowerCase();
    const dnsDomain = String(raw.triggerDomain || extractDomainCandidate(textNorm));
    const isDnsSignal =
      triggerType === 'DNS' ||
      dnsMode === 'sandbox' ||
      /dns filter|dns sandbox|dns-level/i.test(`${alert.platform || ''} ${alert.aiAnalysis || ''}`);
    const isLinkSignal = !isDnsSignal && (alert.category === Category.PHISHING_LINK || likelyLink(textNorm));
    const isConversationSignal =
      /telegram|whatsapp|discord|messenger|chat|dm|screen ocr|sms|message|محادثة|رسالة/i.test(
        `${alert.platform || ''} ${textNorm}`
      ) || !!alert.content;

    if (isConversationSignal && scenarioHints.length > 0) {
      pushScoredEvent(events, scenarioScore, {
        id: `sig-chat-${alert.id || index}`,
        source: 'conversation_text',
        scenarioHints,
        severity,
        score: scoreBase * 0.95,
        timestamp,
        evidence,
        driverLabelAr: 'سياق محادثة متكرر',
        driverLabelEn: 'Repeated conversation context',
      });
    }

    if (isVisual && scenarioHints.length > 0) {
      pushScoredEvent(events, scenarioScore, {
        id: `sig-visual-${alert.id || index}`,
        source: 'visual_detection',
        scenarioHints,
        severity,
        score: scoreBase * 1.05,
        timestamp,
        evidence,
        driverLabelAr: 'إشارات بصرية عالية الحساسية',
        driverLabelEn: 'High-sensitivity visual indicators',
      });
    }

    if (isLinkSignal) {
      const linkHints = scenarioHints.length > 0 ? scenarioHints : ['phishing_links', 'account_theft_fraud'];
      pushScoredEvent(events, scenarioScore, {
        id: `sig-link-${alert.id || index}`,
        source: 'web_link',
        scenarioHints: linkHints,
        severity,
        score: scoreBase * 1.1,
        timestamp,
        evidence,
        driverLabelAr: 'روابط/دومينات مشبوهة',
        driverLabelEn: 'Suspicious links/domains',
      });
    }

    if (isDnsSignal) {
      const decisionScoreRaw = Number(raw.decisionScore);
      const decisionScore = Number.isFinite(decisionScoreRaw)
        ? Math.max(0, Math.min(100, decisionScoreRaw))
        : 0;
      const domainNorm = normalize(dnsDomain);
      const dnsKeywordHints = keywordScenarioHints(`${domainNorm} ${textNorm}`);
      const dnsHints =
        scenarioHints.length > 0
          ? Array.from(new Set([...scenarioHints, ...dnsKeywordHints]))
          : Array.from(
              new Set<PsychScenarioId>([
                'phishing_links',
                'account_theft_fraud',
                'cyber_crime',
                ...dnsKeywordHints,
              ])
            );
      const dnsScoreMultiplier = dnsMode === 'sandbox' ? 1.22 : 1.06;
      const decisionBoost = 1 + Math.min(0.4, decisionScore / 250);
      pushScoredEvent(events, scenarioScore, {
        id: `sig-dns-${alert.id || index}`,
        source: 'dns_network',
        scenarioHints: dnsHints,
        severity,
        score: scoreBase * dnsScoreMultiplier * decisionBoost,
        timestamp,
        evidence: `${dnsDomain || extractDomainCandidate(evidence)} (${dnsMode || 'policy'})`.slice(0, 220),
        driverLabelAr:
          dnsMode === 'sandbox'
            ? 'محرك DNS Sandbox حجب دومين مشبوه'
            : 'محرك DNS Policy حجب محاولة دومين',
        driverLabelEn:
          dnsMode === 'sandbox'
            ? 'DNS sandbox auto-blocked suspicious domain'
            : 'DNS policy blocked domain attempt',
      });
    }
  });

  signalEvents.forEach((event, index) => {
    const eventType = event.eventType as ChildSignalEventType;
    const source = signalEventSourceMap[eventType];
    if (!source) return;
    const stats = signalWindows[eventType];

    const timestamp = normalizeTimestamp(event.timestamp);
    const eventTextNorm = normalize(
      `${event.content || ''} ${event.normalizedContent || ''} ${event.platform || ''} ${event.source || ''}`
    );
    const explicitHints = coerceScenarioHints(event.scenarioHints);
    const keywordHints = keywordScenarioHints(eventTextNorm);
    const defaultHints = signalDefaultScenarioHints[eventType] || [];
    const scenarioHints = Array.from(new Set([...defaultHints, ...explicitHints, ...keywordHints]));
    if (scenarioHints.length === 0) return;

    const severity = event.severity || AlertSeverity.MEDIUM;
    const confidenceFactor = Number.isFinite(Number(event.confidence))
      ? Math.max(0.4, Math.min(1.35, Number(event.confidence) / 100))
      : 0.95;
    const scoreBase = severityWeight[severity] * recencyFactor(timestamp) * confidenceFactor;
    const burstBoost = resolveSignalBurstBoost(eventType, stats);
    const labels = signalDriverLabelMap[eventType];
    pushScoredEvent(events, scenarioScore, {
      id: event.id || `sig-event-${index}`,
      source,
      scenarioHints,
      severity,
      score: scoreBase * burstBoost,
      timestamp,
      evidence: (event.content || event.normalizedContent || '').slice(0, 220),
      driverLabelAr: labels.ar,
      driverLabelEn: labels.en,
    });
  });

  SIGNAL_EVENT_TYPES.forEach((eventType) => {
    const stats = signalWindows[eventType];
    if (!shouldEmitBurstSummary(stats)) return;
    const source = signalEventSourceMap[eventType];
    const severity = resolveBurstSeverity(eventType, stats);
    const burstBoost = resolveSignalBurstBoost(eventType, stats);
    const scenarioHints = signalDefaultScenarioHints[eventType];
    pushScoredEvent(events, scenarioScore, {
      id: `sig-burst-${eventType}`,
      source,
      scenarioHints,
      severity,
      score: severityWeight[severity] * (1.4 + Math.min(2.3, (stats.h6 * 0.15) + (stats.h24 * 0.06))) * burstBoost,
      timestamp: nowMs,
      evidence: `burst(h1=${stats.h1},h6=${stats.h6},h24=${stats.h24},acc=${stats.acceleration.toFixed(2)})`,
      driverLabelAr: `تصاعد ${eventType} خلال نافذة زمنية قصيرة`,
      driverLabelEn: `${eventType} burst escalation in short time window`,
    });
  });

  const searchStats = signalWindows.search_intent;
  const linkStats = signalWindows.link_intent;
  if (searchStats.h6 >= 3 && linkStats.h6 >= 3) {
    pushScoredEvent(events, scenarioScore, {
      id: 'sig-chain-search-link',
      source: 'web_link',
      scenarioHints: ['phishing_links', 'account_theft_fraud', 'cyber_crime'],
      severity: searchStats.h6 + linkStats.h6 >= 10 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      score: 4.6 + Math.min(5.5, (searchStats.h6 + linkStats.h6) * 0.52),
      timestamp: nowMs,
      evidence: `chain(search6h=${searchStats.h6},link6h=${linkStats.h6})`,
      driverLabelAr: 'سلسلة بحث ثم فتح روابط بنمط متسارع',
      driverLabelEn: 'Escalating search-to-link chain pattern',
    });
  }

  const appUsage = child?.appUsage || [];
  appUsage.forEach((app, index) => {
    const usage = Number(app.minutesUsed || 0);
    if (usage < 40) return;
    const appNameNorm = normalize(app.appName);
    const hints = keywordScenarioHints(appNameNorm);
    if (hints.length === 0 && usage < 120) return;
    const scenarioHints = hints.length > 0 ? hints : ['gaming'];
    const intensity = usage >= 240 ? AlertSeverity.HIGH : usage >= 120 ? AlertSeverity.MEDIUM : AlertSeverity.LOW;
    pushScoredEvent(events, scenarioScore, {
      id: `sig-app-${app.id || index}`,
      source: 'app_behavior',
      scenarioHints,
      severity: intensity,
      score: (usage / 60) * severityWeight[intensity] * 0.55,
      timestamp: Date.now(),
      evidence: `${app.appName} (${usage}m)`,
      driverLabelAr: 'نمط استخدام تطبيقات عالي الكثافة',
      driverLabelEn: 'High-intensity app usage pattern',
    });
  });

  const location = child?.location;
  if (location) {
    const locationTimestamp = normalizeTimestamp(location.lastUpdated);
    const locationAgeHours = (Date.now() - locationTimestamp) / (1000 * 60 * 60);
    const locationAddressNorm = normalize(location.address);
    const locationHints = locationAddressScenarioHints(locationAddressNorm);

    if (locationHints.length > 0) {
      pushScoredEvent(events, scenarioScore, {
        id: `sig-location-keyword-${child?.id || 'child'}`,
        source: 'location_risk',
        scenarioHints: locationHints,
        severity: locationHints.length >= 2 ? AlertSeverity.MEDIUM : AlertSeverity.LOW,
        score: locationHints.length >= 2 ? 3.8 : 2.6,
        timestamp: locationTimestamp,
        evidence: `${location.address || 'location'} (${location.lat},${location.lng})`.slice(0, 220),
        driverLabelAr: 'سياق موقع عالي الحساسية',
        driverLabelEn: 'Sensitive location context',
      });
    }

    if (child?.status === 'online' && locationAgeHours >= 12) {
      pushScoredEvent(events, scenarioScore, {
        id: `sig-location-stale-${child?.id || 'child'}`,
        source: 'location_risk',
        scenarioHints: ['privacy_tracking', 'threat_exposure'],
        severity: locationAgeHours >= 24 ? AlertSeverity.MEDIUM : AlertSeverity.LOW,
        score: locationAgeHours >= 24 ? 4.2 : 2.4,
        timestamp: Date.now(),
        evidence: `lastLocationUpdateHours=${locationAgeHours.toFixed(1)}`,
        driverLabelAr: 'تأخر تحديث GPS مع حالة أونلاين',
        driverLabelEn: 'Stale GPS update while device is online',
      });
    }
  }

  const profile = child?.psychProfile;
  if (profile?.riskSignals?.length) {
    profile.riskSignals.slice(0, 12).forEach((signal, index) => {
      const signalText = normalize(`${signal.title || ''} ${signal.reason || ''}`);
      const hints = keywordScenarioHints(signalText);
      const fallback: PsychScenarioId[] = ['threat_exposure'];
      pushScoredEvent(events, scenarioScore, {
        id: `sig-profile-${signal.id || index}`,
        source: 'psych_profile',
        scenarioHints: hints.length > 0 ? hints : fallback,
        severity: signal.severity || AlertSeverity.MEDIUM,
        score: severityWeight[signal.severity || AlertSeverity.MEDIUM] * 1.05,
        timestamp: Date.now(),
        evidence: `${signal.title || ''} ${signal.reason || ''}`.slice(0, 220),
        driverLabelAr: 'إشارة من الملف النفسي',
        driverLabelEn: 'Signal from psychological profile',
      });
    });
  }

  if (profile) {
    const screenPressure =
      Number(child?.screenTimeLimit || 0) > 0
        ? Number(child?.currentScreenTime || 0) / Math.max(Number(child?.screenTimeLimit || 1), 1)
        : 0;
    const trendValues = profile.weeklyTrend?.map((point) => Number(point.value || 0)) || [];
    const trendSlope =
      trendValues.length >= 2 ? trendValues[trendValues.length - 1] - trendValues[0] : 0;
    const activitySignal =
      Math.max(0, screenPressure - 1) * 18 +
      Math.max(0, trendSlope) * 0.5 +
      Math.max(0, (profile.anxietyLevel || 0) - 55) * 0.2 +
      Math.max(0, (profile.isolationRisk || 0) - 50) * 0.18;
    if (activitySignal >= 6) {
      pushScoredEvent(events, scenarioScore, {
        id: `sig-activity-${child?.id || 'child'}`,
        source: 'activity_pattern',
        scenarioHints: ['gaming', 'bullying', 'self_harm'],
        severity: activitySignal >= 20 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        score: Math.min(24, activitySignal),
        timestamp: Date.now(),
        evidence: `screenPressure=${screenPressure.toFixed(2)},trendSlope=${trendSlope.toFixed(1)}`,
        driverLabelAr: 'انحراف نمط الاستخدام/المزاج عبر الزمن',
        driverLabelEn: 'Usage/mood temporal drift',
      });
    }
  }

  const counts: Record<PsychSignalSource, number> = {
    conversation_text: 0,
    visual_detection: 0,
    web_link: 0,
    dns_network: 0,
    location_risk: 0,
    app_behavior: 0,
    psych_profile: 0,
    activity_pattern: 0,
  };
  events.forEach((event) => {
    counts[event.source] += 1;
  });
  const sourceCount = Object.values(counts).filter((value) => value > 0).length;
  const totalSources = Object.keys(counts).length || 1;
  const sourceBreadth = (sourceCount / totalSources) * 62;
  const signalDensity = Math.min(38, Math.min(events.length, 55) * 0.69);
  const depthScore = Math.round(
    Math.max(0, Math.min(100, sourceBreadth + signalDensity))
  );

  const topDriversAr = Array.from(new Set(events.map((event) => event.driverLabelAr))).slice(0, 8);
  const topDriversEn = Array.from(new Set(events.map((event) => event.driverLabelEn))).slice(0, 8);
  const trajectories = buildSignalTrajectories(signalWindows, events, nowMs);

  return {
    events: events.sort((a, b) => b.timestamp - a.timestamp),
    scenarioScore,
    sourceCoverage: {
      counts,
      sourceCount,
      depthScore,
    },
    trajectories,
    topDriversAr,
    topDriversEn,
  };
};
