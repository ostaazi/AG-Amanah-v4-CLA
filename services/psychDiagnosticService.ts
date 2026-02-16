import { AlertSeverity, Category, MonitoringAlert } from '../types';

export type PsychScenarioId =
  | 'bullying'
  | 'threat_exposure'
  | 'gaming'
  | 'inappropriate_content'
  | 'cyber_crime'
  | 'crypto_scams'
  | 'phishing_links'
  | 'self_harm'
  | 'sexual_exploitation'
  | 'account_theft_fraud'
  | 'gambling_betting'
  | 'privacy_tracking'
  | 'harmful_challenges';

export type ThreatExposureSubtype =
  | 'direct_threat'
  | 'financial_blackmail'
  | 'sexual_blackmail';

export type InappropriateContentSubtype =
  | 'sexual_content'
  | 'violent_content';

export interface AlertPsychDiagnosis {
  scenarioId: PsychScenarioId;
  threatSubtype?: ThreatExposureSubtype;
  contentSubtype?: InappropriateContentSubtype;
  confidence: number;
  analyzedAlertCount: number;
  reasons: string[];
  scoreByScenario: Record<PsychScenarioId, number>;
  topSignals: Array<{
    id: string;
    title: string;
    severity: AlertSeverity;
    reason: string;
    suggestedAction: string;
  }>;
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

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  [AlertSeverity.CRITICAL]: 5,
  [AlertSeverity.HIGH]: 3,
  [AlertSeverity.MEDIUM]: 2,
  [AlertSeverity.LOW]: 1,
};

const SEVERITY_TEXT: Record<AlertSeverity, string> = {
  [AlertSeverity.CRITICAL]: 'حرج',
  [AlertSeverity.HIGH]: 'مرتفع',
  [AlertSeverity.MEDIUM]: 'متوسط',
  [AlertSeverity.LOW]: 'منخفض',
};

const CATEGORY_BOOSTS: Record<Category, Partial<Record<PsychScenarioId, number>>> = {
  [Category.BULLYING]: { bullying: 1.8, threat_exposure: 0.4, privacy_tracking: 0.4 },
  [Category.SELF_HARM]: { self_harm: 2.4, harmful_challenges: 0.8, threat_exposure: 0.8 },
  [Category.ADULT_CONTENT]: { inappropriate_content: 1.9, sexual_exploitation: 0.5, threat_exposure: 0.3 },
  [Category.SCAM]: {
    account_theft_fraud: 1.8,
    crypto_scams: 1.5,
    phishing_links: 1.0,
    gambling_betting: 0.6,
    threat_exposure: 0.2,
  },
  [Category.PREDATOR]: { sexual_exploitation: 2.2, threat_exposure: 1.2, inappropriate_content: 0.4 },
  [Category.VIOLENCE]: { harmful_challenges: 1.7, threat_exposure: 1.0, inappropriate_content: 0.6, cyber_crime: 0.4 },
  [Category.BLACKMAIL]: { threat_exposure: 2.1, sexual_exploitation: 0.7, bullying: 0.3 },
  [Category.SEXUAL_EXPLOITATION]: { sexual_exploitation: 2.3, threat_exposure: 1.4, inappropriate_content: 0.5 },
  [Category.PHISHING_LINK]: { phishing_links: 2.4, account_theft_fraud: 1.5, crypto_scams: 0.8, cyber_crime: 0.3 },
  [Category.TAMPER]: { cyber_crime: 1.4, account_theft_fraud: 0.5, privacy_tracking: 0.3 },
  [Category.SAFE]: {},
};

const KEYWORD_MAP: Record<PsychScenarioId, string[]> = {
  bullying: ['تنمر', 'bully', 'harass', 'insult', 'سخرية', 'إهانة', 'مضايقة', 'نبذ'],
  threat_exposure: [
    'تهديد',
    'ابتزاز',
    'sextortion',
    'blackmail',
    'predator',
    'grooming',
    'extort',
    'خوف',
    'عنف',
  ],
  gaming: ['لعب', 'game', 'gaming', 'rank', 'loot', 'سهر', 'screen time', 'tik tok', 'reels'],
  inappropriate_content: ['إباحية', 'porn', 'adult', 'gore', 'صادم', 'محتوى حساس', 'unsafe content'],
  cyber_crime: ['اختراق', 'hack', 'script', 'malware', 'ddos', 'exploit', 'تهكير', 'قرصنة'],
  crypto_scams: ['احتيال', 'scam', 'phishing', 'bitcoin', 'crypto', 'airdrop', 'ربح سريع', 'تحويل'],
  phishing_links: [
    'phishing',
    'fake link',
    'malicious link',
    'suspicious url',
    'credential theft',
    'login page',
    'one-time code',
    'otp',
    'رابط مشبوه',
    'تصيد',
    'صفحة تسجيل مزيفة',
    'سرقة حساب',
    'رمز التحقق',
  ],
  self_harm: [
    'self harm',
    'suicide',
    'kill myself',
    'cutting',
    'eating disorder',
    'إيذاء النفس',
    'انتحار',
    'أكره نفسي',
    'جرح نفسي',
  ],
  sexual_exploitation: [
    'grooming',
    'predator',
    'sexual exploitation',
    'sexting',
    'استدراج',
    'استغلال جنسي',
    'ابتزاز جنسي',
    'صور خاصة',
    'علاقة سرية',
  ],
  account_theft_fraud: [
    'account stolen',
    'stolen account',
    'credential stuffing',
    'reset code',
    'session hijack',
    'سرقة حساب',
    'اختراق الحساب',
    'كود التحقق',
    'رمز الاستعادة',
    'انتحال',
  ],
  gambling_betting: [
    'gambling',
    'bet',
    'casino',
    'loot box',
    'skin betting',
    'مراهنة',
    'قمار',
    'رهان',
    'حظ',
    'شراء داخل اللعبة',
  ],
  privacy_tracking: [
    'stalkerware',
    'spy app',
    'tracking link',
    'doxxing',
    'location leak',
    'تتبع',
    'تجسس',
    'انتهاك الخصوصية',
    'تسريب موقع',
    'سمعة رقمية',
  ],
  harmful_challenges: [
    'dangerous challenge',
    'harmful challenge',
    'self challenge',
    'violent trend',
    'تحدي خطير',
    'ترند خطير',
    'مجموعة ضارة',
    'تحريض',
    'إيذاء',
  ],
};

const SUGGESTED_ACTION_MAP: Record<PsychScenarioId, string> = {
  bullying: 'توثيق الأدلة + حظر + تعديل الخصوصية + متابعة تربوية.',
  threat_exposure: 'خطة 10 دقائق: لا تفاوض، لا دفع، حفظ الأدلة، تأمين الحساب، ثم الإبلاغ.',
  gaming: 'خفض تدريجي + ضبط نوم + خطة بدائل ومراجعة أسبوعية.',
  inappropriate_content: 'تقوية الفلترة + SafeSearch + حوار آمن بلا عقوبة.',
  cyber_crime: 'إيقاف الأدوات الخطرة وتوجيه قانوني لمسار تعلم أخلاقي.',
  crypto_scams: 'إيقاف المدفوعات غير المعتمدة + مراجعة مالية أسرية فورية.',
  phishing_links: 'عزل الروابط المشبوهة + تغيير كلمات المرور + تفعيل المصادقة الثنائية (2FA) + فحص جلسات الدخول.',
  self_harm: 'خطة أمان فورية + احتواء نفسي مباشر + تصعيد مختص عند المؤشرات الحرجة.',
  sexual_exploitation: 'حماية فورية + حفظ الأدلة + منع التواصل + بدء مسار إبلاغ رسمي.',
  account_theft_fraud: 'تدوير كلمات المرور + إغلاق الجلسات + تأمين الاسترداد + مراقبة الحسابات.',
  gambling_betting: 'تجميد المشتريات والمدفوعات + حدود إنفاق + برنامج بدائل سلوكية أسبوعي.',
  privacy_tracking: 'فحص الجهاز من تطبيقات التجسس + ضبط الخصوصية + تقليل مشاركة البيانات.',
  harmful_challenges: 'عزل المجموعات المحرضة + تدخل تربوي عاجل + مراقبة لصيقة قصيرة المدى.',
};

const THREAT_SUBTYPE_KEYWORDS: Record<ThreatExposureSubtype, string[]> = {
  direct_threat: ['تهديد', 'عنف', 'قتل', 'hurt', 'kill', 'violent', 'death'],
  financial_blackmail: [
    'ابتزاز مالي',
    'دفع',
    'تحويل',
    'محفظة',
    'بطاقة هدية',
    'wallet',
    'payment',
    'gift card',
    'crypto',
    'bitcoin',
  ],
  sexual_blackmail: [
    'ابتزاز جنسي',
    'استغلال جنسي',
    'صور خاصة',
    'صور شخصية',
    'sextortion',
    'nude',
    'private photos',
    'sexual',
    'intimate',
  ],
};

const THREAT_SUBTYPE_CATEGORY_BOOSTS: Record<
  Category,
  Partial<Record<ThreatExposureSubtype, number>>
> = {
  [Category.BLACKMAIL]: { direct_threat: 1.2, financial_blackmail: 1.6, sexual_blackmail: 1.8 },
  [Category.SCAM]: { financial_blackmail: 2.1, direct_threat: 0.4 },
  [Category.SEXUAL_EXPLOITATION]: { sexual_blackmail: 2.2, direct_threat: 0.5 },
  [Category.PREDATOR]: { sexual_blackmail: 1.5, direct_threat: 1.0 },
  [Category.VIOLENCE]: { direct_threat: 1.9, sexual_blackmail: 0.4 },
  [Category.BULLYING]: { direct_threat: 0.8 },
  [Category.SELF_HARM]: {},
  [Category.ADULT_CONTENT]: { sexual_blackmail: 0.5 },
  [Category.PHISHING_LINK]: { financial_blackmail: 0.7 },
  [Category.TAMPER]: {},
  [Category.SAFE]: {},
};

const THREAT_SUBTYPE_ACTION_MAP: Record<ThreatExposureSubtype, string> = {
  direct_threat: 'مسار تهديد مباشر: توثيق الأدلة + تأمين فوري + تصعيد فوري.',
  financial_blackmail: 'مسار ابتزاز مالي: تجميد المدفوعات + عزل الشبكة + تأمين الحسابات المالية.',
  sexual_blackmail: 'مسار ابتزاز جنسي: لا تفاوض + تجميد الأدلة + حماية عاجلة + مسار إبلاغ رسمي.',
};

const CONTENT_SUBTYPE_KEYWORDS: Record<InappropriateContentSubtype, string[]> = {
  sexual_content: [
    'porn',
    'adult',
    'explicit',
    'nude',
    'إباحية',
    'محتوى جنسي',
    'صور خاصة',
  ],
  violent_content: [
    'gore',
    'violent',
    'blood',
    'kill',
    'قتل',
    'دموي',
    'عنيف',
    'تحريض',
  ],
};

const CONTENT_SUBTYPE_CATEGORY_BOOSTS: Record<
  Category,
  Partial<Record<InappropriateContentSubtype, number>>
> = {
  [Category.ADULT_CONTENT]: { sexual_content: 2.1, violent_content: 0.9 },
  [Category.VIOLENCE]: { violent_content: 2.0, sexual_content: 0.2 },
  [Category.SEXUAL_EXPLOITATION]: { sexual_content: 1.2 },
  [Category.PREDATOR]: { sexual_content: 0.7 },
  [Category.BLACKMAIL]: { sexual_content: 0.4, violent_content: 0.2 },
  [Category.SCAM]: {},
  [Category.BULLYING]: { violent_content: 0.3 },
  [Category.SELF_HARM]: { violent_content: 0.4 },
  [Category.PHISHING_LINK]: {},
  [Category.TAMPER]: {},
  [Category.SAFE]: {},
};

const CONTENT_SUBTYPE_ACTION_MAP: Record<InappropriateContentSubtype, string> = {
  sexual_content: 'مسار محتوى جنسي: تشديد الفلترة + SafeSearch + حوار احتوائي بلا لوم.',
  violent_content: 'مسار محتوى عنيف: عزل المصدر + تهدئة فورية + تفعيل حماية مشددة للمحتوى.',
};

const normalize = (value?: string) => (value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const CATEGORY_ALIAS_MAP: Record<string, Category> = {
  [Category.BULLYING]: Category.BULLYING,
  BULLYING: Category.BULLYING,
  CYBER_BULLYING: Category.BULLYING,
  [Category.SELF_HARM]: Category.SELF_HARM,
  SELF_HARM: Category.SELF_HARM,
  SUICIDE: Category.SELF_HARM,
  [Category.ADULT_CONTENT]: Category.ADULT_CONTENT,
  ADULT_CONTENT: Category.ADULT_CONTENT,
  ADULT: Category.ADULT_CONTENT,
  NSFW: Category.ADULT_CONTENT,
  [Category.SCAM]: Category.SCAM,
  SCAM: Category.SCAM,
  FRAUD: Category.SCAM,
  [Category.PREDATOR]: Category.PREDATOR,
  PREDATOR: Category.PREDATOR,
  GROOMING: Category.PREDATOR,
  [Category.VIOLENCE]: Category.VIOLENCE,
  VIOLENCE: Category.VIOLENCE,
  GORE: Category.VIOLENCE,
  [Category.BLACKMAIL]: Category.BLACKMAIL,
  BLACKMAIL: Category.BLACKMAIL,
  SEXTORTION: Category.BLACKMAIL,
  [Category.SEXUAL_EXPLOITATION]: Category.SEXUAL_EXPLOITATION,
  SEXUAL_EXPLOITATION: Category.SEXUAL_EXPLOITATION,
  [Category.PHISHING_LINK]: Category.PHISHING_LINK,
  PHISHING_LINK: Category.PHISHING_LINK,
  PHISHING: Category.PHISHING_LINK,
  [Category.TAMPER]: Category.TAMPER,
  TAMPER: Category.TAMPER,
  [Category.SAFE]: Category.SAFE,
  SAFE: Category.SAFE,
};

const normalizeCategory = (value: unknown): Category => {
  const raw = String(value || '').trim();
  if (!raw) return Category.SAFE;
  return CATEGORY_ALIAS_MAP[raw] || CATEGORY_ALIAS_MAP[raw.toUpperCase()] || Category.SAFE;
};

const calculateRecencyFactor = (timestamp: Date | string | number | undefined): number => {
  if (!timestamp) return 0.8;
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return 0.8;
  const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
  if (ageHours <= 24) return 1.25;
  if (ageHours <= 72) return 1.1;
  if (ageHours <= 7 * 24) return 1.0;
  if (ageHours <= 30 * 24) return 0.85;
  return 0.7;
};

const isAlertForChild = (alertChildName: string, childName: string) => {
  const a = normalize(alertChildName);
  const c = normalize(childName);
  if (!a || !c) return false;
  return a === c || a.includes(c) || c.includes(a);
};

export const inferThreatExposureSubtypeFromAlerts = (
  alerts: MonitoringAlert[]
): ThreatExposureSubtype => {
  const score: Record<ThreatExposureSubtype, number> = {
    direct_threat: 0,
    financial_blackmail: 0,
    sexual_blackmail: 0,
  };

  for (const alert of alerts) {
    const severityWeight = SEVERITY_WEIGHT[alert.severity] || 1;
    const recencyFactor = calculateRecencyFactor(alert.timestamp);
    const baseWeight = severityWeight * recencyFactor;
    const normalizedCategory = normalizeCategory(alert.category);
    const textCorpus = normalize(
      `${alert.content || ''} ${alert.aiAnalysis || ''} ${alert.platform || ''} ${alert.category || ''} ${normalizedCategory}`
    );

    const categoryBoosts = THREAT_SUBTYPE_CATEGORY_BOOSTS[normalizedCategory] || {};
    (Object.keys(score) as ThreatExposureSubtype[]).forEach((subtype) => {
      const categoryBoost = categoryBoosts[subtype];
      if (categoryBoost) {
        score[subtype] += baseWeight * categoryBoost;
      }

      const keywordHits = THREAT_SUBTYPE_KEYWORDS[subtype].filter((kw) =>
        textCorpus.includes(kw)
      ).length;
      if (keywordHits > 0) {
        score[subtype] += baseWeight * 0.45 * keywordHits;
      }
    });
  }

  const ranked = (Object.keys(score) as ThreatExposureSubtype[]).sort(
    (a, b) => score[b] - score[a]
  );

  return ranked[0] || 'direct_threat';
};

export const inferInappropriateContentSubtypeFromAlerts = (
  alerts: MonitoringAlert[]
): InappropriateContentSubtype => {
  const score: Record<InappropriateContentSubtype, number> = {
    sexual_content: 0,
    violent_content: 0,
  };

  for (const alert of alerts) {
    const severityWeight = SEVERITY_WEIGHT[alert.severity] || 1;
    const recencyFactor = calculateRecencyFactor(alert.timestamp);
    const baseWeight = severityWeight * recencyFactor;
    const normalizedCategory = normalizeCategory(alert.category);
    const textCorpus = normalize(
      `${alert.content || ''} ${alert.aiAnalysis || ''} ${alert.platform || ''} ${alert.category || ''} ${normalizedCategory}`
    );

    const categoryBoosts = CONTENT_SUBTYPE_CATEGORY_BOOSTS[normalizedCategory] || {};
    (Object.keys(score) as InappropriateContentSubtype[]).forEach((subtype) => {
      const categoryBoost = categoryBoosts[subtype];
      if (categoryBoost) {
        score[subtype] += baseWeight * categoryBoost;
      }

      const keywordHits = CONTENT_SUBTYPE_KEYWORDS[subtype].filter((kw) =>
        textCorpus.includes(kw)
      ).length;
      if (keywordHits > 0) {
        score[subtype] += baseWeight * 0.45 * keywordHits;
      }
    });
  }

  const ranked = (Object.keys(score) as InappropriateContentSubtype[]).sort(
    (a, b) => score[b] - score[a]
  );

  return ranked[0] || 'sexual_content';
};

export const diagnosePsychScenarioFromAlerts = (
  childName: string,
  alerts: MonitoringAlert[]
): AlertPsychDiagnosis | null => {
  if (!childName || !alerts?.length) return null;

  const childAlerts = alerts.filter((alert) => isAlertForChild(alert.childName, childName));
  if (!childAlerts.length) return null;

  const scoreByScenario: Record<PsychScenarioId, number> = {
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
  };

  const evidence: Record<PsychScenarioId, Array<{ alert: MonitoringAlert; score: number }>> = {
    bullying: [],
    threat_exposure: [],
    gaming: [],
    inappropriate_content: [],
    cyber_crime: [],
    crypto_scams: [],
    phishing_links: [],
    self_harm: [],
    sexual_exploitation: [],
    account_theft_fraud: [],
    gambling_betting: [],
    privacy_tracking: [],
    harmful_challenges: [],
  };

  for (const alert of childAlerts) {
    const severityWeight = SEVERITY_WEIGHT[alert.severity] || 1;
    const recencyFactor = calculateRecencyFactor(alert.timestamp);
    const baseWeight = severityWeight * recencyFactor;
    const normalizedCategory = normalizeCategory(alert.category);

    const categoryMap = CATEGORY_BOOSTS[normalizedCategory] || {};
    const textCorpus = normalize(
      `${alert.content || ''} ${alert.aiAnalysis || ''} ${alert.platform || ''} ${alert.category || ''} ${normalizedCategory}`
    );

    for (const scenario of SCENARIOS) {
      let alertScenarioScore = 0;

      const categoryBoost = categoryMap[scenario];
      if (categoryBoost) {
        alertScenarioScore += baseWeight * categoryBoost;
      }

      const keywordHits = KEYWORD_MAP[scenario].filter((kw) => textCorpus.includes(kw)).length;
      if (keywordHits > 0) {
        alertScenarioScore += baseWeight * 0.35 * keywordHits;
      }

      if (alertScenarioScore > 0) {
        scoreByScenario[scenario] += alertScenarioScore;
        evidence[scenario].push({ alert, score: alertScenarioScore });
      }
    }
  }

  const ranked = [...SCENARIOS]
    .map((scenarioId) => ({ scenarioId, score: scoreByScenario[scenarioId] }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top || top.score <= 0) return null;

  const second = ranked[1]?.score || 0;
  const scoreSum = ranked.reduce((sum, item) => sum + item.score, 0) || top.score;
  const spread = (top.score - second) / (top.score || 1);
  const dominance = top.score / scoreSum;
  const confidence = Math.round(Math.min(99, Math.max(42, dominance * 65 + spread * 35)));

  const scenarioEvidence = [...evidence[top.scenarioId as PsychScenarioId]]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const threatSubtype =
    top.scenarioId === 'threat_exposure'
      ? inferThreatExposureSubtypeFromAlerts(childAlerts)
      : undefined;
  const contentSubtype =
    top.scenarioId === 'inappropriate_content'
      ? inferInappropriateContentSubtypeFromAlerts(childAlerts)
      : undefined;

  const reasons = scenarioEvidence.map(
    ({ alert }) => {
      const normalizedCategory = normalizeCategory(alert.category);
      return `[${SEVERITY_TEXT[alert.severity]}] ${normalizedCategory}: ${
        alert.aiAnalysis || alert.content || 'مؤشر سلوكي ملحوظ'
      }`;
    }
  );

  if (threatSubtype) {
    reasons.unshift(`[Threat Track] ${threatSubtype}`);
  }
  if (contentSubtype) {
    reasons.unshift(`[Content Track] ${contentSubtype}`);
  }

  const topSignals = scenarioEvidence.map(({ alert }, idx) => {
    const normalizedCategory = normalizeCategory(alert.category);
    return {
      id: `diag-${top.scenarioId}-${alert.id || idx}`,
      title: `إشارة تحليل من ${normalizedCategory}`,
      severity: alert.severity,
      reason: alert.aiAnalysis || alert.content || 'تم رصد نمط سلوكي يحتاج متابعة.',
      suggestedAction:
        top.scenarioId === 'threat_exposure' && threatSubtype
          ? THREAT_SUBTYPE_ACTION_MAP[threatSubtype]
          : top.scenarioId === 'inappropriate_content' && contentSubtype
            ? CONTENT_SUBTYPE_ACTION_MAP[contentSubtype]
            : SUGGESTED_ACTION_MAP[top.scenarioId as PsychScenarioId],
    };
  });

  return {
    scenarioId: top.scenarioId as PsychScenarioId,
    threatSubtype,
    contentSubtype,
    confidence,
    analyzedAlertCount: childAlerts.length,
    reasons,
    scoreByScenario,
    topSignals,
  };
};
