import { AlertSeverity, Category } from '../types';
import { formatTimeDefault } from './dateTimeFormat';

export type PulseTimelineStatus = 'done' | 'error' | 'skipped' | 'info';

export interface PulseTimelineEntryInput {
  title: string;
  detail: string;
  status: PulseTimelineStatus;
  at: string;
}

export interface PulseExecutionEvidenceInput {
  childId: string;
  childName: string;
  scenarioId: string;
  scenarioTitle: string;
  severity: AlertSeverity;
  dominantPlatform: string;
  summary: { done: number; failed: number; skipped: number };
  timeline: PulseTimelineEntryInput[];
}

export interface PulseExecutionEvidenceBuildResult {
  compactSummary: string;
  timelineForLog: PulseTimelineEntryInput[];
  alertData: {
    type: 'PULSE_EXECUTION';
    childName: string;
    platform: string;
    content: string;
    category: Category;
    severity: AlertSeverity;
    suspectId: string;
    suspectUsername: string;
    aiAnalysis: string;
    actionTaken: string;
    latency: string;
    conversationLog: Array<{
      sender: string;
      text: string;
      time: string;
      isSuspect: boolean;
    }>;
  };
}

const MAX_TIMELINE_ITEMS = 20;
const MAX_TEXT_SHORT = 120;
const MAX_TEXT_LONG = 320;
const MAX_ID = 80;
const MAX_SUMMARY_VALUE = 9999;

const normalizeText = (value: unknown, fallback: string, maxLength: number): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return fallback;
  }

  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
};

const normalizeDate = (value: unknown): Date => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(0);
};

const normalizeStatus = (value: unknown): PulseTimelineStatus => {
  if (value === 'done' || value === 'error' || value === 'skipped' || value === 'info') {
    return value;
  }

  return 'info';
};

const normalizeCounter = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.floor(value);
  if (normalized <= 0) {
    return 0;
  }

  return Math.min(normalized, MAX_SUMMARY_VALUE);
};

const formatSummary = (
  lang: 'ar' | 'en',
  summary: { done: number; failed: number; skipped: number }
): string => {
  if (lang === 'ar') {
    return `تم:${summary.done} | تخطي:${summary.skipped} | فشل:${summary.failed}`;
  }

  return `Done:${summary.done} | Skipped:${summary.skipped} | Failed:${summary.failed}`;
};

const formatExecutionContent = (lang: 'ar' | 'en', scenarioTitle: string): string =>
  lang === 'ar'
    ? `تنفيذ خطة التوازن الرقمي (${scenarioTitle})`
    : `Digital balance execution (${scenarioTitle})`;

const formatActionTaken = (lang: 'ar' | 'en'): string =>
  lang === 'ar' ? 'حفظ سجل التنفيذ في الخزنة الجنائية' : 'Saved execution timeline in forensic vault';

export const buildPulseExecutionEvidenceAlert = (
  payload: PulseExecutionEvidenceInput,
  lang: 'ar' | 'en'
): PulseExecutionEvidenceBuildResult => {
  const normalizedSummary = {
    done: normalizeCounter(payload?.summary?.done),
    failed: normalizeCounter(payload?.summary?.failed),
    skipped: normalizeCounter(payload?.summary?.skipped),
  };

  const scenarioTitle = normalizeText(payload?.scenarioTitle, 'Unknown Scenario', MAX_TEXT_SHORT);
  const platform = normalizeText(payload?.dominantPlatform, 'Unknown Platform', MAX_TEXT_SHORT);
  const childName = normalizeText(payload?.childName, 'Unknown Child', MAX_TEXT_SHORT);
  const childId = normalizeText(payload?.childId, 'unknown-child', MAX_ID);
  const scenarioId = normalizeText(payload?.scenarioId, 'unknown-scenario', MAX_ID);

  const timelineForLog = (Array.isArray(payload?.timeline) ? payload.timeline : [])
    .map((entry, idx) => {
      const parsedAt = normalizeDate(entry?.at);
      return {
        title: normalizeText(entry?.title, `Step ${idx + 1}`, MAX_TEXT_SHORT),
        detail: normalizeText(entry?.detail, 'No details provided', MAX_TEXT_LONG),
        status: normalizeStatus(entry?.status),
        at: parsedAt.toISOString(),
        parsedAtMs: parsedAt.getTime(),
      };
    })
    .sort((a, b) => a.parsedAtMs - b.parsedAtMs)
    .slice(-MAX_TIMELINE_ITEMS)
    .map(({ title, detail, status, at }) => ({ title, detail, status, at }));

  const compactSummary = formatSummary(lang, normalizedSummary);

  const timelineText = timelineForLog
    .map((entry, idx) => `${idx + 1}. [${entry.status}] ${entry.title} - ${entry.detail}`)
    .join('\n');

  const aiAnalysis =
    lang === 'ar'
      ? `سيناريو: ${scenarioTitle}\nالمنصة: ${platform}\nالملخص: ${compactSummary}\n\nTimeline:\n${timelineText}`
      : `Scenario: ${scenarioTitle}\nPlatform: ${platform}\nSummary: ${compactSummary}\n\nTimeline:\n${timelineText}`;

  const alertData = {
    type: 'PULSE_EXECUTION' as const,
    childName,
    platform: `Pulse / ${platform}`,
    content: formatExecutionContent(lang, scenarioTitle),
    category: Category.SAFE,
    severity: payload.severity,
    suspectId: `pulse-${childId}`,
    suspectUsername: `pulse_${scenarioId}`,
    aiAnalysis,
    actionTaken: formatActionTaken(lang),
    latency: compactSummary,
    conversationLog: timelineForLog.map((entry) => ({
      sender: entry.status === 'error' ? 'Engine Error' : 'Amanah Engine',
      text: `${entry.title}: ${entry.detail}`,
      time: formatTimeDefault(normalizeDate(entry.at), { includeSeconds: true }),
      isSuspect: entry.status === 'error',
    })),
  };

  return {
    compactSummary,
    timelineForLog,
    alertData,
  };
};
