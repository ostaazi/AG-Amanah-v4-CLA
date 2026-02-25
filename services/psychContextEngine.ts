import { AlertSeverity, MonitoringAlert } from '../types';
import type { PsychScenarioId } from './psychDiagnosticService';

export interface ContextRepeatedTerm {
  term: string;
  count: number;
}

export interface ContextPatternSignal {
  id: string;
  scenarioId: PsychScenarioId;
  labelAr: string;
  labelEn: string;
  hits: number;
  score: number;
  evidence: string[];
}

export interface PsychConversationContextAnalysis {
  analyzedMessages: number;
  analyzedAlerts: number;
  repeatedTerms: ContextRepeatedTerm[];
  patternSignals: ContextPatternSignal[];
  scenarioSignalScore: Record<PsychScenarioId, number>;
  temporal: {
    recencyWeight: number;
    escalationIndex: number;
    pressureIndex: number;
  };
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

const SCENARIO_EMPTY_SCORE = (): Record<PsychScenarioId, number> => ({
  bullying: 0,
  threat_exposure: 0,
  gaming: 0,
  inappropriate_content: 0,
  cyber_crime: 0,
  crypto_scams: 0,
  phishing_links: 0,
  self_harm: 0,
  sexual_exploitation: 0,
  account_theft_fraud: 0,
  gambling_betting: 0,
  privacy_tracking: 0,
  harmful_challenges: 0,
});

const severityWeight: Record<AlertSeverity, number> = {
  [AlertSeverity.LOW]: 1,
  [AlertSeverity.MEDIUM]: 1.8,
  [AlertSeverity.HIGH]: 2.8,
  [AlertSeverity.CRITICAL]: 4.2,
};

const riskStopwords = new Set([
  'the',
  'and',
  'for',
  'this',
  'that',
  'with',
  'from',
  'you',
  'your',
  'are',
  'was',
  'were',
  'been',
  'have',
  'has',
  'had',
  'but',
  'not',
  'just',
  'then',
  'they',
  'them',
  'their',
  'على',
  'في',
  'من',
  'الى',
  'إلى',
  'عن',
  'هذا',
  'هذه',
  'ذلك',
  'تلك',
  'مع',
  'تم',
  'هي',
  'هو',
  'كان',
  'كانت',
  'كما',
  'بعد',
  'قبل',
]);

type PatternDef = {
  id: string;
  scenarioId: PsychScenarioId;
  labelAr: string;
  labelEn: string;
  weight: number;
  keywords: string[];
  minHits?: number;
};

const patternDefs: PatternDef[] = [
  {
    id: 'coercive-urgency',
    scenarioId: 'threat_exposure',
    labelAr: 'ضغط وإكراه مع استعجال',
    labelEn: 'Coercive urgency',
    weight: 1.15,
    keywords: ['or else', 'do it now', 'urgent', 'تهديد', 'الآن', 'لا تخبر', 'ابتزاز'],
  },
  {
    id: 'secrecy-isolation',
    scenarioId: 'sexual_exploitation',
    labelAr: 'سرية وعزل عن الأهل',
    labelEn: 'Secrecy and isolation',
    weight: 1.1,
    keywords: ['secret', 'dont tell', 'keep between us', 'احذف الرسالة', 'لا تخبر', 'سر بيننا'],
  },
  {
    id: 'self-harm-intent',
    scenarioId: 'self_harm',
    labelAr: 'مؤشرات إيذاء النفس',
    labelEn: 'Self-harm intent indicators',
    weight: 1.35,
    keywords: ['kill myself', 'cut', 'suicide', 'لا أريد العيش', 'إيذاء النفس', 'انتحار'],
  },
  {
    id: 'offline-meetup-lure',
    scenarioId: 'sexual_exploitation',
    labelAr: 'استدراج للقاء خاص',
    labelEn: 'Private meetup luring',
    weight: 1.05,
    keywords: ['meet alone', 'location', 'send pin', 'تعال وحدك', 'أرسل موقعك', 'لقاء سري'],
  },
  {
    id: 'bullying-repetition',
    scenarioId: 'bullying',
    labelAr: 'تنمر متكرر ومباشر',
    labelEn: 'Repeated direct bullying',
    weight: 1.0,
    keywords: ['loser', 'worthless', 'idiot', 'غبي', 'فاشل', 'سخرية', 'إهانة'],
  },
  {
    id: 'violent-incitement',
    scenarioId: 'harmful_challenges',
    labelAr: 'تحريض على العنف أو تحديات خطرة',
    labelEn: 'Violence incitement or dangerous challenges',
    weight: 1.1,
    keywords: ['hurt', 'stab', 'weapon', 'تحدي خطير', 'أذى', 'تحريض', 'سلاح'],
  },
  {
    id: 'credential-phishing',
    scenarioId: 'phishing_links',
    labelAr: 'محاولة تصيد بيانات الدخول',
    labelEn: 'Credential phishing attempt',
    weight: 1.2,
    keywords: ['otp', 'code', 'verify account', 'login now', 'رمز التحقق', 'تأكيد الحساب'],
  },
  {
    id: 'blackmail-payment',
    scenarioId: 'crypto_scams',
    labelAr: 'ابتزاز مالي أو طلب تحويل',
    labelEn: 'Financial blackmail or transfer request',
    weight: 1.18,
    keywords: ['gift card', 'transfer', 'wallet', 'crypto', 'تحويل', 'محفظة', 'ادفع'],
  },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const normalizeObfuscatedText = (input: string): string => {
  if (!input) return '';
  const leetMap: Record<string, string> = {
    '$': 's',
    '@': 'a',
    '€': 'e',
    '£': 'l',
    '¥': 'y',
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '!': 'i',
    '|': 'i',
  };
  let text = input.normalize('NFKC').toLowerCase();
  text = text.replace(/[\u064B-\u0652\u0670]/g, '');
  text = text.replace(/[ـ]/g, '');
  text = text
    .split('')
    .map((char) => leetMap[char] || char)
    .join('');
  text = text.replace(/([a-z\u0600-\u06ff])[\.\-_~*]+(?=[a-z\u0600-\u06ff])/g, '$1');
  text = text.replace(/[^\p{L}\p{N}\s:/.?=&-]/gu, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

const tokenize = (text: string): string[] => {
  const tokens = text.match(/[\p{L}\p{N}]{2,}/gu) || [];
  return tokens.filter((token) => !riskStopwords.has(token));
};

const normalizeTimestamp = (value: unknown): number => {
  const ts = new Date(value as any).getTime();
  return Number.isFinite(ts) ? ts : Date.now();
};

const recencyFactor = (timestamp: number): number => {
  const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
  if (ageHours <= 6) return 1.35;
  if (ageHours <= 24) return 1.22;
  if (ageHours <= 72) return 1.1;
  if (ageHours <= 7 * 24) return 0.95;
  return 0.78;
};

const countKeywordHits = (text: string, keywords: string[]): number =>
  keywords.reduce((count, keyword) => (text.includes(normalizeObfuscatedText(keyword)) ? count + 1 : count), 0);

export const analyzePsychConversationContext = (
  alerts: MonitoringAlert[]
): PsychConversationContextAnalysis => {
  const scenarioSignalScore = SCENARIO_EMPTY_SCORE();
  if (!alerts?.length) {
    return {
      analyzedMessages: 0,
      analyzedAlerts: 0,
      repeatedTerms: [],
      patternSignals: [],
      scenarioSignalScore,
      temporal: { recencyWeight: 0.6, escalationIndex: 0.5, pressureIndex: 0.2 },
    };
  }

  const timeline = alerts
    .map((alert) => {
      const timestamp = normalizeTimestamp(alert.timestamp);
      const text = normalizeObfuscatedText(
        `${alert.content || ''} ${alert.aiAnalysis || ''} ${alert.platform || ''}`
      );
      const weight = (severityWeight[alert.severity] || 1) * recencyFactor(timestamp);
      return { alert, timestamp, text, weight };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const tokenCounts = new Map<string, number>();
  timeline.forEach((entry) => {
    tokenize(entry.text).forEach((token) => {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    });
  });
  const repeatedTerms = Array.from(tokenCounts.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({ term, count }));

  const patternMap = new Map<string, ContextPatternSignal>();
  for (const def of patternDefs) {
    patternMap.set(def.id, {
      id: def.id,
      scenarioId: def.scenarioId,
      labelAr: def.labelAr,
      labelEn: def.labelEn,
      hits: 0,
      score: 0,
      evidence: [],
    });
  }

  timeline.forEach((entry) => {
    patternDefs.forEach((def) => {
      const hits = countKeywordHits(entry.text, def.keywords);
      if (hits <= 0) return;
      if (def.minHits && hits < def.minHits) return;
      const signal = patternMap.get(def.id);
      if (!signal) return;
      signal.hits += hits;
      signal.score += hits * def.weight * entry.weight;
      if (signal.evidence.length < 4) {
        signal.evidence.push((entry.alert.content || entry.alert.aiAnalysis || '').slice(0, 180));
      }
    });
  });

  const patternSignals = Array.from(patternMap.values())
    .filter((signal) => signal.hits > 0)
    .sort((a, b) => b.score - a.score);

  patternSignals.forEach((signal) => {
    scenarioSignalScore[signal.scenarioId] += signal.score;
  });

  const splitIndex = Math.max(1, Math.floor(timeline.length / 2));
  const early = timeline.slice(0, splitIndex);
  const late = timeline.slice(splitIndex);
  const avg = (items: typeof timeline) =>
    items.length > 0 ? items.reduce((sum, item) => sum + item.weight, 0) / items.length : 0;
  const earlyAvg = avg(early);
  const lateAvg = avg(late);
  const escalationIndex = clamp01(0.5 + (lateAvg - earlyAvg) / 4);

  const latestTimestamp = timeline[timeline.length - 1]?.timestamp || Date.now();
  const recencyWeight = clamp01(recencyFactor(latestTimestamp) / 1.35);

  const highIntensityAlerts = timeline.filter(
    (entry) => entry.alert.severity === AlertSeverity.HIGH || entry.alert.severity === AlertSeverity.CRITICAL
  ).length;
  const pressureIndex = clamp01(
    0.22 +
      repeatedTerms.length * 0.03 +
      Math.min(0.35, patternSignals.length * 0.05) +
      Math.min(0.35, highIntensityAlerts * 0.04)
  );

  return {
    analyzedMessages: timeline.length,
    analyzedAlerts: alerts.length,
    repeatedTerms,
    patternSignals,
    scenarioSignalScore,
    temporal: {
      recencyWeight,
      escalationIndex,
      pressureIndex,
    },
  };
};

