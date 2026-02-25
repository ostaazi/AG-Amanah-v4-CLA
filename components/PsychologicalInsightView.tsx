/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertSeverity,
  Category,
  Child,
  ChildSignalEvent,
  CustomMode,
  Device,
  MonitoringAlert,
  PsychologicalProfile,
  SafetyPlaybook,
} from '../types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar as RadarComponent,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import {
  diagnosePsychScenarioFromAlerts,
  InappropriateContentSubtype,
  PsychScenarioId,
  ThreatExposureSubtype,
} from '../services/psychDiagnosticService';
import { fetchPlaybooks, sendRemoteCommand } from '../services/firestoreService';
import { formatTimeDefault } from '../services/dateTimeFormat';
import { getDefenseActionsWithPlaybooks } from '../services/ruleEngineService';
import { buildPsychRiskForecast } from '../services/psychForecastService';
import { buildPsychAutomationGate } from '../services/psychAutomationGateService';

interface PsychologicalInsightViewProps {
  theme: 'light' | 'dark';
  child?: Child;
  childrenList?: Child[];
  alerts?: MonitoringAlert[];
  signalEvents?: ChildSignalEvent[];
  lang?: 'ar' | 'en';
  autoLockInAutomationEnabled?: boolean;
  allLocksDisabled?: boolean;
  onAcceptPlan: (plan: Partial<CustomMode>) => string | void;
  onApplyModeToChild?: (childId: string, modeId?: string) => Promise<void> | void;
  onPlanExecutionResult?: (summary: { done: number; failed: number; skipped: number }) => void;
  onSaveExecutionEvidence?: (payload: PlanExecutionEvidencePayload) => Promise<string | void> | string | void;
  onPersistForecastSnapshot?: (payload: PsychForecastSnapshotPayload) => Promise<void> | void;
}

interface InterventionStep {
  week: string;
  goal: string;
  action: string;
}

interface GuidanceScenario {
  id: PsychScenarioId;
  title: string;
  icon: string;
  severity: AlertSeverity;
  severityColor: string;
  symptoms: string[];
  lurePatterns: string[];
  prevention: string[];
  interventionProgram: InterventionStep[];
  dialogues: {
    situation: string;
    opener: string;
    advice: string;
  }[];
  alertTemplates: string[];
  incidentPlan: string[];
}

interface AutoExecutionStep {
  id: string;
  title: string;
  description: string;
  command:
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
  value: unknown;
  minSeverity: AlertSeverity;
  enabledByDefault: boolean;
}

type AutoStepStatus = 'idle' | 'pending' | 'done' | 'error' | 'skipped';
type PlanVideoSource = 'camera_front' | 'camera_back' | 'screen';
type PlanAudioSource = 'mic' | 'system';
type PlanTimelineStatus = 'done' | 'error' | 'skipped' | 'info';
type ScenarioSectionKey =
  | 'symptoms'
  | 'lurePatterns'
  | 'prevention'
  | 'incidentPlan'
  | 'alertTemplates'
  | 'interventionProgram'
  | 'dialogues';
type PreviewSectionKey = 'symptoms' | 'lurePatterns';

interface PreviewOperationalInsight {
  badge: string;
  whyNow: string;
  immediateAction: string;
  toneClass: string;
}

interface PlanTimelineEntry {
  id: string;
  title: string;
  detail: string;
  status: PlanTimelineStatus;
  at: Date;
}

interface PlanExecutionEvidencePayload {
  childId: string;
  childIds?: string[];
  childName: string;
  scenarioId: PsychScenarioId;
  threatSubtype?: ThreatExposureSubtype;
  contentSubtype?: InappropriateContentSubtype;
  scenarioTitle: string;
  severity: AlertSeverity;
  dominantPlatform: string;
  summary: { done: number; failed: number; skipped: number };
  timeline: Array<{
    title: string;
    detail: string;
    status: PlanTimelineStatus;
    at: string;
  }>;
}

interface PsychForecastSnapshotPayload {
  childId: string;
  childIds?: string[];
  childName: string;
  generatedAt: string;
  sevenDayTop?: {
    scenarioId: PsychScenarioId;
    riskScore: number;
    probability: number;
    confidence: number;
    trend: 'rising' | 'stable' | 'cooling';
    explanationAr: string;
    explanationEn: string;
  };
  thirtyDayTop?: {
    scenarioId: PsychScenarioId;
    riskScore: number;
    probability: number;
    confidence: number;
    trend: 'rising' | 'stable' | 'cooling';
    explanationAr: string;
    explanationEn: string;
  };
  contextSummary: {
    analyzedMessages: number;
    analyzedAlerts: number;
    recencyWeight: number;
    escalationIndex: number;
    pressureIndex: number;
    repeatedTerms: string[];
    topPatternIds: string[];
  };
  sourceCoverage?: {
    sourceCount: number;
    depthScore: number;
    counts: Record<string, number>;
    topDriversEn: string[];
  };
}

const severityRank: Record<AlertSeverity, number> = {
  [AlertSeverity.LOW]: 1,
  [AlertSeverity.MEDIUM]: 2,
  [AlertSeverity.HIGH]: 3,
  [AlertSeverity.CRITICAL]: 4,
};

const isAutoLockCommand = (command: AutoExecutionStep['command']): boolean =>
  command === 'lockDevice' || command === 'lockscreenBlackout';

interface LogicalChildAggregate {
  groupId: string;
  displayName: string;
  members: Child[];
  mergedChild: Child;
  deviceCount: number;
}

const normalizeChildIdentity = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const mergePsychProfiles = (profiles: PsychologicalProfile[]): PsychologicalProfile | undefined => {
  if (profiles.length === 0) return undefined;

  const avg = (values: number[]) => {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };
  const anxietyLevel = Math.round(avg(profiles.map((p) => p.anxietyLevel || 0)));
  const moodScore = Math.round(avg(profiles.map((p) => p.moodScore || 0)));
  const isolationRisk = Math.round(avg(profiles.map((p) => p.isolationRisk || 0)));
  const incidentReadinessScore = Math.round(
    avg(profiles.map((p) => p.incidentReadinessScore ?? 0))
  );

  const emotionCounts = new Map<string, number>();
  profiles.forEach((p) => {
    const key = (p.dominantEmotion || '').trim();
    if (!key) return;
    emotionCounts.set(key, (emotionCounts.get(key) || 0) + 1);
  });
  const dominantEmotion =
    Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    profiles[0].dominantEmotion ||
    'Stable';

  const allKeywords = profiles.flatMap((p) => p.recentKeywords || []).map((k) => k.trim()).filter(Boolean);
  const recentKeywords = Array.from(new Set(allKeywords)).slice(0, 60);

  const profileByRisk = [...profiles].sort((a, b) => {
    const scoreA = (a.anxietyLevel || 0) + (a.isolationRisk || 0) + (100 - (a.moodScore || 0));
    const scoreB = (b.anxietyLevel || 0) + (b.isolationRisk || 0) + (100 - (b.moodScore || 0));
    return scoreB - scoreA;
  });
  const highestRiskProfile = profileByRisk[0] || profiles[0];
  const recommendation =
    highestRiskProfile.recommendation ||
    profiles.find((p) => !!p.recommendation)?.recommendation ||
    '';

  const priorityScenario =
    highestRiskProfile.priorityScenario ||
    profiles.find((p) => !!p.priorityScenario)?.priorityScenario;

  const mergedSignals = new Map<string, NonNullable<PsychologicalProfile['riskSignals']>[number]>();
  profiles.forEach((p) => {
    (p.riskSignals || []).forEach((signal) => {
      const key = `${signal.title}|${signal.reason}`;
      const existing = mergedSignals.get(key);
      if (!existing || severityRank[signal.severity] > severityRank[existing.severity]) {
        mergedSignals.set(key, { ...signal, id: signal.id || `agg-${key}` });
      }
    });
  });
  const riskSignals = Array.from(mergedSignals.values()).slice(0, 20);

  const trendBuckets = new Map<string, number[]>();
  profiles.forEach((p) => {
    (p.weeklyTrend || []).forEach((point) => {
      const label = (point.label || '').trim();
      if (!label) return;
      const bucket = trendBuckets.get(label) || [];
      bucket.push(point.value || 0);
      trendBuckets.set(label, bucket);
    });
  });
  const weeklyTrend = Array.from(trendBuckets.entries()).map(([label, values]) => ({
    label,
    value: Math.round(avg(values)),
  }));

  return {
    anxietyLevel,
    moodScore,
    dominantEmotion,
    isolationRisk,
    recentKeywords,
    recommendation,
    priorityScenario,
    incidentReadinessScore,
    riskSignals,
    weeklyTrend,
  };
};

const aggregateLogicalChild = (groupId: string, members: Child[]): Child => {
  const base = members[0];
  const profiles = members.map((m) => m.psychProfile).filter((p): p is PsychologicalProfile => !!p);
  const psychProfile = mergePsychProfiles(profiles);

  const appMap = new Map<string, { id: string; appName: string; icon: string; minutesUsed: number; isBlocked: boolean }>();
  members.forEach((member) => {
    (member.appUsage || []).forEach((app) => {
      const key = (app.id || app.appName || '').toLowerCase().trim();
      if (!key) return;
      const existing = appMap.get(key);
      if (!existing) {
        appMap.set(key, { ...app });
      } else {
        existing.minutesUsed += app.minutesUsed || 0;
        existing.isBlocked = existing.isBlocked || !!app.isBlocked;
        if (!existing.icon && app.icon) existing.icon = app.icon;
      }
    });
  });
  const appUsage = Array.from(appMap.values()).sort((a, b) => b.minutesUsed - a.minutesUsed);

  const allDevices: Device[] = [];
  const seenDevices = new Set<string>();
  members.forEach((member) => {
    (member.devices || []).forEach((device) => {
      const key = device.id || `${device.model}-${device.os}`;
      if (seenDevices.has(key)) return;
      seenDevices.add(key);
      allDevices.push(device);
    });
    if (!seenDevices.has(member.id)) {
      seenDevices.add(member.id);
      allDevices.push({
        id: member.id,
        model: member.deviceNickname || 'Android Device',
        os: 'Android',
        lastActive: new Date(),
        nickname: member.deviceNickname,
      });
    }
  });

  const status = members.some((m) => m.status === 'online') ? 'online' : 'offline';
  const batteryLevel = Math.round(members.reduce((sum, m) => sum + (m.batteryLevel || 0), 0) / Math.max(members.length, 1));
  const signalStrength = Math.round(
    members.reduce((sum, m) => sum + (m.signalStrength || 0), 0) / Math.max(members.length, 1)
  );

  const latestLocation = members
    .map((m) => m.location)
    .filter(Boolean)
    .sort((a, b) => new Date((b as any).lastUpdated || 0).getTime() - new Date((a as any).lastUpdated || 0).getTime())[0];

  return {
    ...base,
    id: base.id || groupId,
    name: base.name,
    status,
    batteryLevel,
    signalStrength,
    appUsage,
    currentScreenTime: members.reduce((sum, m) => sum + (m.currentScreenTime || 0), 0),
    screenTimeLimit: members.reduce((sum, m) => sum + (m.screenTimeLimit || 0), 0),
    deviceLocked: members.some((m) => m.deviceLocked),
    cameraBlocked: members.some((m) => m.cameraBlocked),
    micBlocked: members.some((m) => m.micBlocked),
    preventAppInstall: members.some((m) => m.preventAppInstall),
    preventDeviceLock: members.some((m) => m.preventDeviceLock),
    psychProfile,
    devices: allDevices,
    location: latestLocation as Child['location'],
  };
};

const buildLogicalChildAggregates = (children: Child[]): LogicalChildAggregate[] => {
  const groups = new Map<string, Child[]>();
  children.forEach((item) => {
    if (!item?.id) return;
    const ownerKey = normalizeChildIdentity(item.deviceOwnerUid);
    const nameKey = normalizeChildIdentity(item.name);
    const ageKey = Number.isFinite(item.age) ? item.age.toString() : 'na';
    const groupKey = ownerKey
      ? `${item.parentId || 'parent'}::owner:${ownerKey}`
      : `${item.parentId || 'parent'}::name:${nameKey}::age:${ageKey}`;
    const bucket = groups.get(groupKey) || [];
    bucket.push(item);
    groups.set(groupKey, bucket);
  });

  const logical = Array.from(groups.entries()).map(([groupId, members]) => {
    const sortedMembers = [...members].sort((a, b) => {
      const aScore = (a.psychProfile ? 1 : 0) + (a.status === 'online' ? 1 : 0);
      const bScore = (b.psychProfile ? 1 : 0) + (b.status === 'online' ? 1 : 0);
      return bScore - aScore;
    });
    const mergedChild = aggregateLogicalChild(groupId, sortedMembers);
    return {
      groupId,
      displayName: sortedMembers[0]?.name || mergedChild.name || 'Child',
      members: sortedMembers,
      mergedChild,
      deviceCount: sortedMembers.length,
    };
  });

  return logical.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'));
};

const scenarioBlockedDomains: Record<PsychScenarioId, string[]> = {
  bullying: ['discord.com', 'telegram.org'],
  threat_exposure: ['discord.com', 'telegram.org', 'snapchat.com'],
  gaming: ['roblox.com', 'epicgames.com', 'discord.com'],
  inappropriate_content: ['reddit.com', 'xvideos.com', 'pornhub.com'],
  cyber_crime: ['pastebin.com', 'discord.com', 'telegram.org'],
  crypto_scams: ['binance.com', 'okx.com', 'telegram.org'],
  phishing_links: ['bit.ly', 'tinyurl.com', 't.me', 'discord.com'],
  self_harm: ['reddit.com', 'discord.com', 'telegram.org'],
  sexual_exploitation: ['snapchat.com', 'telegram.org', 'discord.com'],
  account_theft_fraud: ['bit.ly', 'tinyurl.com', 't.me', 'discord.com'],
  gambling_betting: ['stake.com', '1xbet.com', 'bet365.com'],
  privacy_tracking: ['grabify.link', 'iplogger.org', 'shorturl.at'],
  harmful_challenges: ['tiktok.com', 'youtube.com', 'discord.com'],
};

const guidanceScenariosBase: GuidanceScenario[] = [
  {
    id: 'bullying',
    title: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™â€¦Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€žÃ™Æ’Ã˜ÂªÃ˜Â±Ã™Ë†Ã™â€ Ã™Å ',
    icon: 'Ã°Å¸Â§Â©',
    severity: AlertSeverity.HIGH,
    severityColor: 'bg-rose-600',
    symptoms: [
      'Ã˜ÂªÃ˜Â¬Ã™â€ Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯Ã˜Â© Ã˜Â£Ã™Ë† Ã˜Â­Ã˜Â°Ã™Â Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â¨Ã˜Â³Ã˜Â±Ã˜Â¹Ã˜Â©.',
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â²Ã˜Â§Ã˜Â¬ Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™ÂÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.',
      'Ã˜Â§Ã™â€ Ã˜Â³Ã˜Â­Ã˜Â§Ã˜Â¨ Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â£Ã™Ë† Ã˜Â±Ã™ÂÃ˜Â¶ Ã˜Â§Ã™â€žÃ˜Â°Ã™â€¡Ã˜Â§Ã˜Â¨ Ã™â€žÃ™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â© Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã˜Â¨Ã˜Â±Ã˜Â± Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­.',
    ],
    lurePatterns: [
      'Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â³Ã˜ÂªÃ™ÂÃ˜Â² Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â«Ã™â€¦ Ã˜ÂªÃ™â€ Ã˜Â´Ã˜Â± Ã™â€žÃ™â€šÃ˜Â·Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â­Ã˜Â±Ã˜Â¬Ã˜Â©.',
      'Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å Ã˜Â© Ã™â€žÃ˜Â¥Ã™â€¡Ã˜Â§Ã™â€ Ã˜Â© Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã™Ë†Ã˜Â¥Ã™â€šÃ˜ÂµÃ˜Â§Ã˜Â¡ Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å .',
      'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜ÂªÃ˜Â­Ã˜Â±Ã™Å Ã˜Â¶Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â¯Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™â€žÃ™â€žÃ˜Â±Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€žÃ™Å .',
    ],
    prevention: [
      'Ã˜ÂªÃ˜Â´Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â©: Ã™â€¦Ã™â€  Ã™Å Ã˜Â±Ã˜Â§Ã˜Â³Ã™â€ž/Ã™Å Ã˜Â´Ã˜Â§Ã™â€¡Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â´Ã™Ë†Ã˜Â±Ã˜Â§Ã˜Âª.',
      'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â±Ã˜Â¨Ã˜Â§Ã˜Â¡ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¨ Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª.',
      'Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©: Ã™Ë†Ã˜Â«Ã™â€˜Ã™â€šÃ˜Å’ Ã˜Â§Ã˜Â­Ã˜Â¸Ã˜Â±Ã˜Å’ Ã˜Â¨Ã™â€žÃ™â€˜Ã˜ÂºÃ˜Å’ Ã™â€žÃ˜Â§ Ã˜ÂªÃ˜Â±Ã˜Â¯.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å ', action: 'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â¯Ã˜Â¹Ã™â€¦ + Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© + Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â°Ã™Å Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â²Ã˜Â§Ã™Â', action: 'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã™â€ Ã™â€šÃ˜Â§Ã˜Â· Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¦Ã˜Â§Ã˜Â³ Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€šÃ˜Â©', action: 'Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å  Ã™Ë†Ã˜Â¥Ã˜Â´Ã˜Â±Ã˜Â§Ã™Æ’ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â© Ã˜Â¥Ã˜Â°Ã˜Â§ Ã™Æ’Ã˜Â§Ã™â€ Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â¦Ã˜Â© Ã™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Æ’Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â§Ã™ÂÃ™Å ', action: 'Ã˜Â®Ã˜Â·Ã˜Â© Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â¹ Ã™â€šÃ™Å Ã˜Â§Ã˜Â³ Ã˜ÂªÃ˜Â­Ã˜Â³Ã™â€  Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â§Ã™ÂÃ˜ÂªÃ˜ÂªÃ˜Â§Ã˜Â­ Ã˜Â¨Ã™â€žÃ˜Â§ Ã™â€žÃ™Ë†Ã™â€¦',
        opener: 'Ã˜Â£Ã™â€ Ã˜Â§ Ã™â€¦Ã˜Â¹Ã™Æ’Ã˜Å’ Ã™Ë†Ã˜Â£Ã™Å  Ã˜Â¥Ã˜Â³Ã˜Â§Ã˜Â¡Ã˜Â© Ã™Ë†Ã˜ÂµÃ™â€žÃ˜Âª Ã™â€žÃ™Æ’ Ã™â€žÃ™Å Ã˜Â³Ã˜Âª Ã˜Â®Ã˜Â·Ã˜Â£Ã™Æ’. Ã˜Â§Ã˜Â­Ã™Æ’Ã™Å  Ã™â€žÃ™Å  Ã˜Â¨Ã™â€¡Ã˜Â¯Ã™Ë†Ã˜Â¡.',
        advice: 'Ã™â€žÃ˜Â§ Ã˜ÂªÃ˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¦Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜ÂªÃ™â€¡Ã˜Â§Ã™â€¦Ã™Å Ã˜Â©Ã˜Å’ Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å .',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â±Ã˜Â±',
        opener: 'Ã˜Â³Ã™â€ Ã™Ë†Ã™â€šÃ™Â Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã™Å Ã˜Â¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ Ã˜Å’ Ã™Ë†Ã™â€ Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã˜Â­Ã˜Â°Ã™Â.',
        advice: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã™Å Ã˜Â³Ã˜Â¨Ã™â€š Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â°Ã™Â Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€¦Ã™â€¹Ã˜Â§.',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â«Ã™â€šÃ˜Â©',
        opener: 'Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜ÂºÃ™Æ’ Ã™â€žÃ™â€ Ã˜Â§ Ã™â€šÃ™Ë†Ã˜Â©Ã˜Å’ Ã™Ë†Ã™â€žÃ™Å Ã˜Â³ Ã˜Â¶Ã˜Â¹Ã™ÂÃ™â€¹Ã˜Â§. Ã™â€ Ã˜Â­Ã™â€  Ã™ÂÃ˜Â±Ã™Å Ã™â€š Ã™Ë†Ã˜Â§Ã˜Â­Ã˜Â¯.',
        advice: 'Ã˜Â£Ã˜Â¹Ã˜Â¯ Ã˜ÂªÃ˜Â¹Ã˜Â±Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¬Ã˜Â§Ã˜Â¹Ã˜Â© Ã˜Â¨Ã˜Â£Ã™â€ Ã™â€¡Ã˜Â§ Ã˜Â·Ã™â€žÃ˜Â¨ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã™â€¦Ã˜Â¨Ã™Æ’Ã˜Â±.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â³Ã˜Â·: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â©Ã˜Å’ Ã™Å Ã™ÂÃ™â€ Ã˜ÂµÃ˜Â­ Ã˜Â¨Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã™â€¡Ã˜Â§Ã˜Â¯Ã˜Â¦ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã™â€ Ã™â€¦Ã˜Â· Ã˜ÂªÃ™â€ Ã™â€¦Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Å’ Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¸Ã˜Â±.',
    ],
    incidentPlan: [
      'Ã˜Â·Ã™â€¦Ã˜Â£Ã™â€ Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§: Ã™â€žÃ˜Â§ Ã™â€žÃ™Ë†Ã™â€¦ Ã™Ë†Ã™â€žÃ˜Â§ Ã˜Â¹Ã™â€šÃ™Ë†Ã˜Â¨Ã˜Â© Ã™â€žÃ˜Â­Ã˜Â¸Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº.',
      'Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â©: Ã™â€žÃ™â€šÃ˜Â·Ã˜Â§Ã˜Âª Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â©Ã˜Å’ Ã˜Â£Ã˜Â³Ã™â€¦Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜ÂªÃ˜Å’ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã™â€šÃ™Å Ã˜Âª.',
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã™Ë†Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â©.',
      'Ã˜Â¶Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã™Ë†Ã˜ÂªÃ™â€šÃ™Å Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â±Ã˜Â¨Ã˜Â§Ã˜Â¡.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã™â€ Ã™ÂÃ˜Â³Ã™Å Ã˜Â© Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž 72 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©.',
    ],
  },
  {
    id: 'threat_exposure',
    title: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â²',
    icon: 'Ã°Å¸Å¡Â¨',
    severity: AlertSeverity.CRITICAL,
    severityColor: 'bg-red-700',
    symptoms: [
      'Ã˜Â®Ã™Ë†Ã™Â Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­ Ã˜Â¹Ã™â€ Ã˜Â¯ Ã™Ë†Ã˜ÂµÃ™Ë†Ã™â€ž Ã˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã™â€¦Ã™â€  Ã˜Â¬Ã™â€¡Ã˜Â© Ã˜Â¨Ã˜Â¹Ã™Å Ã™â€ Ã™â€¡Ã˜Â§.',
      'Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¡Ã˜Â§Ã˜ÂªÃ™Â Ã˜Â£Ã™Ë† Ã˜Â­Ã˜Â°Ã™Â Ã™â€¦Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã™â€¦Ã˜ÂªÃ˜Â³Ã˜Â§Ã˜Â±Ã˜Â¹.',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã™â€¦Ã˜Â§Ã™â€ž/Ã˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¨Ã˜Â±Ã˜Â± Ã˜Â£Ã™Ë† Ã˜ÂªÃ™Ë†Ã˜ÂªÃ˜Â± Ã˜Â­Ã˜Â§Ã˜Â¯.',
    ],
    lurePatterns: [
      'Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â«Ã™â€šÃ˜Â© Ã˜Â²Ã˜Â§Ã˜Â¦Ã™ÂÃ˜Â© Ã˜Â«Ã™â€¦ Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂµÃ™Ë†Ã˜Â± Ã˜Â£Ã™Ë† Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â©.',
      'Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â± Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â´Ã™â€¡Ã™Å Ã˜Â± Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â­Ã˜ÂµÃ™Ë†Ã™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â³.',
      'Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¡Ã˜Â¯Ã˜Â§Ã™Å Ã˜Â§ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â©.',
    ],
    prevention: [
      'Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â°Ã™â€¡Ã˜Â¨Ã™Å Ã˜Â©: Ã™â€žÃ˜Â§ Ã˜ÂµÃ™Ë†Ã˜Â± Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â©Ã˜Å’ Ã™â€žÃ˜Â§ Ã˜Â±Ã™â€¦Ã™Ë†Ã˜Â² Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€šÃ˜Å’ Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA) Ã™â€žÃ™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â¦Ã™Å Ã˜Â³Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â²Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ™ÂÃ™Ë†Ã˜Â±Ã™Å  Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ™â€ Ã˜Â²Ã™Â', action: 'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â®Ã˜Â·Ã˜Â© 10 Ã˜Â¯Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€š Ã˜Â¨Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€ž Ã™Ë†Ã˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ˜Â­Ã˜ÂµÃ™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª', action: 'Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â±Ã˜Å’ Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜ÂªÃ˜Å’ Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜Â´Ã™Ë†Ã™ÂÃ˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã™â€ Ã™ÂÃ˜Â³Ã™Å ', action: 'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜ÂªÃ™ÂÃ˜Â±Ã™Å Ã˜Âº Ã™â€šÃ™â€žÃ™â€šÃ˜Å’ Ã™Ë†Ã˜ÂªÃ˜Â£Ã™Æ’Ã™Å Ã˜Â¯ Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â°Ã™â€ Ã˜Â¨ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â±', action: 'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â³Ã™Å Ã˜Â§Ã˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã™Ë†Ã˜Â±Ã™ÂÃ˜Â¹ Ã™Ë†Ã˜Â¹Ã™Å  Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯',
        opener: 'Ã˜Â³Ã™â€žÃ˜Â§Ã™â€¦Ã˜ÂªÃ™Æ’ Ã˜Â£Ã™Ë†Ã™â€žÃ™â€¹Ã˜Â§. Ã™â€žÃ™â€  Ã™â€ Ã˜Â±Ã˜Â¯ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â£Ã™Å  Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯Ã˜Å’ Ã™Ë†Ã˜Â³Ã™â€ Ã˜ÂªÃ˜Â¹Ã˜Â§Ã™â€¦Ã™â€ž Ã˜Â±Ã˜Â³Ã™â€¦Ã™Å Ã™â€¹Ã˜Â§.',
        advice: 'Ã™â€žÃ˜Â§ Ã˜Â¯Ã™ÂÃ˜Â¹Ã˜Å’ Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶Ã˜Å’ Ã™â€žÃ˜Â§ Ã˜Â­Ã˜Â°Ã™Â Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š.',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€ ',
        opener: 'Ã™â€žÃ™â€  Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¬Ã™â€¡ Ã™â€¡Ã˜Â°Ã˜Â§ Ã™Ë†Ã˜Â­Ã˜Â¯Ã™Æ’Ã˜Å’ Ã˜Â³Ã™â€ Ã˜Â­Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã˜Â¶Ã™Ë†Ã˜Â¹ Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â© Ã˜Â¨Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â©.',
        advice: 'Ã˜Â£Ã˜Â¨Ã˜Â±Ã˜Â² Ã˜Â£Ã™â€  Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¶Ã˜Â­Ã™Å Ã˜Â© Ã™Ë†Ã™â€žÃ™Å Ã˜Â³ Ã™â€¦Ã˜Â°Ã™â€ Ã˜Â¨Ã™â€¹Ã˜Â§.',
      },
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã˜Â±Ã™Æ’ Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å ',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â¬Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¯Ã™â€žÃ™Å Ã™â€ž Ã˜Â«Ã™â€¦ Ã™â€ Ã˜Â¨Ã™â€žÃ™â€˜Ã˜Âº Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜ÂªÃ™â€¦Ã˜Â¯Ã˜Â© Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜ÂªÃ™Æ’.',
        advice: 'Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ™â€¡Ã™Ë†Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜Â¬Ã™â€¡Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã˜Â¯Ã˜Â¯Ã˜Â© Ã™â€¦Ã™â€¡Ã™â€¦ Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã˜Â§Ã˜Â­Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€ž Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯/Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±. Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â®Ã˜Â·Ã˜Â© 10 Ã˜Â¯Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€š Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ .',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â­Ã˜Â°Ã™Â Ã™â€¦Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«Ã˜Â§Ã˜Âª + Ã˜Â®Ã™Ë†Ã™Â + Ã˜Â·Ã™â€žÃ˜Â¨ Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Å’ Ã™Å Ã™â€žÃ˜Â²Ã™â€¦ Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã™ÂÃ™Ë†Ã˜Â±Ã™Å .',
    ],
    incidentPlan: [
      'Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶ Ã™Ë†Ã™â€žÃ˜Â§ Ã˜Â¯Ã™ÂÃ˜Â¹ Ã˜ÂªÃ˜Â­Ã˜Âª Ã˜Â£Ã™Å  Ã˜Â¶Ã˜ÂºÃ˜Â·.',
      'Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã˜ÂªÃ˜Â² Ã™Ë†Ã˜Â­Ã˜Â¸Ã˜Â±Ã™â€¡.',
      'Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª (Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± + Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA)).',
      'Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜ÂµÃ˜Â© Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã™â€žÃ™Å Ã˜Â©.',
    ],
  },
  {
    id: 'gaming',
    title: 'Ã˜Â¥Ã˜Â¯Ã™â€¦Ã˜Â§Ã™â€  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¨',
    icon: 'Ã°Å¸Å½Â®',
    severity: AlertSeverity.HIGH,
    severityColor: 'bg-indigo-600',
    symptoms: [
      'Ã˜Â³Ã™â€¡Ã˜Â± Ã™â€¦Ã™ÂÃ˜Â±Ã˜Â· Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â·Ã˜Â±Ã˜Â§Ã˜Â¨ Ã™â€ Ã™Ë†Ã™â€¦ Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±.',
      'Ã˜Â¹Ã˜ÂµÃ˜Â¨Ã™Å Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â³Ã˜Â­Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€¡Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Âª.',
      'Ã˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â¯Ã˜Â±Ã˜Â§Ã˜Â³Ã™Å  Ã™Ë†Ã˜Â§Ã™â€ Ã˜Â³Ã˜Â­Ã˜Â§Ã˜Â¨ Ã™â€¦Ã™â€  Ã˜Â£Ã™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å Ã˜Â©.',
    ],
    lurePatterns: [
      'Ã™â€¦Ã™Æ’Ã˜Â§Ã™ÂÃ˜Â¢Ã˜Âª Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â¨Ã™â€ Ã™Å  Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€šÃ™â€¹Ã˜Â§ Ã™â€šÃ™â€¡Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ˜Â£Ã˜ÂµÃ˜Â¯Ã™â€šÃ˜Â§Ã˜Â¡ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã™â€š Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â§Ã™ÂÃ˜Â³Ã™Å Ã˜Â©.',
      'Ã™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨Ã˜Â© Ã˜ÂªÃ˜Â¹Ã˜Â²Ã˜Â² Ã™â€¦Ã˜Â·Ã˜Â§Ã˜Â±Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â©.',
    ],
    prevention: [
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Bedtime Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å .',
      'Ã˜Â¬Ã˜Â¯Ã™Ë†Ã™â€žÃ˜Â© Ã™Ë†Ã™â€šÃ˜Âª Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨ Ã™Ë†Ã˜Â±Ã˜Â¨Ã˜Â·Ã™â€¡ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â©.',
      'Ã™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã˜Â¨Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â© Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â±.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã™â€¦', action: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã™Ë†Ã™â€šÃ˜Âª Ã™â€ Ã™Ë†Ã™â€¦ Ã™Ë†Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ™â€žÃ™Å Ã™â€žÃ™Å .' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜Â®Ã™ÂÃ˜Â¶ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å ', action: 'Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž 10%-15% Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å .' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å Ã˜Â©', action: 'Ã˜Â¥Ã˜Â¯Ã˜Â®Ã˜Â§Ã™â€ž Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â«Ã˜Â§Ã˜Â¨Ã˜Âª (Ã˜Â±Ã™Å Ã˜Â§Ã˜Â¶Ã˜Â©/Ã™â€¡Ã™Ë†Ã˜Â§Ã™Å Ã˜Â©).' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’', action: 'Ã™â€ Ã˜Â¸Ã˜Â§Ã™â€¦ Ã™â€¦Ã™Æ’Ã˜Â§Ã™ÂÃ˜Â¢Ã˜Âª Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â§Ã™â€žÃ˜ÂªÃ˜Â²Ã˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â³Ã™Å  Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å .' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â§Ã˜ÂªÃ™ÂÃ˜Â§Ã™â€š Ã™â€¦Ã™â€ Ã˜ÂµÃ™Â',
        opener: 'Ã˜Â£Ã™â€ Ã˜Â§ Ã™â€žÃ˜Â§ Ã˜Â£Ã˜Â±Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€žÃ˜Å’ Ã™ÂÃ™â€šÃ˜Â· Ã™â€ Ã˜Â­Ã˜ÂªÃ˜Â§Ã˜Â¬ Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€ Ã™â€¹Ã˜Â§ Ã™Å Ã˜Â­Ã™â€¦Ã™Å Ã™Æ’.',
        advice: 'Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â± Ã˜ÂµÃ™Å Ã˜ÂºÃ˜Â© Ã˜Â´Ã˜Â±Ã˜Â§Ã™Æ’Ã˜Â© Ã™â€žÃ˜Â§ Ã˜ÂµÃ™Å Ã˜ÂºÃ˜Â© Ã˜Â¹Ã™â€šÃ˜Â§Ã˜Â¨.',
      },
      {
        situation: 'Ã˜ÂªÃ™â€ Ã˜Â¸Ã™Å Ã™â€¦ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å ',
        opener: 'Ã˜Â®Ã™â€žÃ™â€˜Ã™â€ Ã˜Â§ Ã™â€ Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã˜Å’ Ã˜Â«Ã™â€¦ Ã™â€ Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â³Ã™Ë†Ã˜Â§ Ã˜Â§Ã™â€žÃ™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬.',
        advice: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å  Ã™Å Ã™â€ Ã˜Â¬Ã˜Â­ Ã˜Â£Ã™Æ’Ã˜Â«Ã˜Â± Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€šÃ˜Â·Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦.',
      },
      {
        situation: 'Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã˜Â§Ã˜Â±Ã˜Â©',
        opener: 'Ã™â€¦Ã™â€¡Ã˜Â§Ã˜Â±Ã˜ÂªÃ™Æ’ Ã™â€¦Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â²Ã˜Â©Ã˜Å’ Ã™Ë†Ã™â€ Ã˜Â±Ã™Å Ã˜Â¯Ã™â€¡Ã˜Â§ Ã˜ÂªÃ˜Â³Ã˜ÂªÃ™â€¦Ã˜Â± Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â£Ã™â€  Ã˜ÂªÃ˜Â¶Ã˜Â± Ã™â€ Ã™Ë†Ã™â€¦Ã™Æ’ Ã™Ë†Ã˜Â¯Ã˜Â±Ã˜Â§Ã˜Â³Ã˜ÂªÃ™Æ’.',
        advice: 'Ã˜Â§Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â¨Ã˜Â¶Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€ Ã™Ë†Ã™â€¦: Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜ÂªÃ˜Â£Ã˜Â®Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Å’ Ã™Å Ã™ÂÃ™â€ Ã˜ÂµÃ˜Â­ Ã˜Â¨Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã™â€¦.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å : Ã˜ÂªÃ˜Â¬Ã˜Â§Ã™Ë†Ã˜Â²Ã˜Â§Ã˜Âª Ã™Ë†Ã™â€šÃ˜Âª Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€ž Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ™â€¡Ã˜Â¯Ã˜Â¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ™Â Ã™Ë†Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã™ÂÃ™Å  Ã˜ÂµÃ˜Â¯Ã˜Â§Ã™â€¦ Ã™â€žÃ˜Â­Ã˜Â¸Ã™Å .',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã™â€¦ Ã™Ë†Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€¡Ã™â€žÃ˜Â§Ã™Æ’.',
      'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ Ã˜Â®Ã™ÂÃ˜Â¶ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å .',
      'Ã˜Â¥Ã˜Â¯Ã˜Â®Ã˜Â§Ã™â€ž Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã™Å Ã™Ë†Ã™â€¦Ã™Å .',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â±Ã™â€šÃ˜Â§Ã™â€¦ Ã™â€žÃ˜Â§ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â·Ã˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â§Ã˜Âª.',
    ],
  },
  {
    id: 'inappropriate_content',
    title: 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â§Ã˜Â³Ã˜Â¨',
    icon: 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â',
    severity: AlertSeverity.HIGH,
    severityColor: 'bg-violet-700',
    symptoms: [
      'Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦ Ã™â€žÃ™â€žÃ˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€šÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¨.',
      'Ã˜ÂªÃ˜ÂµÃ™ÂÃ˜Â­ Ã˜Â®Ã™ÂÃ™Å  Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã˜Â£Ã™Ë† Ã˜ÂªÃ˜Â§Ã˜Â±Ã™Å Ã˜Â® Ã™â€¦Ã˜Â­Ã˜Â°Ã™Ë†Ã™Â Ã˜Â¨Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â±.',
      'Ã˜ÂªÃ™Ë†Ã˜ÂªÃ˜Â± Ã˜Â£Ã™Ë† Ã˜Â®Ã˜Â¬Ã™â€ž Ã˜Â²Ã˜Â§Ã˜Â¦Ã˜Â¯ Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¯ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€ Ã˜ÂªÃ˜Â±Ã™â€ Ã˜Âª.',
    ],
    lurePatterns: [
      'Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã™â€¦Ã˜Â¶Ã™â€žÃ™â€žÃ˜Â© Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™ÂÃ™Å Ã˜Â¯Ã™Å Ã™Ë†Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜Â£Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¨.',
      'Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™ÂÃ˜Â¶Ã™Ë†Ã™â€žÃ™Å Ã˜Â© Ã˜ÂªÃ™â€ Ã˜Â´Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â§Ã˜Â¯ Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€¦Ã˜Â© Ã˜Â¨Ã˜Â¹Ã™â€ Ã˜Â§Ã™Ë†Ã™Å Ã™â€  Ã˜Â¨Ã˜Â±Ã™Å Ã˜Â¦Ã˜Â©.',
      'Ã™â€ Ã™Ë†Ã˜Â§Ã™ÂÃ˜Â° Ã™â€¦Ã™â€ Ã˜Â¨Ã˜Â«Ã™â€šÃ˜Â© Ã˜ÂªÃ˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â¬ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ Ã˜Â¨Ã™Å Ã˜Â¦Ã˜Â© Ã˜Â¢Ã™â€¦Ã™â€ Ã˜Â©.',
    ],
    prevention: [
      'SafeSearch + DNS Ã™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â© Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã˜Â±.',
      'Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€¦Ã˜Â© Ã™â€¦Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹/Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã™ÂÃ™â€šÃ˜Â·.',
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â£Ã˜Â³Ã˜Â±Ã™Å Ã˜Â© Ã˜Â«Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â©: Ã˜Â£Ã˜ÂºÃ™â€žÃ™â€š Ã™Ë†Ã˜Â¨Ã™â€žÃ™â€˜Ã˜Âº Ã˜Â¨Ã™â€žÃ˜Â§ Ã˜Â¹Ã™â€šÃ™Ë†Ã˜Â¨Ã˜Â©.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â©', action: 'Ã˜ÂªÃ™â€šÃ™Ë†Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜Â§Ã˜ÂªÃ˜Â± Ã™Ë†Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜Â´Ã™Ë†Ã™ÂÃ˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â±Ã˜Â¨Ã™Ë†Ã™Å ', action: 'Ã™â€ Ã™â€šÃ˜Â§Ã˜Â´ Ã˜Â¢Ã™â€¦Ã™â€  Ã˜Â¹Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ˜ÂµÃ˜Â§Ã˜Â¯Ã™â€¦ Ã™Ë†Ã˜Â·Ã˜Â±Ã™â€š Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¨Ã™â€žÃ™Å Ã˜Âº.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜ÂµÃ˜Â­Ã™Å Ã˜Â©', action: 'Ã˜Â¥Ã˜Â­Ã™â€žÃ˜Â§Ã™â€ž Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã™â€¦Ã™â€ Ã˜Â§Ã˜Â³Ã˜Â¨ Ã™â€žÃ™â€žÃ˜Â¹Ã™â€¦Ã˜Â± Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â©', action: 'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶Ã˜Â§Ã˜Âª Ã™Ë†Ã˜ÂªÃ˜Â¹Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â¨Ã˜Â·.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â®Ã™Ë†Ã™Â',
        opener: 'Ã™â€žÃ™Ë† Ã˜Â¸Ã™â€¡Ã˜Â± Ã˜Â´Ã™Å Ã˜Â¡ Ã™â€¦Ã˜Â²Ã˜Â¹Ã˜Â¬Ã˜Å’ Ã˜Â£Ã˜ÂºÃ™â€žÃ™â€šÃ™â€¡ Ã™Ë†Ã˜ÂªÃ˜Â¹Ã˜Â§Ã™â€ž Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â©Ã˜Å’ Ã™â€¦Ã˜Â§ Ã™ÂÃ™Å Ã™â€¡ Ã˜Â¹Ã™â€šÃ˜Â§Ã˜Â¨.',
        advice: 'Ã˜Â£Ã˜Â²Ã™â€ž Ã™Ë†Ã˜ÂµÃ™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¹Ã˜ÂªÃ˜Â±Ã˜Â§Ã™Â Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã˜Â§Ã™Å Ã˜Â©.',
      },
      {
        situation: 'Ã˜ÂªÃ™Ë†Ã˜Â¬Ã™Å Ã™â€¡ Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å ',
        opener: 'Ã™â€ Ã˜Â¹Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â³Ã™Ë†Ã˜Â§ Ã˜Â­Ã˜ÂªÃ™â€° Ã™â€¦Ã˜Â§ Ã™Å Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã˜Â§Ã™â€žÃ™Ë†Ã˜ÂµÃ™Ë†Ã™â€ž Ã™â€žÃ™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€°.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã™Å Ã™â€ Ã˜ÂªÃ™â€¡Ã™Å  Ã˜Â¨Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â© Ã˜ÂªÃ™â€šÃ™â€ Ã™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©.',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©',
        opener: 'Ã˜Â£Ã™Å  Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜ÂºÃ˜Â±Ã™Å Ã˜Â¨ Ã˜Â£Ã™Ë† Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€¦: Ã™â€žÃ˜Â§ Ã™ÂÃ˜ÂªÃ˜Â­Ã˜Å’ Ã™ÂÃ™â€šÃ˜Â· Ã˜Â¨Ã™â€žÃ™â€˜Ã˜Âº.',
        advice: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å  Ã™Å Ã˜Â¨Ã™â€ Ã™Å  Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€ .',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€°: Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â§Ã˜Âª Ã™Ë†Ã˜ÂµÃ™Ë†Ã™â€ž Ã™â€žÃ˜ÂªÃ˜ÂµÃ™â€ Ã™Å Ã™ÂÃ˜Â§Ã˜Âª Ã™â€¦Ã˜Â­Ã˜Â¬Ã™Ë†Ã˜Â¨Ã˜Â© Ã˜Â£Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜ÂªÃ˜Â§Ã˜Â¯.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™Ë†Ã™â€šÃ˜Â§Ã˜Â¦Ã™Å : Ã™Å Ã™ÂÃ™â€ Ã˜ÂµÃ˜Â­ Ã˜Â¨Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã™â€¦Ã˜Â±Ã˜Â´Ã˜Â­Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã™â€žÃ™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã˜Â±.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â¨Ã˜Â¨ (Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â·/Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨/Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š).',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜Â§Ã˜ÂªÃ˜Â± Ã™Ë†Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â­Ã˜Â« Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€¦Ã™â€ .',
      'Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã™â€šÃ˜ÂµÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€žÃ™Ë†Ã™â€¦.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€¦Ã˜Â© Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â¢Ã™â€¦Ã™â€ Ã˜Â© Ã™â€žÃ™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€°.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© 7 Ã˜Â£Ã™Å Ã˜Â§Ã™â€¦ Ã™â€žÃ™â€šÃ™Å Ã˜Â§Ã˜Â³ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â±.',
    ],
  },
  {
    id: 'cyber_crime',
    title: 'Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â­Ã˜Â±Ã˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â¨Ã˜Â±Ã˜Â§Ã™â€ Ã™Å ',
    icon: 'Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸â€™Â»',
    severity: AlertSeverity.HIGH,
    severityColor: 'bg-slate-800',
    symptoms: [
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã˜Â¨Ã˜ÂµÃ™Å Ã˜ÂºÃ˜Â© Ã™â€¡Ã˜Â¬Ã™Ë†Ã™â€¦Ã™Å Ã˜Â©.',
      'Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â¹Ã™â€  Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€š Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â§Ã˜Â¹Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â±Ã™â€¡ Ã˜Â¥Ã™â€ Ã˜Â¬Ã˜Â§Ã˜Â²Ã™â€¹Ã˜Â§.',
      'Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¡Ã™Ë†Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã™â€¦Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Âº Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã˜Â¨Ã˜Â±Ã˜Â± Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å .',
    ],
    lurePatterns: [
      'Ã™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜ÂªÃ™â€šÃ˜Â¯Ã™â€¦ Ã˜Â³Ã™Æ’Ã˜Â±Ã˜Â¨Ã˜ÂªÃ˜Â§Ã˜Âª Ã˜Â¬Ã˜Â§Ã™â€¡Ã˜Â²Ã˜Â© Ã˜Â¨Ã˜Â¯Ã˜Â§Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¶Ã™Ë†Ã™â€ž.',
      'Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å  Ã™â€¦Ã™â€¡Ã˜Â§Ã™â€¦ Ã˜ÂªÃ˜Â®Ã˜Â±Ã™Å Ã˜Â¨Ã™Å Ã˜Â© Ã™Æ’Ã™â€¦Ã™â€ Ã˜Â§Ã™ÂÃ˜Â³Ã˜Â©.',
      'Ã˜ÂªÃ˜Â­Ã™ÂÃ™Å Ã˜Â² Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â­Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ™â€šÃ™Ë†Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å Ã˜Â© Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž Ã™Æ’Ã˜Â³Ã˜Â± Ã˜Â§Ã™â€žÃ™â€šÃ™Ë†Ã˜Â§Ã™â€ Ã™Å Ã™â€ .',
    ],
    prevention: [
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â©.',
      'Ã˜Â´Ã˜Â±Ã˜Â­ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã™â€š Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã™â€ Ã™Å  Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å  Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â¯Ã™Å .',
      'Ã˜ÂªÃ™Ë†Ã˜Â¬Ã™Å Ã™â€¡ Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€¡Ã˜Â¨Ã˜Â© Ã˜Â¥Ã™â€žÃ™â€° Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª CTF Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€¦Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â¥Ã˜Â´Ã˜Â±Ã˜Â§Ã™Â.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’', action: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â².' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å ', action: 'Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â£Ã˜Â®Ã™â€žÃ˜Â§Ã™â€šÃ™Å  Ã™â€žÃ™â€žÃ˜Â£Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â¨Ã˜Â±Ã˜Â§Ã™â€ Ã™Å .' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã™Ë†Ã˜Â¹Ã™Å  Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å ', action: 'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â¹Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¨ Ã˜Â¬Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© Ã™â€¦Ã˜Â¨Ã˜Â³Ã˜Â·Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â²Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±', action: 'Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜ÂªÃ™â€šÃ™â€ Ã™Å Ã˜Â© Ã˜Â®Ã˜Â§Ã˜Â¶Ã˜Â¹Ã˜Â© Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â©.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â¬Ã™Å Ã™â€¡ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã˜Â§Ã˜Â±Ã˜Â©',
        opener: 'Ã˜Â°Ã™Æ’Ã˜Â§Ã˜Â¤Ã™Æ’ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å  Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Å’ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ™â€¡ Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã˜Â­Ã˜ÂªÃ˜Â±Ã˜Â§Ã™ÂÃ™Å  Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å .',
        advice: 'Ã˜Â§Ã˜Â¹Ã˜ÂªÃ˜Â±Ã™Â Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€¡Ã˜Â¨Ã˜Â© Ã˜Â£Ã™Ë†Ã™â€žÃ™â€¹Ã˜Â§ Ã˜Â«Ã™â€¦ Ã˜Â£Ã˜Â¹Ã˜Â¯ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã™Å Ã™â€¡Ã™â€¡Ã˜Â§.',
      },
      {
        situation: 'Ã˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©',
        opener: 'Ã˜Â£Ã™Å  Ã™â€¡Ã˜Â¬Ã™Ë†Ã™â€¦ Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã™â€šÃ˜Â¯ Ã™Å Ã˜ÂµÃ˜Â¨Ã˜Â­ Ã™â€šÃ˜Â¶Ã™Å Ã˜Â© Ã˜Â¬Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â¤Ã˜Â«Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â¨Ã™â€žÃ™Æ’.',
        advice: 'Ã™Ë†Ã˜Â¶Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â¹Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¨ Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜ÂªÃ™â€¡Ã™Ë†Ã™Å Ã™â€ž Ã˜Â¹Ã˜Â§Ã˜Â·Ã™ÂÃ™Å .',
      },
      {
        situation: 'Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž',
        opener: 'Ã™â€ Ã˜Â®Ã˜ÂªÃ˜Â§Ã˜Â± Ã™â€¦Ã˜Â¹Ã™â€¹Ã˜Â§ Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å Ã˜Â© Ã™Ë†Ã™â€ Ã˜Â¨Ã™â€ Ã™Å  Ã™â€¦Ã™â€¡Ã˜Â§Ã˜Â±Ã˜Â§Ã˜ÂªÃ™Æ’ Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã˜Â¢Ã™â€¦Ã™â€ .',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å  Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™Ë†Ã˜Â¯Ã˜Â© Ã™â€žÃ™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å : Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜ÂªÃ™â€šÃ™â€ Ã™Å  Ã™â€¡Ã˜Â¬Ã™Ë†Ã™â€¦Ã™Å  Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™Å Ã˜Â­Ã˜ÂªÃ˜Â§Ã˜Â¬ Ã˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â¬Ã™Å Ã™â€¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å .',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜ÂªÃ™â€šÃ™â€ Ã™Å : Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã™Ë†Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â± Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â©.',
      'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â¶Ã™Å Ã˜Â­ Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å  Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.',
      'Ã˜Â¥Ã˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â£Ã˜Â®Ã™â€žÃ˜Â§Ã™â€šÃ™Å  Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â²Ã˜Â§Ã™â€¦ Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â©.',
    ],
  },
  {
    id: 'phishing_links',
    title: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ™Å Ã˜Â¯ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â¨Ã™Å Ã˜Â«Ã˜Â©',
    icon: 'Ã°Å¸â€â€”',
    severity: AlertSeverity.CRITICAL,
    severityColor: 'bg-cyan-700',
    symptoms: [
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â¨Ã˜Â§Ã™â€ž Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã™â€¦Ã˜Â®Ã˜ÂªÃ˜ÂµÃ˜Â±Ã˜Â© Ã˜Â£Ã™Ë† Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â§Ã˜Âª Ã˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â£Ã™â€žÃ™Ë†Ã™ÂÃ˜Â© Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±.',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â±Ã™â€¦Ã™Ë†Ã˜Â² Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã˜Â£Ã™Ë† Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â© Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã˜Â¨Ã˜Â­Ã˜Â¬Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.',
      'Ã˜Â®Ã˜Â±Ã™Ë†Ã˜Â¬ Ã™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Ë†Ã™ÂÃ˜Â©.',
    ],
    lurePatterns: [
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â¹Ã˜Â§Ã˜Â¬Ã™â€žÃ˜Â© Ã˜ÂªÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹.',
      'Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â© Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â¨Ã™â€¡Ã˜Â© Ã™â€žÃ™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â±Ã™Ë†Ã™ÂÃ˜Â©.',
      'Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â¬Ã™Ë†Ã˜Â§Ã˜Â¦Ã˜Â²/Ã™â€¡Ã˜Â¯Ã˜Â§Ã™Å Ã˜Â§ Ã˜ÂªÃ™â€šÃ™Ë†Ã˜Â¯ Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â¬Ã™â€¦Ã˜Â¹ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.',
    ],
    prevention: [
      'Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â«Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â©: Ã™â€žÃ˜Â§ Ã™ÂÃ˜ÂªÃ˜Â­ Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â© Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€ž.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA) Ã™Ë†Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â±Ã™â€¦Ã™Ë†Ã˜Â² Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã˜Â·Ã™â€žÃ™â€šÃ˜Â§Ã™â€¹.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜Â¯Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜Â¯Ã™Å  Ã˜Â¥Ã˜Â¯Ã˜Â®Ã˜Â§Ã™â€ž Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã™ÂÃ™Å  Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â©.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å ', action: 'Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â·Ã˜Å’ Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â±Ã˜Å’ Ã™Ë†Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ˜Â­Ã˜ÂµÃ™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª', action: 'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA) Ã™â€žÃ™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¹Ã™Å ', action: 'Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å  Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â±Ã™Å Ã˜Â¯.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â±', action: 'Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€¦Ã˜Â© Ã™â€ Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã™â€¦Ã˜Â­Ã˜Â¸Ã™Ë†Ã˜Â±Ã˜Â© Ã™Ë†Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¨Ã˜Â§Ã™â€šÃ™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜Â£Ã˜Â³Ã˜Â±Ã˜Â©.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â±Ã˜Â±',
        opener: 'Ã™â€žÃ™â€  Ã™â€ Ã™ÂÃ˜ÂªÃ˜Â­ Ã˜Â£Ã™Å  Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â¬Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ . Ã˜Â³Ã™â€ Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã™â€¦Ã˜Â¹Ã˜Â§Ã™â€¹ Ã˜Â¨Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©.',
        advice: 'Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â·Ã™â€¦Ã˜Â£Ã™â€ Ã˜Â© Ã˜Â«Ã™â€¦ Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€šÃ™â€ž Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â© Ã™â€žÃ™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å .',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨',
        opener: 'Ã˜Â³Ã™â€ Ã˜ÂºÃ™Å Ã™â€˜Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã™â€ Ã™ÂÃ˜Â¹Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å  Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹ Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜ÂªÃ™Æ’.',
        advice: 'Ã˜Â§Ã˜Â¬Ã˜Â¹Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â´Ã˜Â±Ã™Å Ã™Æ’Ã˜Â§Ã™â€¹ Ã™ÂÃ™Å  Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™â€žÃ˜Â§ Ã™â€¦Ã˜Â¬Ã˜Â±Ã˜Â¯ Ã™â€¦Ã˜ÂªÃ™â€žÃ™â€šÃ™Å  Ã˜Â£Ã™Ë†Ã˜Â§Ã™â€¦Ã˜Â±.',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â¹Ã˜Â²Ã™Å Ã˜Â² Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’',
        opener: 'Ã˜Â£Ã™Å  Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã™Å Ã˜Â·Ã™â€žÃ˜Â¨ Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â© Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã˜Â£Ã™Ë† Ã˜Â±Ã™â€¦Ã˜Â² Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™Å Ã˜Â¹Ã˜ÂªÃ˜Â¨Ã˜Â± Ã™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â§Ã™â€¹ Ã˜Â­Ã˜ÂªÃ™â€° Ã™Å Ã˜Â«Ã˜Â¨Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã™Æ’Ã˜Â³.',
        advice: 'Ã™Æ’Ã˜Â±Ã™â€˜Ã˜Â± Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â§Ã™â€¹ Ã˜Â­Ã˜ÂªÃ™â€° Ã˜ÂªÃ˜ÂªÃ˜Â­Ã™Ë†Ã™â€ž Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â«Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â©.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã™â€ Ã™â€¦Ã˜Â· Ã˜ÂªÃ˜ÂµÃ™Å Ã˜Â¯/Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â®Ã˜Â¨Ã™Å Ã˜Â«Ã˜Â© Ã™â€¦Ã˜Â±Ã˜ÂµÃ™Ë†Ã˜Â¯. Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã™Ë†Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Â Ã˜ÂªÃ˜Â¯Ã™Ë†Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã™â€  Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã™ÂÃ˜ÂªÃ˜Â­ Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹.',
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™â€žÃ™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜Â£Ã˜Â«Ã˜Â±Ã˜Â©.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA) Ã™Ë†Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â©.',
      'Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜ÂµÃ™â€žÃ™Å Ã˜Â© Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â°Ã™Â.',
      'Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã˜Â¹Ã™â€  Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ™Å Ã˜Â¯.',
    ],
  },
  {
    id: 'crypto_scams',
    title: 'Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å ',
    icon: 'Ã°Å¸â€™Â¸',
    severity: AlertSeverity.MEDIUM,
    severityColor: 'bg-amber-600',
    symptoms: [
      'Ã˜Â§Ã™â€ Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã™â€¡ Ã˜Â£Ã˜Â±Ã˜Â¨Ã˜Â§Ã˜Â­ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™ÂÃ™â€¡Ã™Ë†Ã™â€¦Ã˜Â©.',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦ Ã™â€žÃ˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â©.',
      'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã™Ë†Ã™Å Ã˜Â¬ Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â«Ã™â€¦Ã˜Â§Ã˜Â± Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â£Ã˜ÂµÃ˜Â¯Ã™â€šÃ˜Â§Ã˜Â¡.',
    ],
    lurePatterns: [
      'Ã™Ë†Ã˜Â¹Ã™Ë†Ã˜Â¯ Ã˜Â¨Ã˜Â¹Ã™Ë†Ã˜Â§Ã˜Â¦Ã˜Â¯ Ã™â€¦Ã˜Â¶Ã™â€¦Ã™Ë†Ã™â€ Ã˜Â© Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž Ã™Ë†Ã™â€šÃ˜Âª Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±.',
      'Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Airdrop/Ã™â€¦Ã˜Â­Ã˜Â§Ã™ÂÃ˜Â¸ Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â©.',
      'Ã˜Â¶Ã˜ÂºÃ˜Â· Ã™â€¦Ã™â€  Ã™â€¦Ã˜Â¤Ã˜Â«Ã˜Â±Ã™Å Ã™â€  Ã˜Â£Ã™Ë† Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â©.',
    ],
    prevention: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â£Ã™Å  Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â¨Ã™â€žÃ˜Â§ Ã™â€¦Ã™Ë†Ã˜Â§Ã™ÂÃ™â€šÃ˜Â© Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â±.',
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â©.',
      'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€¦ Ã™â€šÃ™Ë†Ã˜Â§Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â§Ã˜Â³Ã™Å .',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜ÂªÃ˜Â¬Ã™â€¦Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±', action: 'Ã™Ë†Ã™â€šÃ™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™ÂÃ™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜ÂªÃ™â€¦Ã˜Â¯Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ™â€ Ã˜Â¸Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â±', action: 'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜Â¯Ã™â€šÃ™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â·.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¹Ã™Å ', action: 'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã™Ë†Ã˜Â¹Ã™Å  Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã™â€žÃ™â€žÃ˜Â£Ã˜Â³Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â£Ã™â€¦Ã˜Â«Ã™â€žÃ˜Â© Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž Ã˜Â´Ã˜Â§Ã˜Â¦Ã˜Â¹Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜Â¶Ã˜Â¨Ã˜Â· Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€¦', action: 'Ã˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â´Ã™â€¡Ã˜Â±Ã™Å Ã˜Â© Ã™Ë†Ã˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â©.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜ÂªÃ˜ÂµÃ˜Â­Ã™Å Ã˜Â­ Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ™â€¡Ã™Ë†Ã™â€¦',
        opener: 'Ã˜Â£Ã™Å  Ã˜Â±Ã˜Â¨Ã˜Â­ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹ Ã™â€¦Ã˜Â¶Ã™â€¦Ã™Ë†Ã™â€  Ã˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã™â€¹Ã˜Â§ Ã˜Â®Ã˜Â·Ã˜Â±Ã˜Å’ Ã˜Â®Ã™â€žÃ™â€ Ã˜Â§ Ã™â€ Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â©.',
        advice: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Æ’Ã˜Â±Ã˜Â© Ã˜ÂªÃ™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â±Ã˜Â·.',
      },
      {
        situation: 'Ã˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â±Ã˜Â©',
        opener: 'Ã˜Â£Ã™Å  Ã™â€¦Ã˜Â¹Ã˜Â§Ã™â€¦Ã™â€žÃ˜Â© Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã™â€žÃ˜Â§Ã˜Â²Ã™â€¦ Ã˜ÂªÃ™â€¦Ã˜Â± Ã˜Â¨Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â±.',
        advice: 'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š.',
      },
      {
        situation: 'Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â¢Ã™â€¦Ã™â€ Ã˜Â©',
        opener: 'Ã™â€ Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â«Ã™â€¦Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂµÃ˜Â­Ã™Å Ã˜Â­ Ã™â€¦Ã™â€  Ã™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã˜Â¨Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â´Ã™Ë†Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â©.',
        advice: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¨Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã˜Â±Ã˜Â¯ Ã˜Â¨Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â§Ã™â€žÃ™Å : Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã˜Â¹Ã˜ÂªÃ™Å Ã˜Â§Ã˜Â¯Ã™Å  Ã™Å Ã˜Â­Ã˜ÂªÃ˜Â§Ã˜Â¬ Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž: Ã˜Â±Ã˜ÂµÃ˜Â¯ Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž Ã™â€¦Ã˜Â¹ Ã™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â±Ã˜Â¨Ã˜Â­ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹ Ã™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â©.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â£Ã™Å  Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â© Ã˜Â¯Ã™ÂÃ˜Â¹ Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°.',
      'Ã˜Â­Ã˜ÂµÃ˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ™Ë†Ã˜Â±Ã˜Â·Ã˜Â©.',
      'Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã™Ë†Ã˜Â³Ã™Å Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â©.',
      'Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â©/Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€ Ã™Æ’ Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â©.',
      'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â© Ã™â€žÃ™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
    ],
  },
  {
    id: 'self_harm',
    title: 'Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³',
    icon: 'Ã°Å¸â€ Ëœ',
    severity: AlertSeverity.CRITICAL,
    severityColor: 'bg-rose-700',
    symptoms: [
      'Ã˜Â¹Ã˜Â¨Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã™Å Ã˜Â£Ã˜Â³ Ã˜Â£Ã™Ë† Ã™Æ’Ã˜Â±Ã˜Â§Ã™â€¡Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜Â°Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±.',
      'Ã˜Â§Ã™â€ Ã˜Â¹Ã˜Â²Ã˜Â§Ã™â€ž Ã˜Â­Ã˜Â§Ã˜Â¯ Ã™Ë†Ã˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â©.',
      'Ã˜Â¨Ã˜Â­Ã˜Â« Ã˜Â£Ã™Ë† Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã™Å Ã˜Â¤Ã˜Â°Ã™Å  Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³.',
    ],
    lurePatterns: [
      'Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜ÂªÃ™â€¦Ã˜Â¬Ã™â€˜Ã˜Â¯ Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â§Ã˜Âª.',
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜ÂªÃ˜Â´Ã˜Â¬Ã˜Â¹ Ã˜Â¹Ã™â€žÃ™â€° Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¤Ã˜Â°Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™Å Ã˜Â§Ã˜Â¦Ã˜Â³ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â£Ã™â€ Ã™â€¡ Ã˜Â­Ã™â€ž Ã™â€žÃ™â€žÃ™â€¦Ã˜Â´Ã˜Â§Ã˜Â¹Ã˜Â±.',
    ],
    prevention: [
      'Ã˜Â±Ã™ÂÃ˜Â¹ Ã™â€¦Ã˜Â³Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â© Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³.',
      'Ã™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¨Ã™â€žÃ˜Â§ Ã™â€žÃ™Ë†Ã™â€¦.',
      'Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã˜Â£Ã˜Â³Ã˜Â±Ã™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â© Ã™â€žÃ™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â±Ã˜Â¬Ã˜Â©.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™ÂÃ™Ë†Ã˜Â±Ã™Å ', action: 'Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© + Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¯ Ã˜Â£Ã˜Â³Ã˜Â±Ã™Å  Ã™â€šÃ˜Â±Ã™Å Ã˜Â¨ + Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã™â€žÃ˜ÂµÃ™Å Ã™â€šÃ˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ™ÂÃ˜Â±Ã™Å Ã˜Âº Ã˜Â§Ã™â€žÃ˜Â¶Ã˜ÂºÃ™Ë†Ã˜Â·', action: 'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã™â€¦Ã™â€ Ã˜Â¸Ã™â€¦Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â­Ã™ÂÃ˜Â²Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã™â€¡Ã™Ë†Ã˜Â±.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜ÂªÃ™Å Ã™â€ ', action: 'Ã˜ÂªÃ™â€ Ã˜Â¸Ã™Å Ã™â€¦ Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã™â€¦ Ã™Ë†Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™â€ Ã™Å  Ã™Ë†Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â²Ã™â€žÃ˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ™Æ’Ã˜Â§Ã˜Â³', action: 'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã˜Â¯Ã™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â®Ã˜Â·Ã˜Â© Ã˜ÂªÃ˜Â­Ã˜Â°Ã™Å Ã˜Â± Ã™â€¦Ã˜Â¨Ã™Æ’Ã˜Â±.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡',
        opener: 'Ã˜Â³Ã™â€žÃ˜Â§Ã™â€¦Ã˜ÂªÃ™Æ’ Ã˜Â£Ã™â€¡Ã™â€¦ Ã™â€¦Ã™â€  Ã˜Â£Ã™Å  Ã˜Â´Ã™Å Ã˜Â¡Ã˜Å’ Ã™Ë†Ã˜Â£Ã™â€ Ã˜Â§ Ã™â€¡Ã™â€ Ã˜Â§ Ã™â€¦Ã˜Â¹Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ .',
        advice: 'Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¯ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¹Ã™â€žÃ™Å  Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã™â€ Ã™â€šÃ˜Â§Ã˜Â´ Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€žÃ™Å .',
      },
      {
        situation: 'Ã™ÂÃ˜ÂªÃ˜Â­ Ã˜Â§Ã™â€žÃ˜Â­Ã™Ë†Ã˜Â§Ã˜Â±',
        opener: 'Ã™â€žÃ™Ë† Ã™ÂÃ™Å  Ã˜Â£Ã™ÂÃ™Æ’Ã˜Â§Ã˜Â± Ã™â€¦Ã˜Â¤Ã˜Â°Ã™Å Ã˜Â©Ã˜Å’ Ã˜ÂªÃ™Æ’Ã™â€žÃ™â€¦ Ã™â€¦Ã˜Â¹Ã™Å  Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§ Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â®Ã™Ë†Ã™Â Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€šÃ˜Â§Ã˜Â¨.',
        advice: 'Ã˜Â®Ã™ÂÃ™â€˜Ã˜Â¶ Ã™â€ Ã˜Â¨Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã™Æ’Ã™â€¦ Ã™Ë†Ã˜Â±Ã™Æ’Ã™â€˜Ã˜Â² Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹.',
      },
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â¤Ã™Ë†Ã™â€ž',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â¯Ã˜Â¹Ã™â€¦Ã™â€¹Ã˜Â§ Ã™â€¦Ã˜Â®Ã˜ÂªÃ˜ÂµÃ™â€¹Ã˜Â§ Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜ÂªÃ™Æ’Ã˜Å’ Ã™Ë†Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â¯Ã™â€žÃ™Å Ã™â€ž Ã™â€šÃ™Ë†Ã˜Â©.',
        advice: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Æ’Ã˜Â± Ã˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ˜Â¸Ã˜Â§Ã˜Â±.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬ Ã˜Â¬Ã˜Â¯Ã˜Â§Ã™â€¹: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³ Ã˜ÂªÃ˜ÂªÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€žÃ™â€¹Ã˜Â§ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã™â€žÃ˜ÂµÃ™Å Ã™â€šÃ˜Â©.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§ Ã™Ë†Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã˜ÂªÃ˜Â±Ã™Æ’Ã™â€¡ Ã™â€¦Ã™â€ Ã™ÂÃ˜Â±Ã˜Â¯Ã™â€¹Ã˜Â§ Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹.',
      'Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â©/Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â±Ã˜Â¶Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â°Ã™â€°.',
      'Ã™ÂÃ˜ÂªÃ˜Â­ Ã™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â± Ã™Ë†Ã™â€¡Ã˜Â§Ã˜Â¯Ã˜Â¦ Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
      'Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â§Ã˜Â³Ã™Å Ã˜Â©.',
      'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯ Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜Âµ Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã™â€ Ã™ÂÃ˜Â³Ã™Å  Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã˜Â¹Ã˜Â§Ã˜Â¬Ã™â€ž Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â±Ã™Ë†Ã˜Â±Ã˜Â©.',
    ],
  },
  {
    id: 'sexual_exploitation',
    title: 'Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€ Ã˜Â³Ã™Å ',
    icon: 'Ã°Å¸Å¡Â«',
    severity: AlertSeverity.CRITICAL,
    severityColor: 'bg-fuchsia-700',
    symptoms: [
      'Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â³Ã˜Â±Ã™Å  Ã™â€¦Ã˜Â¹ Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â£Ã™Æ’Ã˜Â¨Ã˜Â± Ã˜Â¹Ã™â€¦Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂµÃ™Ë†Ã˜Â± Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â© Ã˜Â£Ã™Ë† Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â© Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â©.',
      'Ã˜Â®Ã™Ë†Ã™Â Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­ Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™â€¦Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«Ã˜Â§Ã˜Âª Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â© Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â©.',
    ],
    lurePatterns: [
      'Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â«Ã™â€šÃ˜Â© Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹ Ã˜Â«Ã™â€¦ Ã˜Â·Ã™â€žÃ˜Â¨ Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â®Ã˜Â§Ã˜Âµ.',
      'Ã™Ë†Ã˜Â¹Ã™Ë†Ã˜Â¯ Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¨ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â¹Ã™â€¦ Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â± Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â¬Ã™â€¦Ã˜Â¹ Ã˜ÂµÃ™Ë†Ã˜Â±/Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª.',
    ],
    prevention: [
      'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â±Ã˜Â¨Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™ÂÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¶Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€¦ Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©: Ã™â€žÃ˜Â§ Ã˜ÂµÃ™Ë†Ã˜Â± Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â©Ã˜Å’ Ã™â€žÃ˜Â§ Ã˜Â£Ã˜Â³Ã˜Â±Ã˜Â§Ã˜Â± Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â±Ã˜Â¨Ã˜Â§Ã˜Â¡.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â¯Ã™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â±Ã˜Â¯Ã˜Â´Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â¹Ã˜Â§Ã˜Â¬Ã™â€ž', action: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž + Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© + Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã˜Â±Ã™â€šÃ™â€¦Ã™Å ', action: 'Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA) Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã™â€ Ã™ÂÃ˜Â³Ã™Å ', action: 'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜ÂªÃ˜Â¹Ã˜Â§Ã™â€žÃ˜Â¬ Ã˜Â§Ã™â€žÃ˜Â°Ã™â€ Ã˜Â¨ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â®Ã™Ë†Ã™Â.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â±', action: 'Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã™â€¦Ã˜Â®Ã˜ÂµÃ˜ÂµÃ˜Â©.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â°Ã™â€ Ã˜Â¨',
        opener: 'Ã˜Â£Ã™â€ Ã˜Âª Ã™â€žÃ˜Â³Ã˜Âª Ã™â€¦Ã˜Â°Ã™â€ Ã˜Â¨Ã™â€¹Ã˜Â§Ã˜Å’ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â¤Ã™Ë†Ã™â€žÃ™Å Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã™â€  Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ™Æ’.',
        advice: 'Ã˜Â«Ã˜Â¨Ã™â€˜Ã˜Âª Ã˜Â£Ã™â€  Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¶Ã˜Â­Ã™Å Ã˜Â© Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å Ã˜Â©.',
      },
      {
        situation: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž',
        opener: 'Ã˜Â³Ã™â€ Ã™Ë†Ã™â€šÃ™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€  Ã™Ë†Ã™â€ Ã˜Â­Ã™ÂÃ˜Â¸ Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã˜Â­Ã˜Â°Ã™Â.',
        advice: 'Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶ Ã™Ë†Ã™â€žÃ˜Â§ Ã˜Â±Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â§Ã™â€ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.',
      },
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™â€¦Ã™Å Ã˜Â©',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™â€¦Ã™Å Ã˜Â© Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜ÂªÃ™Æ’ Ã™Ë†Ã™â€¦Ã˜Â­Ã˜Â§Ã˜Â³Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â·Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â°Ã™Å .',
        advice: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â¯Ã™â€šÃ™Å Ã™â€š Ã™Å Ã˜Â³Ã˜Â±Ã™â€˜Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™â€¦Ã™Å Ã˜Â©.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬/Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å  Ã™â€¦Ã˜Â±Ã˜ÂµÃ™Ë†Ã˜Â¯Ã˜Â©.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™Ë†Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº.',
    ],
    incidentPlan: [
      'Ã™â€šÃ˜Â·Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â°Ã™Å  Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã˜Â­Ã™ÂÃ˜Â¸ Ã™â€¦Ã˜Â¹Ã˜Â±Ã™ÂÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã™â€šÃ™Å Ã˜Âª.',
      'Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â±.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã™â€¦Ã˜Â´Ã˜Â¯Ã˜Â¯Ã˜Â© Ã™â€žÃ™â€žÃ˜Â¯Ã˜Â±Ã˜Â¯Ã˜Â´Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â©.',
      'Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜ÂµÃ˜Â© Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª.',
    ],
  },
  {
    id: 'account_theft_fraud',
    title: 'Ã˜Â³Ã˜Â±Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž',
    icon: 'Ã°Å¸â€Â',
    severity: AlertSeverity.HIGH,
    severityColor: 'bg-blue-700',
    symptoms: [
      'Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã™â€žÃ˜Â±Ã™â€¦Ã˜Â² Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã˜Â£Ã™Ë† Ã˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂªÃ˜Â¹Ã™Å Ã™Å Ã™â€  Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â±.',
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Ë†Ã™ÂÃ˜Â©.',
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¨Ã˜Â±Ã˜Â±Ã˜Â© Ã™ÂÃ™Å  Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.',
    ],
    lurePatterns: [
      'Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â©.',
      'Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã™ÂÃ™â€ Ã™Å  Ã™â€¦Ã˜Â²Ã˜Â¹Ã™Ë†Ã™â€¦Ã˜Â© Ã˜ÂªÃ˜Â³Ã˜Â­Ã˜Â¨ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¹Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¯.',
      'Ã˜Â§Ã™â€ Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ž Ã˜ÂµÃ™ÂÃ˜Â© Ã˜ÂµÃ˜Â¯Ã™Å Ã™â€š/Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜Â§Ã™â€žÃ˜Â£Ã™Æ’Ã™Ë†Ã˜Â§Ã˜Â¯.',
    ],
    prevention: [
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA) Ã˜Â¹Ã™â€žÃ™â€° Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã™â€¦Ã˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™ÂÃ˜Â±Ã™Å Ã˜Â¯Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â¯Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â±.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã™â€¹Ã˜Â§.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Æ’Ã™â€¦', action: 'Ã˜ÂªÃ˜Â¯Ã™Ë†Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ™â€šÃ™Ë†Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â§Ã™ÂÃ™Å ', action: 'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã™Ë†Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯ Ã™Ë†Ã˜ÂªÃ˜Â£Ã™Æ’Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â±Ã™Å Ã˜Â¯/Ã˜Â§Ã™â€žÃ™â€¡Ã˜Â§Ã˜ÂªÃ™Â.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€š', action: 'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜Â¯Ã™â€šÃ™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¦Ã˜Â§Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Âª', action: 'Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â£Ã™â€¦Ã™â€ Ã™Å  Ã˜Â¯Ã™Ë†Ã˜Â±Ã™Å  Ã™â€¦Ã˜Â®Ã˜ÂªÃ˜ÂµÃ˜Â± Ã™â€žÃ™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¡Ã˜Â¯Ã˜Â¦Ã˜Â©',
        opener: 'Ã™Å Ã™â€¦Ã™Æ’Ã™â€ Ã™â€ Ã˜Â§ Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â¨Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â§Ã˜Âª Ã™â€¦Ã™â€ Ã˜Â¸Ã™â€¦Ã˜Â©Ã˜Å’ Ã™â€žÃ˜Â§ Ã˜Â¯Ã˜Â§Ã˜Â¹Ã™Å  Ã™â€žÃ™â€žÃ˜Â°Ã˜Â¹Ã˜Â±.',
        advice: 'Ã˜Â­Ã™Ë†Ã™â€˜Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ™Â Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©.',
      },
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™ÂÃ™Ë†Ã˜Â±Ã™Å ',
        opener: 'Ã˜Â³Ã™â€ Ã˜ÂºÃ™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã™â€ Ã˜ÂºÃ™â€žÃ™â€š Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ .',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€žÃ˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜Â±Ã™â€šÃ˜Â©.',
      },
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â¹Ã™Å Ã˜Â©',
        opener: 'Ã˜Â£Ã™Å  Ã˜Â·Ã™â€žÃ˜Â¨ Ã™â€žÃ˜Â±Ã™â€¦Ã˜Â² Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™Å Ã˜Â¹Ã˜ÂªÃ˜Â¨Ã˜Â± Ã˜Â®Ã˜Â·Ã˜Â±Ã™â€¹Ã˜Â§ Ã˜Â­Ã˜ÂªÃ™â€° Ã™Å Ã˜Â«Ã˜Â¨Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã™Æ’Ã˜Â³.',
        advice: 'Ã˜Â«Ã˜Â¨Ã™â€˜Ã˜Âª Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© OTP Ã™â€¦Ã˜Â·Ã™â€žÃ™â€šÃ™â€¹Ã˜Â§.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã˜Â§Ã˜Â´Ã˜ÂªÃ˜Â¨Ã˜Â§Ã™â€¡ Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â³Ã˜Â±Ã™â€šÃ˜Â© Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ˜Â¯Ã™Ë†Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã™Ë†Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â±Ã™Ë†Ã˜Â¬ Ã™â€¦Ã™â€  Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â©.',
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã™Ë†Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯.',
      'Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â±Ã™Å Ã˜Â¯ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž Ã˜Â¥Ã˜Â¶Ã˜Â§Ã™ÂÃ™Å Ã˜Â©.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã˜Â¯Ã˜Â« Ã™Ë†Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã™â€žÃ™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â©.',
    ],
  },
  {
    id: 'gambling_betting',
    title: 'Ã˜Â§Ã™â€žÃ™â€¦Ã™â€šÃ˜Â§Ã™â€¦Ã˜Â±Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã™â€¡Ã™â€ Ã˜Â§Ã˜Âª',
    icon: 'Ã°Å¸Å½Â°',
    severity: AlertSeverity.HIGH,
    severityColor: 'bg-yellow-700',
    symptoms: [
      'Ã˜Â§Ã™â€ Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹ Ã™â€ Ã˜Â­Ã™Ë† Ã˜Â±Ã™â€¡Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜ÂµÃ™â€ Ã˜Â§Ã˜Â¯Ã™Å Ã™â€š Ã˜Â­Ã˜Â¸ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¨.',
      'Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¨Ã˜Â±Ã˜Â±Ã˜Â©.',
      'Ã˜ÂªÃ™Ë†Ã˜ÂªÃ˜Â± Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­ Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â© Ã˜ÂªÃ˜Â¹Ã™Ë†Ã™Å Ã˜Â¶Ã™â€¡Ã˜Â§ Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
    ],
    lurePatterns: [
      'Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€¡Ã™â€  Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Ë†Ã˜Â¯ Ã˜Â±Ã˜Â¨Ã˜Â­ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹.',
      'Ã™â€¦Ã˜Â¤Ã˜Â«Ã˜Â±Ã™Ë†Ã™â€  Ã™Å Ã˜Â±Ã™Ë†Ã™â€˜Ã˜Â¬Ã™Ë†Ã™â€  Ã™â€žÃ™â€šÃ™â€¦Ã˜Â§Ã˜Â± Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã™â€¦Ã™â€¦Ã™Ë†Ã™â€¡.',
      'Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ˜Â¯Ã™â€¦ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨Ã˜Â© Ã˜Â¨Ã™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â­Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.',
    ],
    prevention: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™ÂÃ™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™ÂÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¶Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã˜Â­Ã˜Â¯ Ã˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€š Ã˜Â´Ã™â€¡Ã˜Â±Ã™Å  Ã™â€¦Ã˜Â¹ Ã˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â± Ã™ÂÃ™Ë†Ã˜Â±Ã™Å .',
      'Ã˜ÂªÃ™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â­Ã™Ë†Ã™â€ž Ã™Ë†Ã™â€¡Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¹.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜ÂªÃ˜Â¬Ã™â€¦Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±', action: 'Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ™ÂÃ™Æ’Ã™Å Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â©', action: 'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã™â€¡Ã™â€ Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ Ã™â€¦Ã˜Â­Ã™ÂÃ˜Â²Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜ÂµÃ˜Â­Ã™Å Ã˜Â©', action: 'Ã˜Â£Ã™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€žÃ˜Â© Ã˜ÂªÃ™Ë†Ã™â€žÃ˜Â¯ Ã˜Â¥Ã™â€ Ã˜Â¬Ã˜Â§Ã˜Â²Ã™â€¹Ã˜Â§ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â§Ã™â€žÃ™Å .' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜Â«Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å ', action: 'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â²Ã˜Â§Ã™â€¦ Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€¦Ã˜Â¹ Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â±.' },
    ],
    dialogues: [
      {
        situation: 'Ã˜ÂªÃ˜ÂµÃ˜Â­Ã™Å Ã˜Â­ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã™â€šÃ˜Â¹',
        opener: 'Ã˜Â§Ã™â€žÃ˜Â±Ã™â€¡Ã˜Â§Ã™â€  Ã™â€žÃ™Å Ã˜Â³ Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â«Ã™â€¦Ã˜Â§Ã˜Â±Ã™â€¹Ã˜Â§Ã˜Å’ Ã™Ë†Ã˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã™â€¹Ã˜Â§ Ã™Å Ã™â€ Ã˜ÂªÃ™â€¡Ã™Å  Ã˜Â¨Ã˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â£Ã™Æ’Ã˜Â¨Ã˜Â±.',
        advice: 'Ã™â€šÃ˜Â¯Ã™â€˜Ã™â€¦ Ã˜Â£Ã™â€¦Ã˜Â«Ã™â€žÃ˜Â© Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â© Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã˜Â­Ã˜Â§Ã˜Â¶Ã˜Â±Ã˜Â© Ã˜Â·Ã™Ë†Ã™Å Ã™â€žÃ˜Â©.',
      },
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯',
        opener: 'Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦ Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â£Ã™Å  Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â© Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â£Ã™Ë† Ã˜Â±Ã™â€¡Ã˜Â§Ã™â€  Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â©.',
        advice: 'Ã˜Â­Ã™Ë†Ã™â€˜Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜ÂªÃ™â€šÃ™â€ Ã™Å Ã˜Â© Ã˜Â«Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â©.',
      },
      {
        situation: 'Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž',
        opener: 'Ã™â€ Ã˜Â®Ã˜ÂªÃ˜Â§Ã˜Â± Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â·Ã™â€¹Ã˜Â§ Ã™Å Ã˜Â¹Ã˜Â·Ã™Å Ã™Æ’ Ã™â€¦Ã˜ÂªÃ˜Â¹Ã˜Â© Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â© Ã˜ÂªÃ™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ™Æ’Ã˜Â§Ã˜Â³.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€¡Ã™â€ Ã˜Â§Ã˜Âª/Ã™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â­Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€š Ã™Ë†Ã˜Â­Ã˜Â¸Ã˜Â± Ã™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â±Ã™â€¡Ã˜Â§Ã™â€ .',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜Â¬Ã™â€¦Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™ÂÃ™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã™Ë†Ã™â€¦Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹ Ã˜Â§Ã™â€žÃ˜Â±Ã™â€¡Ã˜Â§Ã™â€ .',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€š Ã™â€¦Ã˜Â¹ Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â±.',
      'Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜Â§Ã™â€žÃ˜ÂªÃ˜Â²Ã˜Â§Ã™â€¦.',
    ],
  },
  {
    id: 'privacy_tracking',
    title: 'Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å ',
    icon: 'Ã°Å¸â€œÂ',
    severity: AlertSeverity.HIGH,
    severityColor: 'bg-teal-700',
    symptoms: [
      'Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã™â€¦Ã™ÂÃ˜Â±Ã˜Â·Ã˜Â© Ã™â€žÃ™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ˜Â¹ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â©.',
      'Ã˜Â¸Ã™â€¡Ã™Ë†Ã˜Â± Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ Ã˜Â£Ã™Ë† Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™â€ Ã˜Â·Ã™â€šÃ™Å Ã˜Â©.',
      'Ã˜ÂªÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¨ Ã˜ÂµÃ™Ë†Ã˜Â±/Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã™Å Ã™â€¦Ã™Æ’Ã™â€  Ã˜Â±Ã˜Â¨Ã˜Â·Ã™â€¡Ã˜Â§ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€¡Ã™Ë†Ã™Å Ã˜Â©.',
    ],
    lurePatterns: [
      'Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜ÂªÃ˜Â¬Ã™â€¦Ã˜Â¹ Ã˜Â¹Ã™â€ Ã™Ë†Ã˜Â§Ã™â€  IP Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ˜Â¹ Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â¹Ã™â€žÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
      'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¬Ã˜Â³Ã˜Â³ Ã™â€¦Ã˜ÂªÃ™â€ Ã™Æ’Ã˜Â±Ã˜Â© Ã™Æ’Ã˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã™â€žÃ˜Â¬Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â©/Ã˜Â§Ã™â€žÃ˜Â³Ã™Æ’Ã™â€ /Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜ÂªÃ™Å Ã™â€ .',
    ],
    prevention: [
      'Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ˜Â¹ Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â±Ã™Ë†Ã˜Â±Ã™Å Ã˜Â©.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â°Ã™Ë†Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â¯Ã™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â© Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â´Ã™Ë†Ã˜Â±Ã˜Â§Ã˜Âª.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã™Æ’Ã˜Â´Ã˜Â§Ã™Â', action: 'Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ Ã™Ë†Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ™â€ Ã˜Â¸Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â«Ã˜Â±', action: 'Ã˜Â­Ã˜Â°Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â´Ã™Ë†Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â© Ã™Ë†Ã˜Â¶Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜ÂªÃ™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â©', action: 'Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã™â€šÃ˜Â¨Ã™â€ž Ã™ÂÃ˜ÂªÃ˜Â­Ã™â€¡Ã˜Â§.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜ÂµÃ™Å Ã˜Â§Ã™â€ Ã˜Â© Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±Ã˜Â©', action: 'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â© Ã™â€žÃ˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€ .' },
    ],
    dialogues: [
      {
        situation: 'Ã™Ë†Ã˜Â¹Ã™Å  Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â©',
        opener: 'Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â© Ã˜Â¨Ã˜Â³Ã™Å Ã˜Â·Ã˜Â© Ã˜Â¹Ã™â€ Ã™Æ’ Ã™â€šÃ˜Â¯ Ã˜ÂªÃ™ÂÃ˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Å’ Ã™ÂÃ™â€žÃ™â€ Ã˜Â­Ã™â€¦Ã™Â Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€žÃ™Æ’ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ .',
        advice: 'Ã˜Â§Ã˜Â¬Ã˜Â¹Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜ÂªÃ™Ë†Ã˜Â¹Ã™Ë†Ã™Å Ã˜Â© Ã™Ë†Ã™â€žÃ™Å Ã˜Â³Ã˜Âª Ã˜ÂªÃ˜Â®Ã™Ë†Ã™Å Ã™ÂÃ™Å Ã˜Â©.',
      },
      {
        situation: 'Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â²',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â£Ã˜Â°Ã™Ë†Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã™Ë†Ã™â€ Ã˜ÂºÃ™â€žÃ™â€š Ã˜Â£Ã™Å  Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â¶Ã˜Â±Ã™Ë†Ã˜Â±Ã™Å Ã˜Â©.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã™Ë†Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å Ã˜Â© Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã˜ÂªÃ™Æ’Ã™Ë†Ã™â€  Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â©.',
      },
      {
        situation: 'Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã™Å Ã™Ë†Ã™â€¦Ã™Å ',
        opener: 'Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã™â€ Ã˜Â´Ã˜Â±: Ã™â€¡Ã™â€ž Ã™â€¡Ã˜Â°Ã˜Â§ Ã™Å Ã™Æ’Ã˜Â´Ã™Â Ã™â€¦Ã™Ë†Ã™â€šÃ˜Â¹Ã™Æ’ Ã˜Â£Ã™Ë† Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜ÂªÃ™Æ’Ã˜Å¸',
        advice: 'Ã˜Â³Ã˜Â¤Ã˜Â§Ã™â€ž Ã˜Â¨Ã˜Â³Ã™Å Ã˜Â· Ã™Å Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¹Ã™Å  Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å .',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹/Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€¡Ã˜Â§Ã™Æ’ Ã˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã™â€¦Ã˜Â±Ã˜ÂµÃ™Ë†Ã˜Â¯Ã˜Â©.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ Ã™Ë†Ã˜ÂªÃ™â€ Ã˜Â¸Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â«Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å .',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ˜Â¹ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â©.',
      'Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â°Ã™Ë†Ã™â€ Ã˜Â§Ã˜Âª.',
      'Ã˜ÂªÃ™â€ Ã˜Â¸Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â´Ã™Ë†Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â°Ã™Å  Ã™Å Ã™Æ’Ã˜Â´Ã™Â Ã˜Â§Ã™â€žÃ™â€¡Ã™Ë†Ã™Å Ã˜Â©.',
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â±Ã™Ë†Ã™ÂÃ˜Â©.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã™â€¹Ã˜Â§.',
    ],
  },
  {
    id: 'harmful_challenges',
    title: 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â§Ã˜Â±Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±Ã˜Â©',
    icon: 'Ã¢Å¡Â Ã¯Â¸Â',
    severity: AlertSeverity.CRITICAL,
    severityColor: 'bg-orange-700',
    symptoms: [
      'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¤Ã˜Â°Ã™Å  Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â³Ã˜Â¯ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³.',
      'Ã˜Â§Ã™â€ Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹ Ã™â€žÃ˜ÂªÃ˜ÂµÃ™Ë†Ã™Å Ã˜Â± Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å Ã˜Â§Ã˜Âª Ã˜Â®Ã˜Â·Ã˜Â±Ã˜Â© Ã™â€žÃ˜Â¥Ã˜Â«Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â§Ã˜Âª.',
      'Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â¬Ã™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã™Å Ã˜Â¯Ã™ÂÃ˜Â¹ Ã™â€žÃ™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.',
    ],
    lurePatterns: [
      'Ã˜ÂªÃ˜Â±Ã™â€ Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â­Ã˜Â±Ã™Å Ã˜Â¶Ã™Å Ã˜Â© Ã˜ÂªÃ˜ÂªÃ˜Â­Ã˜Â¯Ã™â€° Ã˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ˜Â§Ã™â€¦Ã˜Â©.',
      'Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã™â€¦Ã˜ÂºÃ™â€žÃ™â€šÃ˜Â© Ã˜ÂªÃ™Æ’Ã˜Â§Ã™ÂÃ˜Â¦ Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€šÃ˜Â¨Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å .',
      'Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã™â€¦Ã™â€  Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â°Ã™â€° Ã˜Â§Ã™â€žÃ˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å .',
    ],
    prevention: [
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â³Ã™Ë†Ã™â€¦ Ã™Ë†Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±Ã˜Â©.',
      'Ã˜ÂªÃ˜Â«Ã™â€šÃ™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¨Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©: Ã™â€žÃ˜Â§ Ã˜ÂªÃ˜Â¬Ã˜Â±Ã˜Â¨Ã˜Â© Ã˜Â£Ã™Å  Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å  Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã™Ë†Ã˜Â§Ã™ÂÃ™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â±Ã˜Â©.',
      'Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â¥Ã˜Â´Ã˜Â±Ã˜Â§Ã™Â Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€žÃ˜Â¯Ã™Å Ã™â€  Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™ÂÃ™Å Ã˜Â¯Ã™Å Ã™Ë†Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.',
    ],
    interventionProgram: [
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 1', goal: 'Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å ', action: 'Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª/Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â±Ã˜Â¶Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 2', goal: 'Ã˜ÂªÃ™ÂÃ™Æ’Ã™Å Ã™Æ’ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â£Ã˜Â«Ã™Å Ã˜Â±', action: 'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ˜Â£Ã™â€šÃ˜Â±Ã˜Â§Ã™â€  Ã™Ë†Ã™Æ’Ã™Å Ã™ÂÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™ÂÃ˜Â¶.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 3', goal: 'Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¡', action: 'Ã˜Â¥Ã˜Â´Ã˜Â±Ã˜Â§Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™ÂÃ™Å  Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â¢Ã™â€¦Ã™â€ Ã˜Â© Ã˜Â¥Ã™Å Ã˜Â¬Ã˜Â§Ã˜Â¨Ã™Å Ã˜Â©.' },
      { week: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹ 4', goal: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â©', action: 'Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã˜Â¯Ã™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â±Ã™â€ Ã˜Â¯Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž.' },
    ],
    dialogues: [
      {
        situation: 'Ã™Ë†Ã™â€šÃ™Â Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’',
        opener: 'Ã˜Â£Ã™Å  Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å  Ã™Å Ã˜Â¹Ã˜Â±Ã™â€˜Ã˜Â¶Ã™Æ’ Ã™â€žÃ™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â³Ã™Å Ã˜ÂªÃ™Ë†Ã™â€šÃ™Â Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§Ã˜Å’ Ã˜Â³Ã™â€žÃ˜Â§Ã™â€¦Ã˜ÂªÃ™Æ’ Ã˜Â£Ã™Ë†Ã™â€žÃ™â€¹Ã˜Â§.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â²Ã™â€¦ Ã™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨ Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â­Ã™ÂÃ˜Â§Ã˜Â¸ Ã˜Â¹Ã™â€žÃ™â€° Ã™â€žÃ˜ÂºÃ˜Â© Ã˜Â¯Ã˜Â§Ã˜Â¹Ã™â€¦Ã˜Â©.',
      },
      {
        situation: 'Ã™ÂÃ™Æ’ Ã˜Â§Ã™â€žÃ˜Â¶Ã˜ÂºÃ˜Â·',
        opener: 'Ã˜Â§Ã™â€žÃ˜Â±Ã™ÂÃ˜Â¶ Ã™â€žÃ™Å Ã˜Â³ Ã˜Â¶Ã˜Â¹Ã™ÂÃ™â€¹Ã˜Â§Ã˜Å’ Ã˜Â¨Ã™â€ž Ã™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã˜Â´Ã˜Â¬Ã˜Â§Ã˜Â¹ Ã™Å Ã˜Â­Ã™â€¦Ã™Å Ã™Æ’.',
        advice: 'Ã˜Â£Ã˜Â¹Ã˜Â¯ Ã˜ÂªÃ˜Â¹Ã˜Â±Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¬Ã˜Â§Ã˜Â¹Ã˜Â© Ã˜Â¨Ã˜Â¹Ã™Å Ã˜Â¯Ã™â€¹Ã˜Â§ Ã˜Â¹Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±Ã˜Â©.',
      },
      {
        situation: 'Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â¢Ã™â€¦Ã™â€ ',
        opener: 'Ã™â€ Ã˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¹Ã™â€  Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â¥Ã™Å Ã˜Â¬Ã˜Â§Ã˜Â¨Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â¨Ã™â€ Ã™Å  Ã™â€¦Ã™â€¡Ã˜Â§Ã˜Â±Ã˜Â§Ã˜ÂªÃ™Æ’ Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â£Ã˜Â°Ã™â€°.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å Ã˜Â© Ã˜ÂªÃ™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™Ë†Ã˜Â¯Ã˜Â© Ã™â€žÃ™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â§Ã˜Â±Ã˜Â©.',
      },
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã˜Â±Ã˜ÂµÃ˜Â¯ Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â®Ã˜Â·Ã˜Â±Ã˜Â©/Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â¶Ã˜Â§Ã˜Â±Ã˜Â©.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â± Ã™Ë†Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã˜ÂªÃ˜Â±Ã˜Â¨Ã™Ë†Ã™Å  Ã˜Â¹Ã˜Â§Ã˜Â¬Ã™â€ž.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã™ÂÃ™Ë†Ã˜Â±Ã™Å  Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â­Ã˜Â¯Ã™Å  Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â§Ã˜Â±Ã™Å Ã˜Â©.',
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª/Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â±Ã˜Â¶Ã˜Â©.',
      'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã˜Â¹Ã˜Â§Ã˜Â¬Ã™â€žÃ˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â­Ã™Ë†Ã™â€ž Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â©.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â±Ã™â€šÃ˜Â§Ã˜Â¨Ã˜Â© Ã™â€žÃ˜ÂµÃ™Å Ã™â€šÃ˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™â€° Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â¦Ã™Å .',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã˜Â­Ã˜ÂªÃ™â€° Ã˜Â²Ã™Ë†Ã˜Â§Ã™â€ž Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±.',
    ],
  },
];

type GuidanceScenarioExtension = {
  symptoms?: string[];
  lurePatterns?: string[];
  prevention?: string[];
  interventionProgram?: InterventionStep[];
  dialogues?: GuidanceScenario['dialogues'];
  alertTemplates?: string[];
  incidentPlan?: string[];
};

const scenarioKnowledgeExtensions: Record<PsychScenarioId, GuidanceScenarioExtension> = {
  bullying: {
    symptoms: [
      'Ã˜Â§Ã™â€ Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¶ Ã™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã˜ÂµÃ™Å Ã™â€ž Ã˜Â£Ã™Ë† Ã˜Â±Ã™ÂÃ˜Â¶ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂµÃ™ÂÃ™Å Ã˜Â© Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜Â±Ã™â€šÃ™â€¦Ã™Å .',
      'Ã˜Â´Ã™Æ’Ã˜Â§Ã™Ë†Ã™â€° Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã™â€¦Ã™â€  Ã˜ÂµÃ˜Â¯Ã˜Â§Ã˜Â¹ Ã˜Â£Ã™Ë† Ã˜Â£Ã˜Â±Ã™â€š Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã™â€¦ Ã˜Â¨Ã˜Â³Ã˜Â¨Ã˜Â¨ Ã˜Â§Ã™â€ Ã˜ÂªÃ˜Â¸Ã˜Â§Ã˜Â± Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€¦Ã˜Â³Ã™Å Ã˜Â¦Ã˜Â©.',
      'Ã˜ÂªÃ˜Â¬Ã™â€ Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ˜Â§Ã˜Â· Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Â± Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¸Ã™â€¡Ã™Ë†Ã˜Â± Ã™ÂÃ™Å  Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â³Ã˜Â¨Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â®Ã™Ë†Ã™Â Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â®Ã˜Â±Ã™Å Ã˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â¹Ã˜Â¨Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â¬Ã™â€žÃ˜Â¯ Ã˜Â°Ã˜Â§Ã˜ÂªÃ™Å  Ã™â€¦Ã˜Â«Ã™â€ž "Ã˜Â£Ã™â€ Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â¨Ã˜Â¨" Ã˜Â£Ã™Ë† "Ã˜Â£Ã™â€ Ã˜Â§ Ã™ÂÃ˜Â§Ã˜Â´Ã™â€ž".',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂªÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â© Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã™Å Ã™â€š Ã˜Â¯Ã™Ë†Ã™â€  Ã˜ÂªÃ™ÂÃ˜Â³Ã™Å Ã˜Â± Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­ Ã™Ë†Ã™â€¦Ã™â€šÃ™â€ Ã˜Â¹.',
    ],
    lurePatterns: [
      'Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¨Ã™â€ Ã˜Â´Ã˜Â± Ã™â€¦Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«Ã˜Â§Ã˜Âª Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â© Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ Ã˜Â³Ã™Å Ã˜Â§Ã™â€šÃ™â€¡Ã˜Â§.',
      'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â²Ã˜Â§Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â­Ã™â€¦Ã™â€žÃ˜Â§Ã˜Âª Ã˜ÂªÃ˜Â´Ã™Ë†Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â¬Ã˜Â¯Ã™Ë†Ã™â€žÃ˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ™ÂÃ˜Â²Ã˜Â§Ã˜Â² Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™â€žÃ™Å Ã˜Â±Ã˜Â¯ Ã˜Â¨Ã˜Â¹Ã™â€ Ã™Â Ã˜Â«Ã™â€¦ Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â±Ã˜Â¯Ã™â€¡ Ã˜Â¶Ã˜Â¯Ã™â€¡ Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã™â€žÃ™â€¦Ã™Å Ã™â€ .',
      'Ã˜Â§Ã™â€ Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ž Ã˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â© Ã˜Â²Ã™â€¦Ã™Å Ã™â€ž Ã™â€¦Ã™â€šÃ˜Â±Ã˜Â¨ Ã™â€žÃ˜Â¬Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â© Ã˜Â«Ã™â€¦ Ã˜ÂªÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¨Ã™â€¡Ã˜Â§.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â·Ã™â€žÃ˜Â§Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† "Ã˜ÂªÃ˜ÂµÃ™Ë†Ã™Å Ã˜ÂªÃ˜Â§Ã˜Âª" Ã™â€žÃ˜Â¥Ã˜Â°Ã™â€žÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€ Ã™â€¹Ã˜Â§.',
    ],
    prevention: [
      'Ã˜Â§Ã˜ÂªÃ™ÂÃ˜Â§Ã™â€š Ã˜Â£Ã˜Â³Ã˜Â±Ã™Å  Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­: Ã˜Â£Ã™Å  Ã˜Â¥Ã˜Â³Ã˜Â§Ã˜Â¡Ã˜Â© Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜ÂªÃ™ÂÃ˜Â¨Ã™â€žÃ˜Âº Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦ Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â¹Ã™â€šÃ™Ë†Ã˜Â¨Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº.',
      'Ã˜ÂªÃ˜Â¬Ã™â€¡Ã™Å Ã˜Â² Ã˜Â±Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã˜Â¬Ã˜Â§Ã™â€¡Ã˜Â²Ã˜Â© Ã™â€žÃ™â€žÃ˜Â±Ã™ÂÃ˜Â¶: "Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™â€šÃ˜Â¨Ã™Ë†Ã™â€ž" Ã˜Â«Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¸Ã˜Â± Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€ Ã™â€šÃ˜Â§Ã˜Â´.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€žÃ˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â© Ã˜Â¹Ã™â€ Ã˜Â¯ Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜ÂªÃ™â€šÃ˜Â§Ã˜Â·Ã˜Â¹ Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å .',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂªÃ™â€ Ã™â€¦Ã˜Â± Ã™â€¦Ã™â€¦Ã˜ÂªÃ˜Â¯ Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜Â£Ã™Æ’Ã˜Â«Ã˜Â± Ã™â€¦Ã™â€  Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â£Ã˜Â«Ã˜Â± Ã™â€ Ã™ÂÃ˜Â³Ã™Å  Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€ž (Ã™â€šÃ˜Â¨Ã™â€ž/Ã˜Â£Ã˜Â«Ã™â€ Ã˜Â§Ã˜Â¡/Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â³Ã˜Â§Ã˜Â¡Ã˜Â©) Ã˜Â¨Ã˜Â¯Ã™â€ž Ã™â€žÃ™â€šÃ˜Â·Ã˜Â© Ã™â€¦Ã™ÂÃ˜Â±Ã˜Â¯Ã˜Â© Ã™ÂÃ™â€šÃ˜Â·.',
      'Ã˜ÂªÃ™â€ Ã˜Â³Ã™Å Ã™â€š Ã™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜Â§Ã˜ÂªÃ˜ÂµÃ˜Â§Ã™â€ž Ã™Ë†Ã˜Â§Ã˜Â­Ã˜Â¯Ã˜Â© Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â²Ã™â€ž Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â© Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¹ Ã˜ÂªÃ˜Â¶Ã˜Â§Ã˜Â±Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž.',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¹Ã™Ë†Ã˜Â± Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â°Ã™â€ Ã˜Â¨',
        opener: 'Ã˜Â­Ã˜ÂªÃ™â€° Ã™â€žÃ™Ë† Ã˜Â±Ã˜Â¯Ã˜Â¯Ã˜Âª Ã˜Â¨Ã˜Â¹Ã˜ÂµÃ˜Â¨Ã™Å Ã˜Â©Ã˜Å’ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â¤Ã™Ë†Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â§Ã˜Â³Ã™Å Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã™â€  Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â°Ã™â€°.',
        advice: 'Ã˜Â§Ã™ÂÃ˜ÂµÃ™â€ž Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã™Ë†Ã˜Â±Ã˜Â¯ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¹Ã™â€ž Ã˜Â­Ã˜ÂªÃ™â€° Ã™â€žÃ˜Â§ Ã™Å Ã˜Â­Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã˜Â¨Ã˜Â¦Ã™â€¹Ã˜Â§ Ã™Æ’Ã˜Â§Ã™â€¦Ã™â€žÃ™â€¹Ã˜Â§.',
      },
      {
        situation: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Æ’Ã™â€¦',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â¶Ã˜Â¹ Ã˜Â®Ã˜Â·Ã˜Â© Ã™â€¦Ã™â€  3 Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦ Ã™Æ’Ã™Å  Ã˜ÂªÃ˜Â´Ã˜Â¹Ã˜Â± Ã˜Â£Ã™â€ Ã™Æ’ Ã™â€¦Ã˜Â³Ã™Å Ã˜Â·Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ™Â.',
        advice: 'Ã˜Â¥Ã˜Â¹Ã˜Â·Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¯Ã™Ë†Ã˜Â±Ã™â€¹Ã˜Â§ Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã™â€¹Ã˜Â§ Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â¬Ã˜Â² Ã™Ë†Ã™Å Ã˜Â²Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€žÃ˜ÂªÃ˜Â²Ã˜Â§Ã™â€¦.',
      },
    ],
  },
  threat_exposure: {
    symptoms: [
      'Ã˜ÂªÃ˜Â¬Ã™â€ Ã˜Â¨ Ã™ÂÃ˜ÂªÃ˜Â­ Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™Å Ã˜Â±Ã˜Â§ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™â€¦Ã™Å Ã™Æ’Ã˜Â±Ã™Ë†Ã™ÂÃ™Ë†Ã™â€  Ã˜Â±Ã˜ÂºÃ™â€¦ Ã˜Â§Ã˜Â¹Ã˜ÂªÃ™Å Ã˜Â§Ã˜Â¯Ã™â€¡ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â§Ã˜Â¨Ã™â€š Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â°Ã™â€žÃ™Æ’.',
      'Ã™â€šÃ™â€žÃ™â€š Ã˜Â´Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â±Ã™â€¦Ã˜Â² Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã˜Â£Ã™Ë† Ã˜Â£Ã™Å  Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â­Ã˜Â°Ã™Â Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€ž Ã™ÂÃ˜Â¬Ã˜Â£Ã˜Â© Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â³Ã˜Â¨Ã˜Â¨ Ã˜ÂªÃ™â€šÃ™â€ Ã™Å  Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­.',
      'Ã™â€ Ã™Ë†Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â¨Ã™Æ’Ã˜Â§Ã˜Â¡ Ã˜Â£Ã™Ë† Ã˜Â§Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â§Ã™Æ’ Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™â€¦Ã™Æ’Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã™â€¦Ã™â€  Ã˜Â£Ã˜Â±Ã™â€šÃ˜Â§Ã™â€¦ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â­Ã™ÂÃ™Ë†Ã˜Â¸Ã˜Â©.',
      'Ã˜Â±Ã™ÂÃ˜Â¶ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â¹Ã™â€  Ã˜Â´Ã˜Â®Ã˜Âµ/Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â¨Ã˜Â¹Ã™Å Ã™â€ Ã™â€¡ Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â± Ã™â€ Ã˜Â¨Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Âª.',
    ],
    lurePatterns: [
      'Ã˜Â¬Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â«Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ™â€šÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¹ Ã˜Â¥Ã™â€žÃ™â€° Ã™â€žÃ˜ÂºÃ˜Â© Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯.',
      'Ã˜Â§Ã˜Â¯Ã˜Â¹Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€¦Ã˜ÂªÃ™â€žÃ˜Â§Ã™Æ’ Ã˜ÂµÃ™Ë†Ã˜Â±/Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â¥Ã˜Â¶Ã˜Â§Ã™ÂÃ™Å Ã˜Â© Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â¨Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â§Ã™â€¦Ã˜ÂªÃ˜Â«Ã˜Â§Ã™â€ž.',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™â€¦Ã™â€¡Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â²Ã™â€¦Ã™â€ Ã™Å Ã™â€¹Ã˜Â§ Ã˜ÂªÃ˜Â­Ã˜Âª Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â¯Ã™â€˜ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â§Ã˜Â²Ã™â€žÃ™Å .',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã˜Â£Ã˜Â³Ã˜Â±Ã˜Â§Ã˜Â± Ã˜Â¹Ã˜Â§Ã˜Â¦Ã™â€žÃ™Å Ã˜Â© Ã˜Â£Ã™Ë† Ã™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã™Å Ã˜Â© Ã™â€žÃ˜Â®Ã™â€žÃ™â€š Ã˜Â®Ã™Ë†Ã™Â Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¶Ã™Å Ã˜Â­Ã˜Â©.',
      'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã™â€  Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã˜Â¥Ã™â€žÃ™â€° Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å  Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¨Ã˜Â§Ã™â€žÃ™Ë†Ã˜ÂµÃ™Ë†Ã™â€ž Ã™â€žÃ™â€žÃ™â€¦Ã˜Â­Ã™Å Ã˜Â· Ã˜Â§Ã™â€žÃ™â€šÃ˜Â±Ã™Å Ã˜Â¨.',
    ],
    prevention: [
      'Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â§Ã˜Â³Ã™Å Ã˜Â©: Ã˜Â£Ã™Å  Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜ÂªÃ™ÂÃ˜Â­Ã™Ë†Ã™â€˜Ã™â€ž Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â© Ã™â€žÃ™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â± Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â±Ã˜Â¯.',
      'Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¦Ã™â€žÃ™Å Ã˜Â© Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã™â€¦Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€ž.',
      'Ã˜ÂªÃ™â€¦Ã˜Â±Ã™Å Ã™â€  Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å  Ã˜Â´Ã™â€¡Ã˜Â±Ã™Å  Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â³Ã™Å Ã™â€ Ã˜Â§Ã˜Â±Ã™Å Ã™Ë† Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å  Ã™Ë†Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â©.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã˜Â±Ã˜ÂµÃ˜Â¯ Ã™â€ Ã™â€¦Ã˜Â· Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â± Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â·Ã˜Â§Ã™â€žÃ˜Â¨ Ã˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯Ã™Å Ã˜Â© Ã˜Â²Ã™â€¦Ã™â€ Ã™Å Ã˜Â©.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã™â€¡Ã™Ë†Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã˜ÂªÃ˜Â² (Ã™â€¦Ã˜Â¹Ã˜Â±Ã™â€˜Ã™ÂÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨/Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦/Ã˜Â§Ã™â€žÃ˜Â¨Ã˜ÂµÃ™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â²Ã™â€¦Ã™â€ Ã™Å Ã˜Â©) Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™Ë†Ã˜Â§Ã˜Â³Ã˜Â¹.',
      'Ã™ÂÃ˜ÂµÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â±Ã˜Â¬Ã˜Â© Ã˜Â¹Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â±Ã™â€˜Ã˜Â¶ Ã™â€žÃ˜Â­Ã™Å Ã™â€  Ã˜Â§Ã™Æ’Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡.',
    ],
    dialogues: [
      {
        situation: 'Ã˜ÂªÃ™ÂÃ™Æ’Ã™Å Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â®Ã™Ë†Ã™Â',
        opener: 'Ã™â€žÃ˜ÂºÃ˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜ÂµÃ™â€¦Ã™â€¦Ã˜Â© Ã™â€žÃ˜Â¥Ã˜Â±Ã˜Â¨Ã˜Â§Ã™Æ’Ã™Æ’Ã˜Å’ Ã™â€žÃ™Æ’Ã™â€  Ã™â€žÃ˜Â¯Ã™Å Ã™â€ Ã˜Â§ Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â£Ã™â€šÃ™Ë†Ã™â€° Ã™â€¦Ã™â€  Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¶Ã˜ÂºÃ˜Â·.',
        advice: 'Ã˜Â³Ã™â€¦Ã™â€˜Ã™Â Ã˜Â§Ã™â€žÃ™â€¡Ã˜Â¯Ã™Â Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å  Ã™â€žÃ™â€žÃ™â€¦Ã˜Â¨Ã˜ÂªÃ˜Â² Ã˜Â­Ã˜ÂªÃ™â€° Ã™Å Ã™ÂÃ™â€šÃ˜Â¯ Ã˜ÂªÃ˜Â£Ã˜Â«Ã™Å Ã˜Â±Ã™â€¡.',
      },
      {
        situation: 'Ã™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹',
        opener: 'Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹ Ã™â€žÃ˜Â§ Ã™Å Ã™â€ Ã™â€¡Ã™Å  Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã™â€¹Ã˜Â§Ã˜Å’ Ã™â€žÃ˜Â°Ã™â€žÃ™Æ’ Ã˜Â³Ã™â€ Ã˜Â­Ã™â€¦Ã™Å Ã™Æ’ Ã˜Â¨Ã˜Â·Ã˜Â±Ã™â€š Ã˜ÂµÃ˜Â­Ã™Å Ã˜Â­Ã˜Â©.',
        advice: 'Ã™â€šÃ˜Â¯Ã™â€˜Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å  Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§ Ã˜Â­Ã˜ÂªÃ™â€° Ã™â€žÃ˜Â§ Ã™Å Ã˜Â¨Ã˜Â¯Ã™Ë† Ã˜Â§Ã™â€žÃ™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã™â€ Ã˜Â¸Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§ Ã™ÂÃ™â€šÃ˜Â·.',
      },
    ],
  },
  gaming: {
    symptoms: [
      'Ã˜ÂªÃ˜Â£Ã˜Â®Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã™â€¦ Ã™Å Ã˜ÂªÃ˜Â¨Ã˜Â¹Ã™â€¡ Ã˜Â¥Ã˜Â±Ã™â€¡Ã˜Â§Ã™â€š Ã˜ÂµÃ˜Â¨Ã˜Â§Ã˜Â­Ã™Å  Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­.',
      'Ã™ÂÃ™â€šÃ˜Â¯Ã˜Â§Ã™â€  Ã˜Â§Ã™â€žÃ˜Â§Ã™â€¡Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€¦ Ã˜Â¨Ã˜Â£Ã™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã™Æ’Ã˜Â§Ã™â€  Ã™Å Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜ÂªÃ˜Â¹ Ã˜Â¨Ã™â€¡Ã˜Â§ Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â§Ã˜Â´Ã˜Â©.',
      'Ã˜Â§Ã™â€ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€ž Ã˜Â´Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â£Ã™Å  Ã˜Â§Ã™â€ Ã™â€šÃ˜Â·Ã˜Â§Ã˜Â¹ Ã˜Â¥Ã™â€ Ã˜ÂªÃ˜Â±Ã™â€ Ã˜Âª Ã˜Â£Ã™Ë† Ã™ÂÃ™â€šÃ˜Â¯Ã˜Â§Ã™â€  Ã˜Â¬Ã™Ë†Ã™â€žÃ˜Â©.',
      'Ã˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€žÃ˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â±Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â³Ã˜Â¨Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â· Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â± Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨Ã˜Â©.',
      'Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â°Ã˜Â¨ Ã˜Â­Ã™Ë†Ã™â€ž Ã™â€¦Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€š Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨Ã˜Â©.',
    ],
    lurePatterns: [
      'Ã˜Â£Ã™â€ Ã˜Â¸Ã™â€¦Ã˜Â© Ã™â€¦Ã™Æ’Ã˜Â§Ã™ÂÃ˜Â¢Ã˜Âª Ã™â€¦Ã˜ÂªÃ™â€šÃ˜Â·Ã˜Â¹Ã˜Â© Ã˜ÂªÃ˜Â¯Ã™ÂÃ˜Â¹ Ã™â€žÃ™â€žÃ˜Â¹Ã™Ë†Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã˜Â¯Ã™Ë†Ã™â€  Ã˜ÂªÃ™Ë†Ã™â€šÃ™Â.',
      'Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã™Å Ã™â€š/Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â´Ã™Å Ã˜Â±Ã˜Â© Ã™â€žÃ™â€žÃ˜Â­Ã˜Â¶Ã™Ë†Ã˜Â± Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å  Ã˜Â®Ã™Ë†Ã™ÂÃ™â€¹Ã˜Â§ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â·Ã˜Â±Ã˜Â¯.',
      'Ã˜Â¹Ã˜Â±Ã™Ë†Ã˜Â¶ Ã™â€¦Ã™Ë†Ã˜Â³Ã™â€¦Ã™Å Ã˜Â© Ã™â€¦Ã˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Âª Ã˜ÂªÃ˜Â®Ã™â€žÃ™â€š Ã˜Â´Ã˜Â¹Ã™Ë†Ã˜Â± "Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã˜ÂµÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â®Ã™Å Ã˜Â±Ã˜Â©".',
      'Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜Â§Ã™â€ Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â¹Ã˜Â¯Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â§Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª.',
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â± Ã™â€¦Ã˜ÂµÃ™â€¦Ã™â€¦Ã˜Â© Ã™â€žÃ˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂªÃ™â€ Ã˜Â´Ã™Å Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â£Ã™Å  Ã˜Â§Ã™â€ Ã™â€šÃ˜Â·Ã˜Â§Ã˜Â¹.',
    ],
    prevention: [
      'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â¬Ã˜Â¯Ã™Ë†Ã™â€ž Ã™â€žÃ˜Â¹Ã˜Â¨ Ã™â€¦Ã˜Â±Ã˜Â¦Ã™Å  Ã™Ë†Ã™â€¦Ã˜ÂªÃ™ÂÃ™â€š Ã˜Â¹Ã™â€žÃ™Å Ã™â€¡ Ã™â€¦Ã˜Â¹ Ã™ÂÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Âª Ã˜Â±Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â¥Ã™â€žÃ˜Â²Ã˜Â§Ã™â€¦Ã™Å Ã˜Â©.',
      'Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â± Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨ Ã˜Â¨Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€ : Ã™â€ Ã™Ë†Ã™â€¦Ã˜Å’ Ã˜Â¯Ã˜Â±Ã˜Â§Ã˜Â³Ã˜Â©Ã˜Å’ Ã˜Â­Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â¨Ã˜Â¯Ã™â€ Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â§Ã˜Â°Ã˜Â¨Ã˜Â© Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ Ã™â€ Ã˜Â§Ã™ÂÃ˜Â°Ã˜Â© Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯Ã˜Â©.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â³Ã˜Â·: Ã˜Â§Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹ Ã™â€ Ã™â€¦Ã˜Â· Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨ Ã˜Â§Ã™â€žÃ™â€šÃ™â€¡Ã˜Â±Ã™Å  Ã™â€¦Ã˜Â¹ Ã˜Â£Ã˜Â«Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã™â€¦ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â¶Ã˜Â¨Ã˜Â§Ã˜Â·.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž "Ã˜ÂªÃ™â€¡Ã˜Â¯Ã˜Â¦Ã˜Â© 48 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©" Ã™â€¦Ã˜Â¹ Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€¦Ã™â€¦Ã˜ÂªÃ˜Â¹Ã˜Â© Ã™Ë†Ã™â€žÃ™Å Ã˜Â³ Ã™â€¦Ã™â€ Ã˜Â¹Ã™â€¹Ã˜Â§ Ã˜Â¹Ã™â€šÃ˜Â§Ã˜Â¨Ã™Å Ã™â€¹Ã˜Â§ Ã™ÂÃ™â€šÃ˜Â·.',
      'Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã™â€žÃ˜Â­Ã˜Â¸Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â±Ã™Ë†Ã˜Â© (Ã™â€¦Ã˜ÂªÃ™â€°/Ã™â€žÃ™â€¦Ã˜Â§Ã˜Â°Ã˜Â§) Ã™â€žÃ˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂªÃ˜ÂµÃ™â€¦Ã™Å Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜ÂªÃ™Å Ã™â€  Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å .',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â§Ã˜ÂªÃ™ÂÃ˜Â§Ã™â€š Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å ',
        opener: 'Ã™â€žÃ™â€  Ã™â€ Ã™â€žÃ˜ÂºÃ™Å  Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨Ã˜Å’ Ã˜Â³Ã™â€ Ã˜Â¶Ã˜Â¨Ã˜Â·Ã™â€¡ Ã™â€žÃ™Å Ã˜Â®Ã˜Â¯Ã™â€¦Ã™Æ’ Ã˜Â¨Ã˜Â¯Ã™â€ž Ã™â€¦Ã˜Â§ Ã™Å Ã˜Â³Ã˜ÂªÃ™â€¡Ã™â€žÃ™Æ’Ã™Æ’.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€ Ã˜Â© Ã˜ÂªÃ™â€šÃ™â€žÃ™â€ž Ã™â€¦Ã™â€šÃ˜Â§Ã™Ë†Ã™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™â€žÃ™â€žÃ˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â±.',
      },
      {
        situation: 'Ã˜Â¥Ã˜Â¯Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ™Æ’Ã˜Â§Ã˜Â³Ã˜Â©',
        opener: 'Ã˜Â¥Ã˜Â°Ã˜Â§ Ã˜Â²Ã˜Â§Ã˜Â¯Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â§Ã˜Â¹Ã˜Â§Ã˜Âª Ã™Å Ã™Ë†Ã™â€¦Ã™â€¹Ã˜Â§Ã˜Å’ Ã™â€ Ã˜ÂµÃ˜Â­Ã˜Â­ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã™â€žÃ™Å  Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â¬Ã™â€žÃ˜Â¯ Ã˜Â°Ã˜Â§Ã˜Âª.',
        advice: 'Ã˜Â®Ã˜Â·Ã˜Â· Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â§Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â© Ã˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂµÃ˜Â±Ã˜Â§Ã™â€¦Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ˜Â© Ã™â€žÃ™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â±.',
      },
    ],
  },
  inappropriate_content: {
    symptoms: [
      'Ã™ÂÃ˜Â¶Ã™Ë†Ã™â€ž Ã™â€šÃ™â€¡Ã˜Â±Ã™Å  Ã™â€žÃ™â€žÃ˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¹Ã™â€  Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â£Ã™Æ’Ã˜Â«Ã˜Â± Ã˜ÂµÃ˜Â¯Ã™â€¦Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Âª.',
      'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã˜Â¹ Ã™â€žÃ˜ÂºÃ™Ë†Ã™Å  Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â§Ã™â€¡Ã˜Â¯ Ã˜Â¹Ã™â€ Ã™Â/Ã˜Â¥Ã™Å Ã˜Â­Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª Ã™â€žÃ™â€¦ Ã˜ÂªÃ™Æ’Ã™â€  Ã™â€¦Ã˜Â£Ã™â€žÃ™Ë†Ã™ÂÃ˜Â© Ã˜Â³Ã˜Â§Ã˜Â¨Ã™â€šÃ™â€¹Ã˜Â§.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ™ÂÃ˜Â­ Ã˜Â§Ã™â€žÃ˜Â®Ã™ÂÃ™Å  Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã™Å Ã™Ë†Ã™â€¦Ã™Å  Ã™â€¦Ã™ÂÃ˜Â±Ã˜Â·.',
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â± Ã˜ÂµÃ™Ë†Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â³Ã˜Â¯ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€žÃ˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã™â€ Ã˜ÂªÃ™Å Ã˜Â¬Ã˜Â© Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â±Ã™â€ Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã˜ÂµÃ˜Â­Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â¹Ã˜ÂªÃ˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â·Ã™Â Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â´Ã˜Â§Ã™â€¡Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â°Ã™â€žÃ˜Â§Ã™â€ž.',
    ],
    lurePatterns: [
      'Ã˜Â®Ã™Ë†Ã˜Â§Ã˜Â±Ã˜Â²Ã™â€¦Ã™Å Ã˜Â§Ã˜Âª Ã˜ÂªÃ™â€šÃ˜ÂªÃ˜Â±Ã˜Â­ Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â£Ã™Æ’Ã˜Â«Ã˜Â± Ã˜Â­Ã˜Â¯Ã˜Â© Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™Æ’Ã™â€ž Ã™â€¦Ã˜Â´Ã˜Â§Ã™â€¡Ã˜Â¯Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.',
      'Ã˜Â¹Ã™â€ Ã˜Â§Ã™Ë†Ã™Å Ã™â€  Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€¦Ã˜Â© Ã˜ÂªÃ˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¶Ã™Ë†Ã™â€ž Ã™Æ’Ã˜Â¨Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€šÃ˜Â§Ã™â€ž Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å .',
      'Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· "Ã™â€žÃ™â€žÃ™Æ’Ã˜Â¨Ã˜Â§Ã˜Â± Ã™ÂÃ™â€šÃ˜Â·" Ã˜ÂªÃ™ÂÃ˜ÂªÃ˜Â¯Ã˜Â§Ã™Ë†Ã™â€ž Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â£Ã™â€šÃ˜Â±Ã˜Â§Ã™â€  Ã™â€¦Ã˜ÂºÃ™â€žÃ™â€šÃ˜Â©.',
      'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â´Ã˜Â§Ã™â€¡Ã˜Â¯Ã˜Â© Ã™â€¦Ã˜ÂªÃ˜Â·Ã˜Â±Ã™ÂÃ˜Â© Ã™â€žÃ™â€šÃ™Å Ã˜Â§Ã˜Â³ "Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â±Ã˜Â£Ã˜Â©" Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â£Ã˜ÂµÃ˜Â¯Ã™â€šÃ˜Â§Ã˜Â¡.',
      'Ã˜Â¯Ã™â€¦Ã˜Â¬ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã˜Â§Ã˜Â­Ã™Å /Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã™Å Ã™Â Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â·Ã˜Â¹ Ã˜ÂªÃ˜Â¨Ã˜Â¯Ã™Ë† Ã˜ÂªÃ˜Â±Ã™ÂÃ™Å Ã™â€¡Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã˜Â§Ã™Å Ã˜Â©.',
    ],
    prevention: [
      'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š SafeSearch Ã™Ë†DNS Ã˜Â¹Ã˜Â§Ã˜Â¦Ã™â€žÃ™Å  Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â´Ã™â€¡Ã˜Â±Ã™Å Ã˜Â© Ã™â€žÃ™ÂÃ˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜ÂªÃ™â€¡.',
      'Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â«Ã™â€šÃ™Å Ã™ÂÃ™Å  Ã˜Â¹Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã™â€šÃ˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¹.',
      'Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â£Ã™Å  Ã˜Â®Ã˜Â±Ã™â€š Ã™â€žÃ™â€šÃ™Ë†Ã˜Â§Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¨Ã˜Â®Ã˜Â·Ã˜Â© Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜ÂªÃ˜Â¹Ã™Ë†Ã™Å Ã˜Â¶Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™â€ Ã˜Â§Ã˜Â³Ã˜Â¨ Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜ÂºÃ™Å Ã™â€˜Ã˜Â± Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å  Ã™â€¦Ã˜Â±Ã˜Â§Ã™ÂÃ™â€š.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã™Æ’Ã˜Â´Ã˜Â§Ã™Â (Ã˜Â¨Ã˜Â­Ã˜Â«/Ã˜Â§Ã™â€šÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â­/Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜ÂµÃ˜Â¯Ã™Å Ã™â€š) Ã™â€šÃ˜Â¨Ã™â€ž Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€žÃ˜Â§Ã˜Â¬.',
      'Ã˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂªÃ™â€¡Ã™Å Ã˜Â¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â§Ã˜Âª Ã˜Â¹Ã˜Â¨Ã˜Â± Ã™â€¦Ã˜Â³Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â¬Ã™â€ž Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã™Å Ã˜Â¬Ã˜Â§Ã˜Â¨Ã™Å  Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž.',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã˜Â¨Ã™â€žÃ˜Â§ Ã™Ë†Ã˜ÂµÃ™â€¦',
        opener: 'Ã˜Â³Ã˜Â£Ã˜Â´Ã˜Â±Ã˜Â­ Ã™â€žÃ™Æ’ Ã™â€žÃ™â€¦Ã˜Â§Ã˜Â°Ã˜Â§ Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã™Å Ã˜Â¤Ã˜Â°Ã™Å Ã™Æ’ Ã˜Â¯Ã™Ë†Ã™â€  Ã˜ÂªÃ˜Â®Ã™Ë†Ã™Å Ã™Â Ã˜Â£Ã™Ë† Ã˜Â¥Ã™â€¡Ã˜Â§Ã™â€ Ã˜Â©.',
        advice: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã™Æ’Ã™Å Ã˜Â² Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â«Ã˜Â± Ã™Å Ã˜Â­Ã˜Â§Ã™ÂÃ˜Â¸ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â«Ã™â€šÃ˜Â© Ã˜Â£Ã™Æ’Ã˜Â«Ã˜Â± Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â®Ã˜Â¬Ã™Å Ã™â€ž.',
      },
      {
        situation: 'Ã˜ÂªÃ˜ÂµÃ˜Â­Ã™Å Ã˜Â­ Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â§Ã™â€¡Ã™Å Ã™â€¦',
        opener: 'Ã™â€žÃ™Å Ã˜Â³ Ã™Æ’Ã™â€ž Ã™â€¦Ã˜Â§ Ã™Å Ã™ÂÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â·Ã˜Â¨Ã™Å Ã˜Â¹Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â£Ã™Ë† Ã˜ÂµÃ˜Â­Ã™Å Ã™â€¹Ã˜Â§Ã˜Å’ Ã˜Â®Ã™â€žÃ™â€˜Ã™â€ Ã˜Â§ Ã™â€ Ã™ÂÃ™Æ’Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€¦Ã˜Â¹Ã™â€¹Ã˜Â§.',
        advice: 'Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ™Æ’Ã™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ˜Â¯Ã™Å  Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™Ë†Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™ÂÃ™Ë†Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â°Ã™Å .',
      },
    ],
  },
  cyber_crime: {
    symptoms: [
      'Ã˜Â§Ã™â€¡Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€¦ Ã™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦ Ã˜Â¨Ã˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€š Ã˜Â£Ã™Ë† Ã˜Â³Ã™Æ’Ã˜Â±Ã˜Â¨Ã˜ÂªÃ˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™ÂÃ™â€¡Ã™Ë†Ã™â€¦Ã˜Â© Ã™â€žÃ™â€žÃ˜Â¹Ã™â€¦Ã˜Â±.',
      'Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â§Ã˜Âª Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã™Ë†Ã˜Â² Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â©.',
      'Ã˜ÂªÃ˜Â¨Ã˜Â§Ã™â€¡Ã™Å  Ã˜Â¨Ã™â‚¬"Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â£Ã™â€ Ã˜Â¸Ã™â€¦Ã˜Â©" Ã˜Â¯Ã™Ë†Ã™â€  Ã™ÂÃ™â€¡Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â¹Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¨ Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å Ã˜Â©.',
      'Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â®Ã˜Â±Ã˜Â§Ã˜Â· Ã™ÂÃ™Å  Ã™â€¦Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â¯Ã™â€ž Ã˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã™â€¡Ã˜Â¬Ã™Ë†Ã™â€¦ Ã˜Â£Ã™Ë† Ã˜ÂªÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª.',
      'Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â±Ã˜Â¨ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â£Ã˜ÂµÃ˜Â¯Ã™â€šÃ˜Â§Ã˜Â¡ Ã˜Â¨Ã˜Â¯Ã˜Â¹Ã™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â²Ã˜Â§Ã˜Â­ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å .',
    ],
    lurePatterns: [
      'Ã™â€¦Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ "Ã˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¬Ã˜Â§Ã™â€ Ã™Å Ã˜Â©" Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž Ã˜ÂªÃ˜Â¬Ã˜Â±Ã˜Â¨Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â£Ã™â€¡Ã˜Â¯Ã˜Â§Ã™Â Ã˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å Ã˜Â©.',
      'Ã™Ë†Ã˜Â¹Ã™Ë†Ã˜Â¯ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€¡Ã™Å Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™â€¦Ã™â€¡Ã˜Â§Ã™â€¦ Ã™â€¡Ã˜Â¬Ã™Ë†Ã™â€¦ Ã˜Â¨Ã˜Â³Ã™Å Ã˜Â·Ã˜Â©.',
      'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€š Ã™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã™Å Ã˜Â©/Ã˜Â£Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â¨ Ã˜ÂªÃ™â€¦Ã™â€ Ã˜Â­ Ã˜Â´Ã™â€¡Ã˜Â±Ã˜Â© Ã˜Â²Ã˜Â§Ã˜Â¦Ã™ÂÃ˜Â© Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â©.',
      'Ã˜Â¨Ã™Å Ã˜Â¹ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â³Ã˜Â±Ã™Ë†Ã™â€šÃ˜Â© Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â´Ã˜Â¨Ã™â€¡ Ã™â€¦Ã˜ÂºÃ™â€žÃ™â€šÃ˜Â©.',
      'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¶Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å  Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™Å  Ã˜Â¹Ã˜Â¨Ã˜Â± Ã™â€šÃ˜Â¯Ã™Ë†Ã˜Â© Ã™â€¦Ã™â€ Ã˜Â­Ã˜Â±Ã™ÂÃ˜Â©.',
    ],
    prevention: [
      'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¶Ã™Ë†Ã™â€ž Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å : CTF Ã˜Â¢Ã™â€¦Ã™â€ Ã˜Å’ Ã˜Â¨Ã˜Â±Ã™â€¦Ã˜Â¬Ã˜Â© Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹Ã™Å Ã˜Â©Ã˜Å’ Ã˜Â£Ã™â€¦Ã™â€  Ã˜Â£Ã˜Â®Ã™â€žÃ˜Â§Ã™â€šÃ™Å .',
      'Ã˜ÂªÃ™Ë†Ã˜Â¶Ã™Å Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â¹Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¨ Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å Ã˜Â© Ã˜Â¨Ã™â€žÃ˜ÂºÃ˜Â© Ã˜Â¹Ã™â€¦Ã˜Â±Ã™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å Ã˜Â© Ã™Ë†Ã˜ÂªÃ™â€šÃ™Å Ã™Å Ã™â€¦ Ã™â€ Ã˜Â¨Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¯Ã™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€šÃ˜Â§Ã™â€ž Ã™â€¦Ã™â€  Ã™ÂÃ˜Â¶Ã™Ë†Ã™â€ž Ã˜ÂªÃ™â€šÃ™â€ Ã™Å  Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€šÃ™Å  Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°Ã™Å .',
    ],
    incidentPlan: [
      'Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜Â¬Ã™â€¦Ã™Å Ã˜Â¯ Ã˜Â¨Ã™Å Ã˜Â¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â±Ã˜Â³Ã™â€¦Ã™Å  Ã™â€žÃ˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â¨Ã˜Â±Ã˜Â§Ã™â€ Ã™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â®Ã™â€žÃ˜Â§Ã™â€šÃ™Å .',
    ],
    dialogues: [
      {
        situation: 'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â±',
        opener: 'Ã™â€¦Ã™â€¡Ã˜Â§Ã˜Â±Ã˜ÂªÃ™Æ’ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™â€ Ã™Å Ã˜Â© Ã™â€šÃ™Å Ã™â€¦Ã˜Â©Ã˜Å’ Ã™Ë†Ã™â€ Ã˜Â±Ã™Å Ã˜Â¯Ã™â€¡Ã˜Â§ Ã™ÂÃ™Å  Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã™Å Ã˜Â­Ã™â€¦Ã™Å  Ã˜Â§Ã™â€žÃ™â€ Ã˜Â§Ã˜Â³ Ã™â€žÃ˜Â§ Ã™Å Ã˜Â¤Ã˜Â°Ã™Å Ã™â€¡Ã™â€¦.',
        advice: 'Ã˜Â§Ã˜Â¹Ã˜ÂªÃ˜Â±Ã™Â Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€šÃ˜Â¯Ã˜Â±Ã˜Â© Ã˜Â«Ã™â€¦ Ã˜Â£Ã˜Â¹Ã˜Â¯ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã™Å Ã™â€¡Ã™â€¡Ã˜Â§ Ã˜Â¨Ã˜Â¯Ã™â€ž Ã˜Â´Ã™Å Ã˜Â·Ã™â€ Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
      },
      {
        situation: 'Ã™Ë†Ã˜Â¹Ã™Å  Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å ',
        opener: 'Ã˜Â¨Ã˜Â¹Ã˜Â¶ Ã˜Â§Ã™â€žÃ˜Â£Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜ÂªÃ™ÂÃ˜Â³Ã˜Â¬Ã™â€˜Ã™Å½Ã™â€ž Ã™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€ Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â­Ã˜ÂªÃ™â€° Ã™â€žÃ™Ë† Ã™Æ’Ã˜Â§Ã™â€ Ã˜Âª "Ã˜ÂªÃ˜Â¬Ã˜Â±Ã˜Â¨Ã˜Â©".',
        advice: 'Ã˜Â§Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã™â€ Ã™Ë†Ã™â€  Ã˜Â¨Ã˜Â£Ã™â€¦Ã˜Â«Ã™â€žÃ˜Â© Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â© Ã˜Â­Ã˜ÂªÃ™â€° Ã™Å Ã™Æ’Ã™Ë†Ã™â€  Ã™â€¦Ã™â€žÃ™â€¦Ã™Ë†Ã˜Â³Ã™â€¹Ã˜Â§.',
      },
    ],
  },
  phishing_links: {
    symptoms: [
      'Ã˜Â§Ã™â€žÃ˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â© Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â±.',
      'Ã˜Â¥Ã˜Â¯Ã˜Â®Ã˜Â§Ã™â€ž Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã™ÂÃ™Å  Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â´Ã˜Â¨Ã™â€¡ Ã˜Â§Ã™â€žÃ˜Â£Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¹ Ã™ÂÃ˜Â±Ã™Ë†Ã™â€š Ã˜Â·Ã™ÂÃ™Å Ã™ÂÃ˜Â©.',
      'Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â±Ã™â€¦Ã˜Â² Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â­Ã˜Â¯Ã˜Â© Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â¥Ã™â€šÃ™â€ Ã˜Â§Ã˜Â¹ Ã™â€¦Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â¬Ã™â€žÃ˜Â©.',
      'Ã™ÂÃ™â€šÃ˜Â¯Ã˜Â§Ã™â€  Ã™Ë†Ã˜ÂµÃ™Ë†Ã™â€ž Ã™â€¦Ã˜Â¤Ã™â€šÃ˜Âª Ã™â€žÃ™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™â€ Ã™â€šÃ˜Â± Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±.',
      'Ã˜ÂªÃ˜Â²Ã˜Â§Ã™Å Ã˜Â¯ Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž "Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨" Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â³Ã˜Â¨Ã˜Â¨ Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Ë†Ã™Â.',
    ],
    lurePatterns: [
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â¹Ã˜Â§Ã˜Â¬Ã™â€žÃ˜Â© Ã˜ÂªÃ˜Â¯Ã™â€˜Ã˜Â¹Ã™Å  Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã™Ë†Ã˜ÂªÃ˜ÂªÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã˜Â¬Ã™Ë†Ã˜Â§Ã˜Â¦Ã˜Â² Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å Ã˜Â© Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â© Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â©.',
      'Ã˜Â§Ã™â€ Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ž Ã˜ÂµÃ™ÂÃ˜Â© Ã˜ÂµÃ˜Â¯Ã™Å Ã™â€š Ã™â€¦Ã˜Â¹ Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· "Ã™â€¦Ã™â€¡Ã™â€¦ Ã˜Â¬Ã˜Â¯Ã™â€¹Ã˜Â§" Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜ÂªÃ˜Â§Ã˜Â¯.',
      'Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜ÂªÃ˜Â®Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¬Ã™â€¡Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜ÂµÃ™ÂÃ˜Â­Ã˜Â©.',
      'Ã™â€ Ã™Ë†Ã˜Â§Ã™ÂÃ˜Â° Ã˜Â¯Ã™ÂÃ˜Â¹ Ã˜Â£Ã™Ë† Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â© Ã˜ÂªÃ˜Â­Ã˜ÂµÃ˜Â¯ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â©.',
    ],
    prevention: [
      'Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€¦Ã™â€ : Ã˜Â§Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â§Ã™â€žÃ™â€ Ã˜Â·Ã˜Â§Ã™â€š Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã˜Â¥Ã˜Â¯Ã˜Â®Ã˜Â§Ã™â€ž Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª.',
      'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â¥Ã˜Â¯Ã˜Â®Ã˜Â§Ã™â€ž OTP Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™â€¦Ã™Å  Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â§ Ã™Æ’Ã˜Â§Ã™â€ Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã™â€¦Ã™â€šÃ™â€ Ã˜Â¹Ã˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜Â¯Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™â€žÃ˜Â§ Ã™Å Ã™â€¦Ã™â€žÃ˜Â£ Ã˜Â§Ã™â€žÃ™â€ Ã™â€¦Ã˜Â§Ã˜Â°Ã˜Â¬ Ã˜Â¹Ã™â€žÃ™â€° Ã™â€ Ã˜Â·Ã˜Â§Ã™â€š Ã™â€¦Ã˜Â²Ã™Å Ã™Â.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã˜Â§Ã˜Â­Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€ž Ã˜ÂªÃ˜ÂµÃ™Å Ã˜Â¯ Ã™â€ Ã˜Â´Ã˜Â· Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜Â±Ã™â€¦Ã˜Â² Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™â€¦Ã™â€  Ã˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€š Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¨.',
      'Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã˜Â¬Ã™â€¦Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜ÂµÃ™â€žÃ˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹',
        opener: 'Ã˜Â£Ã™Å  Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã™â€¦Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â¬Ã™â€žÃ˜Â© Ã™â€¡Ã™Å  Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â© Ã˜ÂªÃ™Ë†Ã™â€šÃ™ÂÃ˜Å’ Ã™Ë†Ã™â€žÃ™Å Ã˜Â³Ã˜Âª Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â© Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°.',
        advice: 'Ã˜Â²Ã˜Â±Ã˜Â¹ Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© "Ã˜ÂªÃ™Ë†Ã™â€šÃ™Â 30 Ã˜Â«Ã˜Â§Ã™â€ Ã™Å Ã˜Â©" Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ˜Â± Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã™Ë†Ã˜Â§Ã˜Â¯Ã˜Â« Ã™Æ’Ã˜Â«Ã™Å Ã˜Â±Ã™â€¹Ã˜Â§.',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«',
        opener: 'Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â£ Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž Ã™â€žÃ™â€žÃ˜Â¥Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã˜Å’ Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã™â€¦ Ã˜Â£Ã™â€  Ã™â€ Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã™â€ Ã™â€¦Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â¯Ã˜Â§Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€šÃ˜Â§Ã˜Â¯Ã™â€¦.',
        advice: 'Ã˜Â­Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã˜Â¯Ã˜Â« Ã˜Â¥Ã™â€žÃ™â€° Ã˜ÂªÃ™â€¦Ã˜Â±Ã™Å Ã™â€  Ã™â€¦Ã˜Â¹Ã˜Â±Ã™ÂÃ™Å  Ã™Ë†Ã™â€žÃ™Å Ã˜Â³ Ã™â€žÃ˜Â­Ã˜Â¸Ã˜Â© Ã˜ÂªÃ˜Â£Ã™â€ Ã™Å Ã˜Â¨.',
      },
    ],
  },
  crypto_scams: {
    symptoms: [
      'Ã˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã˜Â¹Ã™â€  Ã˜Â£Ã˜Â±Ã˜Â¨Ã˜Â§Ã˜Â­ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜Â¶Ã™â€¦Ã™Ë†Ã™â€ Ã˜Â© Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±.',
      'Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â¶Ã™â€¦Ã˜Â§Ã™â€¦ Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â«Ã™â€¦Ã˜Â§Ã˜Â±Ã™Å Ã˜Â© Ã™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¡Ã™Ë†Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª Ã˜ÂµÃ˜ÂºÃ™Å Ã˜Â±Ã˜Â© Ã˜ÂªÃ˜Â¬Ã˜Â±Ã™Å Ã˜Â¨Ã™Å Ã˜Â© Ã˜ÂªÃ˜ÂªÃ˜Â²Ã˜Â§Ã™Å Ã˜Â¯ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â¥Ã˜Â´Ã˜Â±Ã˜Â§Ã™Â.',
      'Ã˜Â¶Ã˜ÂºÃ˜Â· Ã™â€ Ã™ÂÃ˜Â³Ã™Å  Ã˜Â¹Ã™â€ Ã˜Â¯ Ã™ÂÃ™Ë†Ã˜Â§Ã˜Âª "Ã™ÂÃ˜Â±Ã˜ÂµÃ˜Â© Ã˜Â¹Ã™â€¦Ã™â€žÃ˜Â©" Ã™â€¦Ã˜Â²Ã˜Â¹Ã™Ë†Ã™â€¦Ã˜Â©.',
      'Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â³Ã™Ë†Ã™Å Ã™â€šÃ™Å Ã˜Â© Ã™â€¦Ã˜Â«Ã™â€ž "Ã™â€¦Ã˜Â¤Ã™Æ’Ã˜Â¯/Ã™â€¦Ã˜Â¶Ã™â€¦Ã™Ë†Ã™â€ /Ã˜Â³Ã˜Â±Ã™Å ".',
    ],
    lurePatterns: [
      'Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¶Ã˜Â® Ã˜Â¹Ã™â€¦Ã™â€žÃ˜Â© Ã˜Â«Ã™â€¦ Ã˜ÂªÃ˜Â¯Ã˜Â¹Ã™Ë† Ã™â€žÃ™â€žÃ˜Â¨Ã™Å Ã˜Â¹ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜Â£Ã˜Â®Ã˜Â±Ã™Å Ã™â€ .',
      'Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã˜Â±Ã˜Â¨Ã˜Â§Ã˜Â­Ã™â€¹Ã˜Â§ Ã™â€¦Ã˜ÂµÃ˜Â·Ã™â€ Ã˜Â¹Ã˜Â© Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€žÃ™Ë†Ã˜Â­Ã˜Â© Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â©.',
      'Ã™Ë†Ã˜Â¹Ã™Ë†Ã˜Â¯ Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯ Ã˜Â®Ã˜Â³Ã˜Â§Ã˜Â¦Ã˜Â± Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â© Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â¥Ã˜Â¶Ã˜Â§Ã™ÂÃ™Å .',
      'Ã˜Â§Ã™â€ Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ž Ã˜Â®Ã˜Â¨Ã™Å Ã˜Â± Ã˜ÂªÃ˜Â¯Ã˜Â§Ã™Ë†Ã™â€ž Ã™â€¦Ã˜Â¹ Ã™â€žÃ™â€šÃ˜Â·Ã˜Â§Ã˜Âª Ã˜Â£Ã˜Â±Ã˜Â¨Ã˜Â§Ã˜Â­ Ã™â€¦Ã™ÂÃ˜Â¨Ã˜Â±Ã™Æ’Ã˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜Â¤Ã˜Â«Ã˜Â±Ã™Å Ã™â€  Ã˜ÂµÃ˜ÂºÃ˜Â§Ã˜Â± Ã™â€žÃ˜Â¥Ã˜Â¶Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â´Ã˜Â±Ã˜Â¹Ã™Å Ã˜Â© Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹.',
    ],
    prevention: [
      'Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â£Ã™Å  Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â¨Ã™â€šÃ˜Â©.',
      'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©: Ã˜Â¥Ã˜Â°Ã˜Â§ Ã˜Â¨Ã˜Â¯Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â¨Ã˜Â­ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™â€ Ã˜Â·Ã™â€šÃ™Å  Ã™ÂÃ™â€¡Ã™Ë† Ã˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã™â€¹Ã˜Â§ Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž.',
      'Ã˜Â­Ã˜ÂµÃ˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã™ÂÃ™Å  Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€¦Ã™Å Ã˜Â© Ã™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã™ÂÃ™â€šÃ˜Â·.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã™â€¦Ã˜Â¹ Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ™Å Ã˜Â© Ã˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â©.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜Â¬Ã™â€¦Ã™Å Ã˜Â¯ Ã˜Â£Ã™Å  Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â¥Ã˜Â¶Ã˜Â§Ã™ÂÃ™Å Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§ Ã˜Â­Ã˜ÂªÃ™â€° Ã˜Â§Ã™Æ’Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š.',
      'Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â§Ã™ÂÃ˜Â¸/Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã™Ë†Ã™Å Ã™â€ /Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â±Ã™ÂÃ˜Â§Ã˜Âª Ã™â€šÃ˜Â¨Ã™â€ž Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯.',
    ],
    dialogues: [
      {
        situation: 'Ã˜ÂªÃ™ÂÃ™Æ’Ã™Å Ã™Æ’ Ã˜Â§Ã™â€žÃ™Ë†Ã™â€¡Ã™â€¦',
        opener: 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ˜Â§Ã™â€ž Ã™Å Ã˜Â¨Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã˜Â¹Ã˜Â©Ã˜Å’ Ã˜Â¨Ã™Å Ã™â€ Ã™â€¦Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â«Ã™â€¦Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å  Ã™Å Ã˜Â¨Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â¶Ã˜Â¨Ã˜Â§Ã˜Â·.',
        advice: 'Ã˜Â¶Ã˜Â¹ Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â±Ã™â€ Ã˜Â© Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â© Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€žÃ™Å  Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂµÃ˜Â­Ã™Å Ã˜Â­.',
      },
      {
        situation: 'Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â¨Ã™â€žÃ™Å Ã˜Â©',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â¨Ã™â€ Ã™Å  Ã™â€žÃ™Æ’ Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€¦Ã˜Â© Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€ Ã˜ÂªÃ˜Â±Ã™â€ Ã˜Âª.',
        advice: 'Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Checklist Ã™Å Ã˜Â®Ã™ÂÃ™Â Ã™â€šÃ˜Â±Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€žÃ˜Â­Ã˜Â¸Ã™Å .',
      },
    ],
  },
  self_harm: {
    symptoms: [
      'Ã™â€¦Ã™â€ Ã˜Â´Ã™Ë†Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â­Ã™â€¦Ã™â€ž Ã™Å Ã˜Â£Ã˜Â³Ã™â€¹Ã˜Â§ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€ Ã˜Â¹Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€šÃ™Å Ã™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±.',
      'Ã˜Â§Ã™â€ Ã˜Â¹Ã˜Â²Ã˜Â§Ã™â€ž Ã˜Â­Ã˜Â§Ã˜Â¯ Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³.',
      'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â®Ã™â€žÃ˜Âµ Ã™â€¦Ã™â€  Ã˜Â£Ã˜Â´Ã™Å Ã˜Â§Ã˜Â¡ Ã™â€¦Ã˜Â­Ã˜Â¨Ã˜Â¨Ã˜Â© Ã˜Â£Ã™Ë† Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™Ë†Ã˜Â¯Ã˜Â§Ã˜Â¹Ã™Å Ã˜Â© Ã™â€¦Ã˜Â¨Ã˜Â·Ã™â€ Ã˜Â©.',
      'Ã˜Â§Ã˜Â¶Ã˜Â·Ã˜Â±Ã˜Â§Ã˜Â¨ Ã˜Â£Ã™Æ’Ã™â€ž/Ã™â€ Ã™Ë†Ã™â€¦ Ã˜Â­Ã˜Â§Ã˜Â¯ Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜Â­Ã˜Â§Ã™â€žÃ˜Â© Ã™â€ Ã™ÂÃ˜Â³Ã™Å Ã˜Â© Ã™â€¦Ã˜ÂªÃ˜Â¯Ã™â€¡Ã™Ë†Ã˜Â±Ã˜Â©.',
      'Ã˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¹Ã™â€  Ã˜Â·Ã˜Â±Ã™â€š Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â£Ã™Ë† Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â´Ã˜Â¬Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â°Ã™Å .',
    ],
    lurePatterns: [
      'Ã™â€¦Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜ÂªÃ™â€¦Ã˜Â¬Ã™â€˜Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â£Ã™â€žÃ™â€¦ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å  Ã™Ë†Ã˜ÂªÃ˜Â·Ã˜Â¨Ã˜Â¹ Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â§Ã˜Âª.',
      'Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¨Ã˜ÂµÃ˜Â±Ã™Å  Ã™â€¦Ã˜Â­Ã™ÂÃ™â€˜Ã˜Â² Ã™Å Ã™â€šÃ˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã™Æ’Ã˜Â­Ã™â€ž Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â®Ã™ÂÃ™Å Ã™Â.',
      'Ã˜Â£Ã™â€šÃ˜Â±Ã˜Â§Ã™â€  Ã™Å Ã˜Â¯Ã™ÂÃ˜Â¹Ã™Ë†Ã™â€  Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â°Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â­Ã˜Âª Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â± "Ã˜Â¥Ã˜Â«Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€šÃ™Ë†Ã˜Â©".',
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜ÂªÃ˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€  Ã™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â¹Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å .',
      'Ã˜Â³Ã˜Â±Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â±Ã™Ë†Ã™â€¦Ã˜Â§Ã™â€ Ã˜Â³Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â§Ã™â€ Ã˜Â§Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€šÃ™Å Ã™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â©.',
    ],
    prevention: [
      'Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â© Ã™â€¦Ã™Æ’Ã˜ÂªÃ™Ë†Ã˜Â¨Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â¬Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â§Ã˜ÂªÃ˜ÂµÃ˜Â§Ã™â€ž Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã™â€¡Ã™Ë†Ã˜Â± Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å  (Ã™â€ Ã™Ë†Ã™â€¦/Ã™â€¦Ã˜Â²Ã˜Â§Ã˜Â¬/Ã˜Â´Ã™â€¡Ã™Å Ã˜Â©/Ã˜Â§Ã™â€ Ã˜Â³Ã˜Â­Ã˜Â§Ã˜Â¨).',
      'Ã˜Â¥Ã˜Â­Ã˜Â§Ã™â€žÃ˜Â© Ã™â€¦Ã˜Â®Ã˜ÂªÃ˜Âµ Ã™â€ Ã™ÂÃ˜Â³Ã™Å  Ã™â€¦Ã˜Â¨Ã™Æ’Ã˜Â± Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â£Ã™Å  Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â­Ã˜Â±Ã˜Â¬Ã˜Â© Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â©.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬ Ã˜Â¬Ã˜Â¯Ã™â€¹Ã˜Â§: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â°Ã˜Â§Ã˜ÂªÃ™Å  Ã˜ÂªÃ˜ÂªÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€žÃ™â€¹Ã˜Â§ Ã™â€ Ã™ÂÃ˜Â³Ã™Å Ã™â€¹Ã˜Â§ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™â€¦Ã™â€žÃ˜Â© Ã™â€žÃ™â€žÃ˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€šÃ˜Â±Ã™Å Ã˜Â¨Ã˜Â© Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â©.',
      'Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã˜ÂªÃ˜Â±Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™Ë†Ã˜Â­Ã™Å Ã˜Â¯Ã™â€¹Ã˜Â§ Ã˜Â¹Ã™â€ Ã˜Â¯ Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â®Ã˜Â·Ã˜Â± Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â©.',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™ÂÃ™Ë†Ã˜Â±Ã™Å ',
        opener: 'Ã˜Â³Ã™â€žÃ˜Â§Ã™â€¦Ã˜ÂªÃ™Æ’ Ã˜Â£Ã™â€¡Ã™â€¦ Ã™â€¦Ã™â€  Ã˜Â£Ã™Å  Ã˜Â´Ã™Å Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ Ã˜Å’ Ã™Ë†Ã˜Â³Ã˜Â£Ã˜Â¨Ã™â€šÃ™â€° Ã™â€¦Ã˜Â¹Ã™Æ’ Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â© Ã˜Â¨Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â©.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã™â€žÃ™â€° Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã˜ÂªÃ™Æ’Ã™Ë†Ã™â€  Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€ Ã™â€¹Ã˜Â§ Ã™â€žÃ˜Â§ Ã˜ÂªÃ˜Â­Ã™â€šÃ™Å Ã™â€šÃ™â€¹Ã˜Â§.',
      },
      {
        situation: 'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©',
        opener: 'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â·Ã˜Â¨Ã™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å Ã˜Â© Ã™â€¡Ã™Ë† Ã™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã™â€šÃ™Ë†Ã˜Â© Ã™Ë†Ã™â€žÃ™Å Ã˜Â³ Ã˜Â¶Ã˜Â¹Ã™ÂÃ™â€¹Ã˜Â§.',
        advice: 'Ã˜Â£Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ™Ë†Ã˜ÂµÃ™â€¦Ã˜Â© Ã˜Â¹Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜Âµ Ã™â€¦Ã˜Â¨Ã™Æ’Ã˜Â±Ã™â€¹Ã˜Â§.',
      },
    ],
  },
  sexual_exploitation: {
    symptoms: [
      'Ã˜Â³Ã˜Â±Ã™Å Ã˜Â© Ã™â€¦Ã™ÂÃ˜Â±Ã˜Â·Ã˜Â© Ã˜Â­Ã™Ë†Ã™â€ž Ã˜Â¬Ã™â€¡Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯Ã˜Â©.',
      'Ã˜ÂªÃ™â€žÃ™â€šÃ™Å  Ã™â€¡Ã˜Â¯Ã˜Â§Ã™Å Ã˜Â§/Ã˜Â±Ã˜ÂµÃ™Å Ã˜Â¯/Ã˜Â§Ã™â€¦Ã˜ÂªÃ™Å Ã˜Â§Ã˜Â²Ã˜Â§Ã˜Âª Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜Â¨Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â³Ã™Å Ã˜Â± Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­.',
      'Ã™â€šÃ™â€žÃ™â€š Ã˜Â´Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â¹Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Â± Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™Å Ã˜Â±Ã˜Â§.',
      'Ã˜ÂªÃ˜Â¨Ã˜Â¯Ã™â€ž Ã™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™â€žÃ˜ÂºÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€ Ã˜Â³Ã™Å Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™â€žÃ˜Â§Ã˜Â¦Ã™â€¦Ã˜Â© Ã™â€žÃ™â€žÃ˜Â¹Ã™â€¦Ã˜Â±.',
      'Ã˜Â±Ã™ÂÃ˜Â¶ Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â£Ã™Å  Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã˜Â¹Ã™â€  Ã˜Â¹Ã™â€žÃ˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© "Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â© Ã˜Â¬Ã˜Â¯Ã™â€¹Ã˜Â§".',
    ],
    lurePatterns: [
      'Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â§Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â· Ã˜Â¹Ã˜Â§Ã˜Â·Ã™ÂÃ™Å  Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹ Ã˜Â«Ã™â€¦ Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â© Ã™â€¦Ã˜Â·Ã™â€žÃ™â€šÃ˜Â©.',
      'Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂµÃ™Ë†Ã˜Â± "Ã˜Â¹Ã˜Â§Ã˜Â¯Ã™Å Ã˜Â©" Ã˜Â£Ã™Ë†Ã™â€žÃ™â€¹Ã˜Â§.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â°Ã™â€ Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â·Ã™ÂÃ™Å  Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â¨Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â±.',
      'Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¨Ã™Æ’Ã˜Â´Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«Ã˜Â§Ã˜Âª Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€šÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â·Ã˜Â±Ã˜Â©.',
      'Ã™â€ Ã™â€šÃ™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª Ã˜Â£Ã™â€šÃ™â€ž Ã˜Â±Ã™â€šÃ˜Â§Ã˜Â¨Ã˜Â© Ã™Ë†Ã˜Â£Ã™Æ’Ã˜Â«Ã˜Â± Ã˜Â§Ã˜Â®Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¡Ã™â€¹.',
    ],
    prevention: [
      'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€¦ Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©: Ã™â€žÃ˜Â§ Ã˜ÂµÃ™Ë†Ã˜Â± Ã˜Â®Ã˜Â§Ã˜ÂµÃ˜Â© Ã˜ÂªÃ˜Â­Ã˜Âª Ã˜Â£Ã™Å  Ã˜Â¸Ã˜Â±Ã™Â Ã˜Â£Ã™Ë† Ã˜Â¹Ã™â€žÃ˜Â§Ã™â€šÃ˜Â©.',
      'Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ˜Â§Ã™â€¦Ã˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™Ë†Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â±Ã˜Â¨Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™ÂÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¶Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ˜Â§Ã˜Â«Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â±Ã™Å Ã˜Â© Ã™â€¦Ã˜ÂªÃ™ÂÃ™â€š Ã˜Â¹Ã™â€žÃ™Å Ã™â€¡Ã˜Â§.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã™â€ Ã™â€¦Ã˜Â· Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å  Ã™â€¦Ã˜Â­Ã˜ÂªÃ™â€¦Ã™â€ž Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â¹Ã˜Â¯ Ã™ÂÃ™Å  Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â©.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§ Ã™â€¦Ã˜Â¹ Ã˜Â­Ã™ÂÃ˜Â¸ Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¸Ã˜Â±.',
      'Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã˜Â¡ Ã˜Â¨Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â±Ã˜Â³Ã™â€¦Ã™Å Ã˜Â© Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜ÂªÃ™â€¦Ã˜Â¯Ã˜Â©.',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â±',
        opener: 'Ã˜Â£Ã™Å  Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã˜Â­Ã˜ÂµÃ™â€ž Ã™â€žÃ™Å Ã˜Â³ Ã˜Â®Ã˜Â·Ã˜Â£Ã™Æ’Ã˜Å’ Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â¤Ã™Ë†Ã™â€žÃ™Å Ã˜Â© Ã™Æ’Ã˜Â§Ã™â€¦Ã™â€žÃ˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜ÂªÃ˜Â¯Ã™Å .',
        advice: 'Ã™â€¦Ã™â€ Ã˜Â¹ Ã™â€žÃ™Ë†Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â­Ã™Å Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â§Ã˜Â³ Ã™â€ Ã˜Â¬Ã˜Â§Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â©.',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯',
        opener: 'Ã˜Â¬Ã˜Â³Ã™â€¦Ã™Æ’ Ã™Ë†Ã˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜ÂªÃ™Æ’ Ã˜Â®Ã˜Â· Ã˜Â£Ã˜Â­Ã™â€¦Ã˜Â±Ã˜Å’ Ã™Ë†Ã™â€žÃ˜Â§ Ã˜Â£Ã˜Â­Ã˜Â¯ Ã™Å Ã™â€¦Ã™â€žÃ™Æ’ Ã˜Â­Ã™â€š Ã˜ÂªÃ˜Â¬Ã˜Â§Ã™Ë†Ã˜Â²Ã™â€¡Ã™â€¦Ã˜Â§.',
        advice: 'Ã˜Â¹Ã˜Â²Ã™â€˜Ã˜Â² Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â¨Ã˜Â·Ã˜Â±Ã™Å Ã™â€šÃ˜Â© Ã˜Â­Ã˜Â§Ã˜Â²Ã™â€¦Ã˜Â© Ã™Ë†Ã˜Â¯Ã˜Â§Ã˜Â¹Ã™â€¦Ã˜Â© Ã™ÂÃ™Å  Ã˜Â¢Ã™â€  Ã™Ë†Ã˜Â§Ã˜Â­Ã˜Â¯.',
      },
    ],
  },
  account_theft_fraud: {
    symptoms: [
      'Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â®Ã˜Â±Ã™Ë†Ã˜Â¬ Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â¯Ã™Ë†Ã™â€  Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â¨Ã˜Â§Ã™â€ž Ã˜Â±Ã™â€¦Ã™Ë†Ã˜Â² Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â±Ã™Å Ã˜Â¯/Ã˜Â§Ã™â€žÃ™â€¡Ã˜Â§Ã˜ÂªÃ™Â.',
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â±Ã˜Â§Ã˜Âª Ã™â€¦Ã™ÂÃ˜Â§Ã˜Â¬Ã˜Â¦Ã˜Â© Ã™ÂÃ™Å  Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â±Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž.',
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã™â€žÃ˜Â£Ã˜ÂµÃ˜Â¯Ã™â€šÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™â€žÃ™â€¦ Ã™Å Ã˜Â±Ã˜Â³Ã™â€žÃ™â€¡Ã˜Â§ Ã™â€¡Ã™Ë† Ã™ÂÃ˜Â¹Ã™â€žÃ™Å Ã™â€¹Ã˜Â§.',
      'Ã˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€š/Ã™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¬Ã™â€¡Ã™Ë†Ã™â€žÃ˜Â© Ã™â€¦Ã™â€  Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â©.',
    ],
    lurePatterns: [
      'Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã™â€¦Ã™â€šÃ™â€žÃ˜Â¯Ã˜Â© Ã˜ÂªÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.',
      'Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â± Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â©.',
      'Ã˜Â®Ã˜Â¯Ã˜Â§Ã˜Â¹ Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã™ÂÃ™â€ Ã™Å  Ã™â€¦Ã˜Â²Ã™Å Ã™Â Ã™Å Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â±Ã™â€¦Ã˜Â² Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™â€¦Ã™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜ÂªÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¨Ã˜Â§Ã˜Âª Ã™â€šÃ˜Â¯Ã™Å Ã™â€¦Ã˜Â©.',
      'Ã˜Â³Ã˜Â±Ã™â€šÃ˜Â© Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â¹Ã˜Â¨Ã˜Â± Ã™â€¦Ã™â€žÃ™ÂÃ˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¹Ã˜Â±Ã™Å Ã™Â Ã˜Â§Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â· Ã˜Â£Ã™Ë† Ã˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€¦Ã˜Â©.',
    ],
    prevention: [
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™ÂÃ˜Â±Ã™Å Ã˜Â¯Ã˜Â© Ã™â€žÃ™Æ’Ã™â€ž Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â¯Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã™Ë†Ã˜Â±.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â«Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â© (2FA) Ã™Ë†Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â¨Ã˜Â¨Ã˜Â±Ã™Å Ã˜Â¯ Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯ Ã˜Â¢Ã™â€¦Ã™â€  Ã™Ë†Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€šÃ™â€ž.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã™â€¹Ã˜Â§ Ã™Ë†Ã˜Â§Ã™Æ’Ã˜ÂªÃ˜Â´Ã˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â±Ã™Å Ã˜Â¨Ã˜Â©.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â³Ã˜ÂªÃ™Å Ã™â€žÃ˜Â§Ã˜Â¡ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â£Ã™Ë† Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€š Ã™â€¦Ã˜ÂªÃ™â€šÃ˜Â¯Ã™â€¦Ã˜Â©.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜Â¯Ã™Ë†Ã™Å Ã˜Â± Ã˜Â¬Ã™â€¦Ã™Å Ã˜Â¹ Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜Â±Ã™â€š.',
      'Ã˜Â¥Ã™â€žÃ˜ÂºÃ˜Â§Ã˜Â¡ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬Ã™Å Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã˜Â«Ã™Ë†Ã™â€šÃ˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â³Ã˜ÂªÃ˜Â¹Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â¨Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©Ã˜Å’ Ã™Ë†Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Âª Ã™â€¡Ã™â€ Ã˜Â§ Ã™â€¦Ã™â€¡Ã™â€¦ Ã˜Â¬Ã˜Â¯Ã™â€¹Ã˜Â§.',
        advice: 'Ã˜Â¥Ã˜Â¹Ã˜Â·Ã˜Â§Ã˜Â¡ Ã˜ÂªÃ˜Â³Ã™â€žÃ˜Â³Ã™â€ž Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­ Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â¹Ã˜Â± Ã™Ë†Ã™Å Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã™Æ’Ã™Å Ã˜Â².',
      },
      {
        situation: 'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€¦ Ã˜Â£Ã™â€¦Ã™â€ Ã™Å ',
        opener: 'Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Å’ Ã˜Â³Ã™â€ Ã˜Â¨Ã™â€ Ã™Å  Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜ÂªÃ™â€¦Ã™â€ Ã˜Â¹ Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â± Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ˜Â«Ã˜ÂºÃ˜Â±Ã˜Â©.',
        advice: 'Ã˜Â­Ã™Ë†Ã™â€˜Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã˜Â¯Ã˜Â« Ã˜Â¥Ã™â€žÃ™â€° Ã˜ÂªÃ˜Â±Ã™â€šÃ™Å Ã˜Â© Ã™ÂÃ˜Â¹Ã™â€žÃ™Å Ã˜Â© Ã™ÂÃ™Å  Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€ .',
      },
    ],
  },
  gambling_betting: {
    symptoms: [
      'Ã˜Â§Ã™â€ Ã˜Â´Ã˜ÂºÃ˜Â§Ã™â€ž Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â± Ã˜Â¨Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â±Ã™Å Ã˜Â§Ã˜Âª/Ã˜Â±Ã™â€¡Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â©.',
      'Ã˜Â·Ã™â€žÃ˜Â¨ Ã˜Â£Ã™â€¦Ã™Ë†Ã˜Â§Ã™â€ž Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â¨Ã˜Â±Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â³Ã™â€šÃ˜Â©.',
      'Ã˜ÂªÃ™â€šÃ™â€žÃ˜Â¨ Ã™â€¦Ã˜Â²Ã˜Â§Ã˜Â¬ Ã˜Â­Ã˜Â§Ã˜Â¯ Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜Â³Ã˜Â¨ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ™â€žÃ˜Â­Ã˜Â¸Ã™Å Ã˜Â©.',
      'Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™ÂÃ™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã™â€¦Ã˜Â³Ã˜Â¨Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹.',
      'Ã™â€¦Ã˜Â·Ã˜Â§Ã˜Â±Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â¹Ã˜Â¨Ã˜Â± Ã™â€¦Ã˜Â¶Ã˜Â§Ã˜Â¹Ã™ÂÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€¡Ã˜Â§Ã™â€  Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™Æ’Ã™â€ž Ã™â€¡Ã˜Â¨Ã™Ë†Ã˜Â·.',
    ],
    lurePatterns: [
      'Ã˜Â¹Ã˜Â±Ã™Ë†Ã˜Â¶ Ã˜ÂªÃ˜Â±Ã˜Â­Ã™Å Ã˜Â¨Ã™Å Ã˜Â© Ã™â€¦Ã˜Â¬Ã˜Â§Ã™â€ Ã™Å Ã˜Â© Ã˜ÂªÃ™â€šÃ™Ë†Ã˜Â¯ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å Ã™â€¹Ã˜Â§ Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â± Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.',
      'Ã˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª "Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¬Ã˜Â§Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ " Ã™â€žÃ˜ÂªÃ˜Â´Ã˜Â¬Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹.',
      'Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â±Ã™â€¡Ã˜Â§Ã™â€  Ã˜Â¨Ã™â€¡Ã™Ë†Ã™Å Ã˜Â© Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å Ã˜Â© Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â£Ã˜ÂµÃ˜Â¯Ã™â€šÃ˜Â§Ã˜Â¡.',
      'Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€šÃ˜Â§Ã™â€¦Ã˜Â±Ã˜Â© Ã˜Â¥Ã™â€žÃ™â€° Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã˜Â³Ã™â€¡Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â®Ã™Ë†Ã™â€ž.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã˜Â¹Ã™â€¦Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¨Ã˜Â© Ã™â€žÃ˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â·Ã˜Â§Ã˜Â¨Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€šÃ™â€¦Ã˜Â§Ã˜Â±Ã™Å .',
    ],
    prevention: [
      'Ã˜Â­Ã˜Â¸Ã˜Â± Ã™â€¦Ã™â€ Ã˜ÂµÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã™â€¡Ã™â€ Ã˜Â© Ã™Ë†Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã™â€¡Ã˜Â§ Ã˜ÂªÃ™â€šÃ™â€ Ã™Å Ã™â€¹Ã˜Â§.',
      'Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â³Ã™â€šÃ™Â Ã˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€š Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã˜ÂµÃ™ÂÃ˜Â±Ã™Å  Ã™â€žÃ™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â©.',
      'Ã˜Â¨Ã˜Â±Ã™â€ Ã˜Â§Ã™â€¦Ã˜Â¬ Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã™ÂÃ™Ë†Ã˜Â±Ã™Å  (Ã˜Â±Ã™Å Ã˜Â§Ã˜Â¶Ã˜Â©/Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜Â¬Ã™â€¦Ã˜Â§Ã˜Â¹Ã™Å /Ã™â€¦Ã™Æ’Ã˜Â§Ã™ÂÃ˜Â¢Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©).',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€¡Ã™â€ Ã˜Â© Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â± Ã˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€¦Ã˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â©.',
    ],
    incidentPlan: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã™Ë†Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹ Ã™Ë†Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â¨Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â±.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€š Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã™â€  Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«.',
    ],
    dialogues: [
      {
        situation: 'Ã™ÂÃ™Æ’ Ã˜Â¯Ã˜Â§Ã˜Â¦Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â©',
        opener: 'Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â© Ã˜ÂªÃ˜Â¹Ã™Ë†Ã™Å Ã˜Â¶ Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â¨Ã˜Â³Ã˜Â±Ã˜Â¹Ã˜Â© Ã˜ÂªÃ˜Â²Ã™Å Ã˜Â¯Ã™â€¡Ã˜Â§ Ã˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã™â€¹Ã˜Â§Ã˜Å’ Ã™ÂÃ™â€žÃ™â€ Ã™Ë†Ã™â€šÃ™Â Ã˜Â§Ã™â€žÃ˜Â­Ã™â€žÃ™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ .',
        advice: 'Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â­ Ã™â€¦Ã™ÂÃ™â€¡Ã™Ë†Ã™â€¦ "Ã™â€¦Ã˜Â·Ã˜Â§Ã˜Â±Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â©" Ã˜Â¨Ã™â€žÃ˜ÂºÃ˜Â© Ã˜Â¨Ã˜Â³Ã™Å Ã˜Â·Ã˜Â© Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ˜Â© Ã™â€žÃ™â€žÃ™ÂÃ™â€¡Ã™â€¦.',
      },
      {
        situation: 'Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜Â§Ã™ÂÃ˜Â£Ã˜Â©',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â¨Ã˜Â¯Ã™â€ž Ã˜Â¥Ã˜Â«Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€¡Ã˜Â§Ã™â€  Ã˜Â¨Ã˜Â¥Ã˜Â«Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â¥Ã™â€ Ã˜Â¬Ã˜Â§Ã˜Â² Ã˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å Ã˜Â© Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€žÃ™Æ’ Ã˜ÂªÃ™â€šÃ˜Â¯Ã™Å Ã˜Â±Ã™â€¹Ã˜Â§ Ã˜Â«Ã˜Â§Ã˜Â¨Ã˜ÂªÃ™â€¹Ã˜Â§.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã™Å Ã˜Â¬Ã˜Â§Ã˜Â¨Ã™Å  Ã™Å Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ˜Â°Ã™Å  Ã™Å Ã˜Â¹Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã™â€žÃ™â€šÃ˜Â¯Ã™Å Ã™â€¦.',
      },
    ],
  },
  privacy_tracking: {
    symptoms: [
      'Ã™â€¦Ã˜Â¹Ã˜Â±Ã™ÂÃ˜Â© Ã˜Â£Ã˜Â·Ã˜Â±Ã˜Â§Ã™Â Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬Ã™Å Ã˜Â© Ã˜Â¨Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Æ’Ã˜Â§Ã™â€ /Ã™Ë†Ã™â€šÃ˜Âª Ã™â€žÃ™â€¦ Ã™Å Ã™ÂÃ˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã™â€¡Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
      'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜ÂºÃ˜Â±Ã™Å Ã˜Â¨Ã˜Â© Ã˜Â°Ã˜Â§Ã˜Âª Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã™â€¦Ã™Ë†Ã™â€šÃ˜Â¹ Ã™Ë†Ã™â€¦Ã™Å Ã™Æ’Ã˜Â±Ã™Ë†Ã™ÂÃ™Ë†Ã™â€  Ã™â€¦Ã™ÂÃ˜Â±Ã˜Â·Ã˜Â©.',
      'Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â¨Ã™â€ Ã™Å Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â© Ã˜Â¯Ã™â€šÃ™Å Ã™â€šÃ˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€¡Ã™â€žÃ˜Â§Ã™Æ’ Ã˜Â¨Ã˜Â·Ã˜Â§Ã˜Â±Ã™Å Ã˜Â©/Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â·Ã˜Â¨Ã™Å Ã˜Â¹Ã™Å  Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±.',
      'Ã˜Â¸Ã™â€¡Ã™Ë†Ã˜Â± Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«Ã˜Â§Ã˜Âª Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â£Ã™â€ Ã™â€¡Ã˜Â§ "Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â± Ã˜Â¨Ã˜Â³Ã™Å Ã˜Â·".',
    ],
    lurePatterns: [
      'Ã˜Â¥Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€ž Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã˜ÂªÃ˜Â¯Ã™â€˜Ã˜Â¹Ã™Å  Ã™â€¦Ã˜Â¹Ã˜Â±Ã™ÂÃ˜Â© Ã™â€¦Ã™â€  Ã˜Â²Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨.',
      'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª "Ã˜Â®Ã˜Â¯Ã™â€¦Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â¬Ã˜Â§Ã™â€ Ã™Å Ã˜Â©" Ã˜ÂªÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â¬Ã˜Â³Ã˜Â³Ã™Å Ã˜Â© Ã™Æ’Ã˜Â§Ã™â€¦Ã™â€žÃ˜Â©.',
      'Ã˜Â¬Ã™â€¦Ã˜Â¹ Ã˜ÂµÃ™Ë†Ã˜Â±/Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â®Ã™â€žÃ™ÂÃ™Å Ã˜Â© Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦Ã™â€¡Ã˜Â§ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¯Ã™Ë†Ã™Æ’Ã˜Â³Ã™Å Ã™â€ Ã˜Âº.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â¨Ã™â€šÃ˜Â§Ã˜Âª Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å Ã˜Â© Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â±Ã˜Â§Ã˜Â¬ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã™Ë†Ã˜Â§Ã™â€  Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â©.',
      'Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã˜Â¨Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ˜Â¹ Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â¨Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â©.',
    ],
    prevention: [
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â´Ã™â€¡Ã˜Â±Ã™Å Ã˜Â© Ã™â€žÃ˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã™Ë†Ã˜Â¥Ã˜Â²Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â£Ã™Å  Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€žÃ˜Â§Ã˜Â²Ã™â€¦Ã˜Â©.',
      'Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™Ë†Ã™â€šÃ˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â§Ã˜Â¦Ã™â€¦Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â§Ã™Æ’Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¡ Ã˜Â¨Ã™â‚¬"Ã˜Â£Ã˜Â«Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦".',
      'Ã™â€¦Ã™â€ Ã˜Â¹ Ã™â€ Ã˜Â´Ã˜Â± Ã˜ÂµÃ™Ë†Ã˜Â± Ã˜ÂªÃ™Æ’Ã˜Â´Ã™Â Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã™Ë†Ã˜Â§Ã™â€  Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â© Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â±Ã™Ë†Ã˜ÂªÃ™Å Ã™â€  Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å .',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã˜Â§Ã˜Â­Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€ž Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹/Ã˜ÂªÃ˜Â¬Ã˜Â³Ã˜Â³ Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â©.',
    ],
    incidentPlan: [
      'Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã˜Â£Ã™â€¦Ã™â€ Ã™Å Ã™â€¹Ã˜Â§ Ã™Ë†Ã˜Â­Ã˜Â°Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™Ë†Ã˜Â¥Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â© Ã˜ÂªÃ˜Â¹Ã™Å Ã™Å Ã™â€  Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â§Ã˜Â³Ã™Å Ã˜Â©.',
    ],
    dialogues: [
      {
        situation: 'Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¹Ã™Å ',
        opener: 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂµÃ˜ÂºÃ™Å Ã˜Â±Ã˜Â© Ã™â€šÃ˜Â¯ Ã˜ÂªÃ™Æ’Ã˜Â´Ã™Â Ã˜Â­Ã™Å Ã˜Â§Ã˜ÂªÃ™Æ’ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€ž Ã˜Â¥Ã˜Â°Ã˜Â§ Ã˜ÂªÃ˜Â±Ã˜Â§Ã™Æ’Ã™â€¦Ã˜Âª.',
        advice: 'Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â­ Ã™â€¦Ã˜Â¨Ã˜Â¯Ã˜Â£ "Ã˜ÂªÃ˜Â¬Ã™â€¦Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª" Ã˜Â¨Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â®Ã™Ë†Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±.',
      },
      {
        situation: 'Ã˜Â§Ã™â€ Ã˜Â¶Ã˜Â¨Ã˜Â§Ã˜Â· Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â©',
        opener: 'Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã™â€ Ã˜Â´Ã˜Â±Ã˜Å’ Ã™â€ Ã˜Â³Ã˜Â£Ã™â€ž: Ã™â€¡Ã™â€ž Ã™â€¡Ã˜Â°Ã˜Â§ Ã™Å Ã™Æ’Ã˜Â´Ã™Â Ã™â€¦Ã™Æ’Ã˜Â§Ã™â€ Ã™â€ Ã˜Â§ Ã˜Â£Ã™Ë† Ã˜Â±Ã™Ë†Ã˜ÂªÃ™Å Ã™â€ Ã™â€ Ã˜Â§Ã˜Å¸',
        advice: 'Ã˜Â³Ã˜Â¤Ã˜Â§Ã™â€ž Ã™Ë†Ã˜Â§Ã˜Â­Ã˜Â¯ Ã˜Â«Ã˜Â§Ã˜Â¨Ã˜Âª Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â± Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å Ã™â€¹Ã˜Â§.',
      },
    ],
  },
  harmful_challenges: {
    symptoms: [
      'Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â§Ã˜Âª Ã˜ÂªÃ˜ÂµÃ™Ë†Ã™Å Ã˜Â± Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â®Ã˜Â·Ã™Å Ã˜Â± Ã˜Â¨Ã™â€¡Ã˜Â¯Ã™Â Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â± Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â­Ã˜ÂµÃ™Ë†Ã™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž.',
      'Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â± Ã˜Â¹Ã˜Â¨Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å  Ã™â€¦Ã˜Â«Ã™â€ž "Ã˜Â¥Ã˜Â°Ã˜Â§ Ã™â€žÃ™â€¦ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™â€ž Ã™ÂÃ˜Â£Ã™â€ Ã˜Âª Ã˜Â¶Ã˜Â¹Ã™Å Ã™Â".',
      'Ã˜Â¥Ã˜ÂµÃ˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â·Ã™ÂÃ™Å Ã™ÂÃ˜Â© Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ™ÂÃ˜Â³Ã™Å Ã˜Â±Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™â€šÃ™â€ Ã˜Â¹Ã˜Â©.',
      'Ã˜Â§Ã™â€ Ã˜Â¯Ã™ÂÃ˜Â§Ã˜Â¹ Ã™â€šÃ™Ë†Ã™Å  Ã™â€ Ã˜Â­Ã™Ë† Ã˜Â¥Ã˜Â«Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â§Ã˜Âª Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â© Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã™â€¦Ã˜Â¹Ã™Å Ã™â€ Ã˜Â©.',
      'Ã˜ÂªÃ˜Â¬Ã˜Â§Ã™â€¡Ã™â€ž Ã˜Â¹Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¨ Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ˜Â§Ã™â€¦Ã˜Â© Ã™â€¦Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž "Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã™â€ Ã˜Â¯" Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ˜Â´Ã˜Â§Ã˜Â±.',
    ],
    lurePatterns: [
      'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â¹Ã˜Â¯Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã˜Â³Ã™Å Ã˜Â·Ã˜Â© Ã˜Â«Ã™â€¦ Ã˜ÂªÃ™â€šÃ™ÂÃ˜Â² Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å .',
      'Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™â€šÃ˜Â¨Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â¨Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â®Ã˜Â·Ã˜Â± Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™Å Ã˜Â±Ã˜Â§.',
      'Ã˜Â§Ã™â€žÃ˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â§Ã˜Â²Ã™â€žÃ™Å  Ã˜Â£Ã™Ë† Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€šÃ˜ÂµÃ˜Â§Ã˜Â¡ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â©.',
      'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€¦Ã™Æ’Ã˜Â§Ã™ÂÃ˜Â¢Ã˜Âª Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â©/Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã™Å Ã™â€  Ã™Æ’Ã˜Â­Ã˜Â§Ã™ÂÃ˜Â² Ã™â€žÃ™â€žÃ™â€¦Ã˜Â¬Ã˜Â§Ã˜Â²Ã™ÂÃ˜Â©.',
      'Ã˜ÂªÃ˜Â¶Ã™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â± Ã˜Â¹Ã˜Â¨Ã˜Â± Ã™â€šÃ˜ÂµÃ˜Âµ Ã™â€ Ã˜Â¬Ã˜Â§Ã˜Â­ Ã™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â© Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â°Ã™Æ’Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¥Ã˜ÂµÃ˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª.',
    ],
    prevention: [
      'Ã˜Â³Ã™Å Ã˜Â§Ã˜Â³Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â±Ã™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­Ã˜Â©: Ã˜Â£Ã™Å  Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å  Ã˜Â¬Ã˜Â³Ã˜Â¯Ã™Å /Ã™â€¦Ã˜Â¤Ã˜Â°Ã™Â Ã™â€¦Ã˜Â±Ã™ÂÃ™Ë†Ã˜Â¶ Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      'Ã˜ÂªÃ˜Â¹Ã˜Â²Ã™Å Ã˜Â² Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â¥Ã™Å Ã˜Â¬Ã˜Â§Ã˜Â¨Ã™Å Ã˜Â© (Ã˜Â±Ã™Å Ã˜Â§Ã˜Â¶Ã˜Â©/Ã™â€¦Ã™â€¡Ã˜Â§Ã˜Â±Ã˜Â©/Ã™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹ Ã˜Â¥Ã˜Â¨Ã˜Â¯Ã˜Â§Ã˜Â¹Ã™Å ).',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â¯Ã™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â±Ã™â€ Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â§Ã˜Â¦Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â´Ã˜Â±Ã˜Â­ Ã™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±Ã™â€¡Ã˜Â§ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€šÃ˜Â¹Ã™Å Ã˜Â©.',
    ],
    alertTemplates: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã˜Â§Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â· Ã˜Â¨Ã™â€ Ã™â€¦Ã˜Â· Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â§Ã˜Âª Ã˜Â®Ã˜Â·Ã˜Â±Ã˜Â© Ã™â€šÃ˜Â¯ Ã™Å Ã™â€šÃ™Ë†Ã˜Â¯ Ã™â€žÃ˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±.',
    ],
    incidentPlan: [
      'Ã˜ÂªÃ˜Â¹Ã™â€žÃ™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª/Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â±Ã˜Â¶Ã˜Â© Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ™â€¹Ã˜Â§ Ã˜Â­Ã˜ÂªÃ™â€° Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Ë†Ã™Æ’.',
      'Ã˜ÂªÃ™â€šÃ™Å Ã™Å Ã™â€¦ Ã˜Â·Ã˜Â¨Ã™Å  Ã™ÂÃ™Ë†Ã˜Â±Ã™Å  Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â£Ã™Å  Ã˜Â¹Ã™â€žÃ˜Â§Ã™â€¦Ã˜Â© Ã˜Â¥Ã˜ÂµÃ˜Â§Ã˜Â¨Ã˜Â© Ã˜Â£Ã™Ë† Ã˜Â¥Ã˜Â±Ã™â€¡Ã˜Â§Ã™â€š Ã˜Â´Ã˜Â¯Ã™Å Ã˜Â¯.',
    ],
    dialogues: [
      {
        situation: 'Ã˜ÂªÃ™ÂÃ™Æ’Ã™Å Ã™Æ’ Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ˜Â£Ã™â€šÃ˜Â±Ã˜Â§Ã™â€ ',
        opener: 'Ã˜Â§Ã™â€žÃ™â€šÃ™Ë†Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã™â€šÃ™Å Ã™â€šÃ™Å Ã˜Â© Ã™â€¡Ã™Å  Ã˜Â±Ã™ÂÃ˜Â¶ Ã™â€¦Ã˜Â§ Ã™Å Ã˜Â¤Ã˜Â°Ã™Å Ã™Æ’ Ã˜Â­Ã˜ÂªÃ™â€° Ã™â€žÃ™Ë† Ã˜ÂµÃ™ÂÃ™â€š Ã™â€žÃ™â€¡ Ã˜Â§Ã™â€žÃ˜Â¢Ã˜Â®Ã˜Â±Ã™Ë†Ã™â€ .',
        advice: 'Ã˜Â­Ã™Ë†Ã™â€˜Ã™â€ž Ã˜ÂªÃ˜Â¹Ã˜Â±Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¬Ã˜Â§Ã˜Â¹Ã˜Â© Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±Ã˜Â© Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³.',
      },
      {
        situation: 'Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¡ Ã˜Â¢Ã™â€¦Ã™â€ ',
        opener: 'Ã˜Â³Ã™â€ Ã˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¹Ã™â€  Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â© Ã˜Â¥Ã™Å Ã˜Â¬Ã˜Â§Ã˜Â¨Ã™Å Ã˜Â© Ã˜ÂªÃ™â€šÃ˜Â¯Ã™â€˜Ã˜Â±Ã™Æ’ Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â· Ã˜Â®Ã˜Â·Ã˜Â±Ã˜Â©.',
        advice: 'Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¯Ã™Å Ã™â€ž Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â¬Ã™Ë†Ã˜Â¹ Ã™â€žÃ™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¶Ã˜Â§Ã˜Â±Ã˜Â©.',
      },
    ],
  },
};

const normalizeListEntry = (value: string) => value.replace(/\s+/g, ' ').trim();

const mergeUniqueStrings = (base: string[], extension: string[] = []) => {
  const seen = new Set<string>();
  const merged: string[] = [];
  [...base, ...extension].forEach((value) => {
    const normalized = normalizeListEntry(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    merged.push(normalized);
  });
  return merged;
};

const mergeInterventionSteps = (base: InterventionStep[], extension: InterventionStep[] = []) => {
  const seen = new Set<string>();
  const merged: InterventionStep[] = [];
  [...base, ...extension].forEach((step) => {
    const key = `${normalizeListEntry(step.week)}|${normalizeListEntry(step.goal)}|${normalizeListEntry(step.action)}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      week: normalizeListEntry(step.week),
      goal: normalizeListEntry(step.goal),
      action: normalizeListEntry(step.action),
    });
  });
  return merged;
};

const mergeDialogues = (
  base: GuidanceScenario['dialogues'],
  extension: GuidanceScenario['dialogues'] = []
) => {
  const seen = new Set<string>();
  const merged: GuidanceScenario['dialogues'] = [];
  [...base, ...extension].forEach((dialogue) => {
    const key = [
      normalizeListEntry(dialogue.situation),
      normalizeListEntry(dialogue.opener),
      normalizeListEntry(dialogue.advice),
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      situation: normalizeListEntry(dialogue.situation),
      opener: normalizeListEntry(dialogue.opener),
      advice: normalizeListEntry(dialogue.advice),
    });
  });
  return merged;
};

const guidanceScenarios: GuidanceScenario[] = guidanceScenariosBase.map((scenario) => {
  const extension = scenarioKnowledgeExtensions[scenario.id];
  if (!extension) return scenario;
  return {
    ...scenario,
    symptoms: mergeUniqueStrings(scenario.symptoms, extension.symptoms),
    lurePatterns: mergeUniqueStrings(scenario.lurePatterns, extension.lurePatterns),
    prevention: mergeUniqueStrings(scenario.prevention, extension.prevention),
    alertTemplates: mergeUniqueStrings(scenario.alertTemplates, extension.alertTemplates),
    incidentPlan: mergeUniqueStrings(scenario.incidentPlan, extension.incidentPlan),
    interventionProgram: mergeInterventionSteps(scenario.interventionProgram, extension.interventionProgram),
    dialogues: mergeDialogues(scenario.dialogues, extension.dialogues),
  };
});

const SCENARIO_CONTENT_MINIMUMS = {
  symptoms: 7,
  lurePatterns: 7,
  prevention: 6,
  incidentPlan: 6,
  alertTemplates: 3,
  dialogues: 4,
} as const;

if (import.meta.env.DEV) {
  const lowCoverage = guidanceScenarios
    .map((scenario) => {
      const gaps: string[] = [];
      if (scenario.symptoms.length < SCENARIO_CONTENT_MINIMUMS.symptoms) gaps.push('symptoms');
      if (scenario.lurePatterns.length < SCENARIO_CONTENT_MINIMUMS.lurePatterns) gaps.push('lurePatterns');
      if (scenario.prevention.length < SCENARIO_CONTENT_MINIMUMS.prevention) gaps.push('prevention');
      if (scenario.incidentPlan.length < SCENARIO_CONTENT_MINIMUMS.incidentPlan) gaps.push('incidentPlan');
      if (scenario.alertTemplates.length < SCENARIO_CONTENT_MINIMUMS.alertTemplates) gaps.push('alertTemplates');
      if (scenario.dialogues.length < SCENARIO_CONTENT_MINIMUMS.dialogues) gaps.push('dialogues');
      return gaps.length ? { id: scenario.id, gaps } : null;
    })
    .filter(Boolean) as Array<{ id: PsychScenarioId; gaps: string[] }>;

  if (lowCoverage.length) {
    console.warn('[PsychologicalInsightView] Scenario encyclopedia coverage gaps detected:', lowCoverage);
  }
}

const severityClassMap: Record<AlertSeverity, string> = {
  [AlertSeverity.CRITICAL]: 'bg-red-100 text-red-700 border-red-200',
  [AlertSeverity.HIGH]: 'bg-orange-100 text-orange-700 border-orange-200',
  [AlertSeverity.MEDIUM]: 'bg-amber-100 text-amber-700 border-amber-200',
  [AlertSeverity.LOW]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const severityTextMap: Record<AlertSeverity, string> = {
  [AlertSeverity.CRITICAL]: 'Ã˜Â­Ã˜Â±Ã˜Â¬',
  [AlertSeverity.HIGH]: 'Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹',
  [AlertSeverity.MEDIUM]: 'Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â³Ã˜Â·',
  [AlertSeverity.LOW]: 'Ã™â€¦Ã™â€ Ã˜Â®Ã™ÂÃ˜Â¶',
};

const scenarioGlassStyles: Record<PsychScenarioId, { tint: string; ring: string; button: string }> = {
  bullying: {
    tint: 'from-fuchsia-500/25 via-rose-400/20 to-pink-500/25',
    ring: 'shadow-fuchsia-500/20',
    button: 'from-fuchsia-500 to-rose-600',
  },
  threat_exposure: {
    tint: 'from-red-500/25 via-rose-500/20 to-orange-500/25',
    ring: 'shadow-red-500/25',
    button: 'from-red-500 to-rose-700',
  },
  gaming: {
    tint: 'from-indigo-500/25 via-blue-500/20 to-violet-500/25',
    ring: 'shadow-indigo-500/20',
    button: 'from-indigo-500 to-violet-600',
  },
  inappropriate_content: {
    tint: 'from-violet-500/25 via-fuchsia-500/20 to-indigo-500/25',
    ring: 'shadow-violet-500/20',
    button: 'from-violet-500 to-fuchsia-600',
  },
  cyber_crime: {
    tint: 'from-slate-500/25 via-cyan-500/20 to-slate-700/25',
    ring: 'shadow-slate-500/25',
    button: 'from-slate-600 to-cyan-700',
  },
  phishing_links: {
    tint: 'from-cyan-500/25 via-sky-500/20 to-blue-500/25',
    ring: 'shadow-cyan-500/20',
    button: 'from-cyan-500 to-blue-600',
  },
  crypto_scams: {
    tint: 'from-amber-500/25 via-orange-500/20 to-yellow-500/25',
    ring: 'shadow-amber-500/20',
    button: 'from-amber-500 to-orange-600',
  },
  self_harm: {
    tint: 'from-rose-600/25 via-red-500/20 to-pink-500/25',
    ring: 'shadow-rose-500/25',
    button: 'from-rose-600 to-red-700',
  },
  sexual_exploitation: {
    tint: 'from-fuchsia-600/25 via-pink-500/20 to-purple-500/25',
    ring: 'shadow-fuchsia-500/25',
    button: 'from-fuchsia-600 to-pink-700',
  },
  account_theft_fraud: {
    tint: 'from-blue-500/25 via-sky-500/20 to-indigo-500/25',
    ring: 'shadow-blue-500/20',
    button: 'from-blue-500 to-indigo-600',
  },
  gambling_betting: {
    tint: 'from-yellow-500/25 via-amber-500/20 to-orange-500/25',
    ring: 'shadow-yellow-500/20',
    button: 'from-yellow-500 to-amber-600',
  },
  privacy_tracking: {
    tint: 'from-teal-500/25 via-cyan-500/20 to-emerald-500/25',
    ring: 'shadow-teal-500/20',
    button: 'from-teal-500 to-emerald-600',
  },
  harmful_challenges: {
    tint: 'from-orange-500/25 via-rose-500/20 to-red-500/25',
    ring: 'shadow-orange-500/25',
    button: 'from-orange-500 to-red-600',
  },
};

const inferScenarioId = (child?: Child): GuidanceScenario['id'] => {
  const profile = child?.psychProfile;
  if (profile?.priorityScenario) {
    return profile.priorityScenario;
  }

  const hay = (profile?.recentKeywords || []).join(' ');
  if (
    hay.includes('Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³') ||
    hay.includes('Ã˜Â§Ã™â€ Ã˜ÂªÃ˜Â­Ã˜Â§Ã˜Â±') ||
    hay.toLowerCase().includes('self harm') ||
    hay.toLowerCase().includes('suicide')
  ) {
    return 'self_harm';
  }
  if (
    hay.includes('Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬') ||
    hay.includes('Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å ') ||
    hay.toLowerCase().includes('grooming') ||
    hay.toLowerCase().includes('predator')
  ) {
    return 'sexual_exploitation';
  }
  if (
    hay.includes('Ã˜Â³Ã˜Â±Ã™â€šÃ˜Â© Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨') ||
    hay.includes('Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨') ||
    hay.toLowerCase().includes('account stolen') ||
    hay.toLowerCase().includes('credential')
  ) {
    return 'account_theft_fraud';
  }
  if (
    hay.includes('Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€¡Ã™â€ Ã˜Â©') ||
    hay.includes('Ã™â€šÃ™â€¦Ã˜Â§Ã˜Â±') ||
    hay.toLowerCase().includes('gambling') ||
    hay.toLowerCase().includes('bet')
  ) {
    return 'gambling_betting';
  }
  if (
    hay.includes('Ã˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â©') ||
    hay.includes('Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹') ||
    hay.toLowerCase().includes('tracking') ||
    hay.toLowerCase().includes('dox')
  ) {
    return 'privacy_tracking';
  }
  if (
    hay.includes('Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å  Ã˜Â®Ã˜Â·Ã™Å Ã˜Â±') ||
    hay.includes('Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â© Ã˜Â¶Ã˜Â§Ã˜Â±Ã˜Â©') ||
    hay.toLowerCase().includes('dangerous challenge')
  ) {
    return 'harmful_challenges';
  }
  if (hay.includes('Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯') || hay.includes('Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â²')) return 'threat_exposure';
  if (hay.includes('Ã˜ÂªÃ™â€ Ã™â€¦Ã˜Â±')) return 'bullying';
  if (hay.toLowerCase().includes('phishing') || hay.includes('Ã˜ÂªÃ˜ÂµÃ™Å Ã˜Â¯') || hay.includes('Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â·')) return 'phishing_links';
  if (hay.includes('Ã˜Â³Ã™â€¡Ã˜Â±') || hay.includes('Ã˜Â¥Ã˜Â¯Ã™â€¦Ã˜Â§Ã™â€ ') || hay.includes('Ã™â€žÃ˜Â¹Ã˜Â¨')) return 'gaming';
  if (hay.includes('Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â±Ã˜Â§Ã™â€š') || hay.includes('Ã˜Â³Ã™Æ’Ã˜Â±Ã˜Â¨Ã˜Âª')) return 'cyber_crime';
  if (hay.includes('Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â«Ã™â€¦Ã˜Â§Ã˜Â±') || hay.includes('Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž')) return 'crypto_scams';
  if (hay.includes('Ã˜Â¥Ã˜Â¨Ã˜Â§Ã˜Â­Ã™Å Ã˜Â©') || hay.includes('Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€°')) return 'inappropriate_content';
  return 'bullying';
};

const scenarioToCategory = (
  scenarioId: PsychScenarioId,
  threatSubtype: ThreatExposureSubtype = 'direct_threat',
  contentSubtype: InappropriateContentSubtype = 'sexual_content',
  severity: AlertSeverity = AlertSeverity.MEDIUM
): Category => {
  switch (scenarioId) {
    case 'bullying':
      return Category.BULLYING;
    case 'threat_exposure':
      if (threatSubtype === 'financial_blackmail') return Category.SCAM;
      if (threatSubtype === 'sexual_blackmail') return Category.SEXUAL_EXPLOITATION;
      return Category.BLACKMAIL;
    case 'gaming':
      return Category.SAFE;
    case 'inappropriate_content':
      return contentSubtype === 'violent_content' ? Category.VIOLENCE : Category.ADULT_CONTENT;
    case 'cyber_crime':
      if (severity === AlertSeverity.CRITICAL) return Category.TAMPER;
      if (severityRank[severity] >= severityRank[AlertSeverity.HIGH]) return Category.PREDATOR;
      return Category.SAFE;
    case 'crypto_scams':
      return Category.SCAM;
    case 'phishing_links':
      return Category.PHISHING_LINK;
    case 'self_harm':
      return Category.SELF_HARM;
    case 'sexual_exploitation':
      return threatSubtype === 'sexual_blackmail' ? Category.BLACKMAIL : Category.SEXUAL_EXPLOITATION;
    case 'account_theft_fraud':
      return Category.SCAM;
    case 'gambling_betting':
      return Category.SCAM;
    case 'privacy_tracking':
      return Category.PREDATOR;
    case 'harmful_challenges':
      return severityRank[severity] >= severityRank[AlertSeverity.HIGH] ? Category.VIOLENCE : Category.SELF_HARM;
    default:
      return Category.BULLYING;
  }
};

interface ThreatTrackProfile {
  id: ThreatExposureSubtype;
  badgeLabelAr: string;
  badgeLabelEn: string;
  narrativeAr: string;
  narrativeEn: string;
  incidentPlanAr: string[];
  incidentPlanEn: string[];
  alertTemplatesAr: string[];
  alertTemplatesEn: string[];
  preferWalkie: boolean;
  preferBlackout: boolean;
  preferCutInternet: boolean;
  preferSiren: boolean;
}

const threatTrackProfiles: Record<ThreatExposureSubtype, ThreatTrackProfile> = {
  direct_threat: {
    id: 'direct_threat',
    badgeLabelAr: 'Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±',
    badgeLabelEn: 'Direct Threat',
    narrativeAr:
      'Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã˜Â£Ã™â€šÃ˜Â±Ã˜Â¨ Ã˜Â¥Ã™â€žÃ™â€° Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜â€º Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€žÃ˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â°Ã™Å Ã˜Å’ Ã˜ÂªÃ˜Â«Ã˜Â¨Ã™Å Ã˜Âª Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜ÂªÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€¦Ã™â€ Ã˜Â©Ã˜Å’ Ã™Ë†Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹.',
    narrativeEn:
      'The current pattern matches direct threat exposure. Prioritize immediate containment, safe voice channel, and evidence capture.',
    incidentPlanAr: [
      'Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶ Ã™Ë†Ã™â€žÃ˜Â§ Ã˜Â±Ã˜Â¯ Ã˜Â§Ã™â€ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€žÃ™Å  Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã˜Â¯Ã˜Â¯.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Â§Ã˜Â¦Ã™Å  Ã˜Â§Ã™â€žÃ™ÂÃ™Ë†Ã˜Â±Ã™Å  Ã™â€¦Ã˜Â¹ Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ˜Â´Ã˜ÂºÃ™Å Ã™â€ž Ã™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â± (Walkie) Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
      'Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ˜Â§Ã˜Â· Ã˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â«Ã™â€¦ Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â©.',
      'Ã˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å  Ã™â€žÃ™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â§Ã™Ë†Ã˜Â¨ Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯.',
    ],
    incidentPlanEn: [
      'Do not negotiate or react emotionally to the threatening account.',
      'Enable immediate protective lock and blackout screen.',
      'Open a direct walkie channel with the child.',
      'Capture screen evidence, then report on platform.',
      'Escalate to on-duty guardian if threat persists.',
    ],
    alertTemplatesAr: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã™â€ Ã™â€¦Ã˜Â· Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â± Ã™â€¦Ã˜Â±Ã˜ÂµÃ™Ë†Ã˜Â¯. Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Â§Ã˜Â¦Ã™Å .',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã™Ë†Ã™Å Ã™â€ Ã˜ÂªÃ˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™â€¦Ã™Å  Ã™â€žÃ™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â©.',
    ],
    alertTemplatesEn: [
      'Critical alert: direct threat pattern detected. Protective containment enabled.',
      'Follow-up alert: evidence captured, pending official platform report.',
    ],
    preferWalkie: true,
    preferBlackout: true,
    preferCutInternet: false,
    preferSiren: true,
  },
  financial_blackmail: {
    id: 'financial_blackmail',
    badgeLabelAr: 'Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã˜Â§Ã™â€žÃ™Å ',
    badgeLabelEn: 'Financial Blackmail',
    narrativeAr:
      'Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã™Å Ã˜ÂªÃ˜Â¶Ã™â€¦Ã™â€  Ã˜Â¶Ã˜ÂºÃ˜Â·Ã˜Â§Ã™â€¹ Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â§Ã™â€¹Ã˜â€º Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€žÃ™â€šÃ˜Â·Ã˜Â¹ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹Ã˜Å’ Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¨Ã™Æ’Ã˜Â© Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ˜Â§Ã™â€¹Ã˜Å’ Ã™Ë†Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž.',
    narrativeEn:
      'The current pattern indicates financial blackmail. Prioritize payment freeze, temporary network quarantine, and account hardening.',
    incidentPlanAr: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â£Ã™Å  Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â£Ã™Ë† Ã˜Â¯Ã™ÂÃ˜Â¹ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å  Ã˜ÂªÃ˜Â­Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¶Ã˜ÂºÃ˜Â·.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¨Ã™Æ’Ã˜Â© Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ˜Â§Ã™â€¹ Ã˜Â­Ã˜ÂªÃ™â€° Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€¡Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â©.',
      'Ã˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â±.',
      'Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™Ë†Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â¨Ã™Ë†Ã™â€¡Ã˜Â©.',
      'Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™Ë†Ã˜Â®Ã˜Â¯Ã™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹ Ã˜Â¹Ã™â€  Ã™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â².',
    ],
    incidentPlanEn: [
      'Stop all pressured transfers or payments immediately.',
      'Enable temporary network quarantine during investigation.',
      'Harden financial accounts and rotate passwords.',
      'Preserve payment requests and suspicious links as evidence.',
      'Report blackmail attempt to platform and payment provider.',
    ],
    alertTemplatesAr: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã™â€ Ã™â€¦Ã˜Â· Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã™â€¦Ã˜Â±Ã˜ÂµÃ™Ë†Ã˜Â¯. Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ˜Â¬Ã™â€¦Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹ Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ˜Â§Ã™â€¹.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™Ë†Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â±Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Â.',
    ],
    alertTemplatesEn: [
      'Critical alert: financial blackmail pattern detected. Payment channels temporarily frozen.',
      'Follow-up alert: financial account verification and transfer-link evidence in progress.',
    ],
    preferWalkie: false,
    preferBlackout: false,
    preferCutInternet: true,
    preferSiren: false,
  },
  sexual_blackmail: {
    id: 'sexual_blackmail',
    badgeLabelAr: 'Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å ',
    badgeLabelEn: 'Sexual Blackmail',
    narrativeAr:
      'Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã™Å Ã˜Â´Ã™Å Ã˜Â± Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å Ã˜â€º Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â£Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Å’ Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶Ã˜Å’ Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â©Ã˜Å’ Ã™Ë†Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â±Ã˜Â³Ã™â€¦Ã™Å  Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹.',
    narrativeEn:
      'The current pattern indicates sexual blackmail. Prioritize immediate protection, no negotiation, evidence preservation, and fast formal reporting.',
    incidentPlanAr: [
      'Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶ Ã™Ë†Ã™â€žÃ˜Â§ Ã˜Â¥Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€ž Ã˜Â£Ã™Å  Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¥Ã˜Â¶Ã˜Â§Ã™ÂÃ™Å  Ã™â€¦Ã˜Â·Ã™â€žÃ™â€šÃ˜Â§Ã™â€¹.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Â§Ã˜Â¦Ã™Å  Ã™Ë†Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹.',
      'Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ˜Â§Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© (Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â±Ã™ÂÃ˜Â§Ã˜Âª/Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž/Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Âª) Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â£Ã™Å  Ã˜Â­Ã˜Â°Ã™Â.',
      'Ã™ÂÃ˜ÂªÃ˜Â­ Ã™â€šÃ™â€ Ã˜Â§Ã˜Â© Walkie Ã™â€žÃ˜Â¯Ã˜Â¹Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™Ë†Ã˜Â·Ã™â€¦Ã˜Â£Ã™â€ Ã˜ÂªÃ™â€¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â§Ã™â€¹.',
      'Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â±Ã˜Â³Ã™â€¦Ã™Å  Ã™â€žÃ™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜ÂµÃ˜Â©.',
    ],
    incidentPlanEn: [
      'Do not negotiate and never send any additional content.',
      'Enable immediate protective lock and safety blackout screen.',
      'Capture identifiers/messages/timestamps before any deletion.',
      'Open walkie channel for immediate reassurance and support.',
      'Trigger fast formal reporting to platform and authorities.',
    ],
    alertTemplatesAr: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬ Ã˜Â¬Ã˜Â¯Ã˜Â§Ã™â€¹: Ã˜Â§Ã˜Â´Ã˜ÂªÃ˜Â¨Ã˜Â§Ã™â€¡ Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å . Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â©.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã™Ë†Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™â€¦Ã™Å .',
    ],
    alertTemplatesEn: [
      'Extreme alert: suspected sexual blackmail. Immediate protection has been activated.',
      'Follow-up alert: evidence preserved and formal reporting flow started.',
    ],
    preferWalkie: true,
    preferBlackout: true,
    preferCutInternet: false,
    preferSiren: false,
  },
};

const inferThreatSubtypeFromKeywords = (keywords: string[]): ThreatExposureSubtype => {
  const hay = (keywords || []).join(' ').toLowerCase();
  if (
    hay.includes('Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å ') ||
    hay.includes('Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å ') ||
    hay.includes('sextortion') ||
    hay.includes('private photos') ||
    hay.includes('nude')
  ) {
    return 'sexual_blackmail';
  }
  if (
    hay.includes('Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã˜Â§Ã™â€žÃ™Å ') ||
    hay.includes('Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž') ||
    hay.includes('Ã˜Â¯Ã™ÂÃ˜Â¹') ||
    hay.includes('gift card') ||
    hay.includes('wallet')
  ) {
    return 'financial_blackmail';
  }
  return 'direct_threat';
};

interface ContentTrackProfile {
  id: InappropriateContentSubtype;
  badgeLabelAr: string;
  badgeLabelEn: string;
  narrativeAr: string;
  narrativeEn: string;
  incidentPlanAr: string[];
  incidentPlanEn: string[];
  alertTemplatesAr: string[];
  alertTemplatesEn: string[];
  preferBlackout: boolean;
  preferSiren: boolean;
}

const contentTrackProfiles: Record<InappropriateContentSubtype, ContentTrackProfile> = {
  sexual_content: {
    id: 'sexual_content',
    badgeLabelAr: 'Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å ',
    badgeLabelEn: 'Sexual Content',
    narrativeAr:
      'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã™Å Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å  Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™â€ Ã˜Â§Ã˜Â³Ã˜Â¨Ã˜â€º Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â´Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â©Ã˜Å’ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¡Ã˜Â¯Ã˜Â¦Ã˜Â©Ã˜Å’ Ã™Ë†Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¦Ã™Å  Ã˜Â¨Ã™â€žÃ˜Â§ Ã™â€žÃ™Ë†Ã™â€¦.',
    narrativeEn:
      'Current pattern indicates exposure to sexual explicit content. Prioritize tighter filtering, calm handling, and non-blaming guidance.',
    incidentPlanAr: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â¨Ã˜Â¨ Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹ (Ã˜Â±Ã˜Â§Ã˜Â¨Ã˜Â·/Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨/Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š).',
      'Ã˜Â±Ã™ÂÃ˜Â¹ Ã™â€¦Ã˜Â³Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â© Ã™Ë†SafeSearch Ã˜Â¨Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã˜Â±.',
      'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â­Ã™Ë†Ã˜Â§Ã˜Â± Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã˜Â¨Ã™â€žÃ˜Â§ Ã™â€žÃ™Ë†Ã™â€¦ Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€¦Ã˜Â© Ã™â€¦Ã™Ë†Ã˜Â§Ã™â€šÃ˜Â¹ Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€žÃ˜Â© Ã˜Â¢Ã™â€¦Ã™â€ Ã˜Â©.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã™â€žÃ™â€šÃ™Å Ã˜Â§Ã˜Â³ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â±.',
    ],
    incidentPlanEn: [
      'Block the source immediately (link/account/app).',
      'Increase filtering and SafeSearch strictness.',
      'Run a short non-blaming discussion with the child.',
      'Provide trusted safe alternatives.',
      'Track recurrence weekly.',
    ],
    alertTemplatesAr: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹: Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã™â€¦Ã˜Â­Ã˜ÂªÃ™â€¦Ã™â€ž Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å  Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™â€ Ã˜Â§Ã˜Â³Ã˜Â¨. Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ˜Â´Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â©.',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜ÂªÃ˜Â±Ã˜Â¨Ã™Ë†Ã™Å  Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ™Ë†Ã˜ÂµÃ™Ë†Ã™â€ž.',
    ],
    alertTemplatesEn: [
      'High alert: potential sexual explicit-content exposure. Filtering has been tightened.',
      'Follow-up alert: educational containment plan and source review completed.',
    ],
    preferBlackout: false,
    preferSiren: false,
  },
  violent_content: {
    id: 'violent_content',
    badgeLabelAr: 'Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¹Ã™â€ Ã™Å Ã™Â',
    badgeLabelEn: 'Violent Content',
    narrativeAr:
      'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã™Å Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¹Ã™â€ Ã™Å Ã™Â/Ã˜ÂªÃ˜Â­Ã˜Â±Ã™Å Ã˜Â¶Ã™Å Ã˜â€º Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Å’ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¡Ã˜Â¯Ã˜Â¦Ã˜Â©Ã˜Å’ Ã™Ë†Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã™â€¦Ã˜Â­Ã™ÂÃ˜Â²Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã™Â.',
    narrativeEn:
      'Current pattern indicates repeated exposure to violent/harmful content. Prioritize immediate containment and de-escalation.',
    incidentPlanAr: [
      'Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã™Å Ã™Â Ã™Ë†Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨/Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â©.',
      'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜ÂªÃ™â€¡Ã˜Â¯Ã˜Â¦Ã˜Â©.',
      'Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â§Ã™â€¡Ã˜Â¯Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€ Ã™â€šÃ˜Â§Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬.',
      'Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â¹Ã™Å Ã˜Â© Ã˜Â­Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã™â€š Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã™ÂÃ™Å Ã™â€¡Ã™Å  Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã˜Â±Ã™Å Ã˜Â¶.',
      'Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â© Ã˜Â­Ã˜ÂªÃ™â€° Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ™â€ Ã™â€¦Ã˜Â·.',
    ],
    incidentPlanEn: [
      'Block the violent source and related account/channel.',
      'Enable temporary safety blackout with calming message.',
      'Review watch history and lure vectors.',
      'Run a brief guidance talk about harmful content.',
      'Track daily until pattern stabilizes.',
    ],
    alertTemplatesAr: [
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â­Ã˜Â±Ã˜Â¬: Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¹Ã™â€ Ã™Å Ã™Â/Ã˜ÂªÃ˜Â­Ã˜Â±Ã™Å Ã˜Â¶Ã™Å . Ã˜ÂªÃ™â€¦ Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Â§Ã˜Â¦Ã™Å .',
      'Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©: Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Â Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã™â€¦Ã˜Â­Ã™ÂÃ˜Â²Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã™Â Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â©.',
    ],
    alertTemplatesEn: [
      'Critical alert: repeated violent-content exposure detected. Protective containment started.',
      'Follow-up alert: violence triggers are being reduced and channels reviewed.',
    ],
    preferBlackout: true,
    preferSiren: true,
  },
};

const inferContentSubtypeFromKeywords = (keywords: string[]): InappropriateContentSubtype => {
  const hay = (keywords || []).join(' ').toLowerCase();
  if (
    hay.includes('violent') ||
    hay.includes('gore') ||
    hay.includes('Ã˜Â¹Ã™â€ Ã™Å Ã™Â') ||
    hay.includes('Ã˜ÂªÃ˜Â­Ã˜Â±Ã™Å Ã˜Â¶') ||
    hay.includes('Ã˜Â¯Ã™â€¦Ã™Ë†Ã™Å ')
  ) {
    return 'violent_content';
  }
  return 'sexual_content';
};

const PsychologicalInsightView: React.FC<PsychologicalInsightViewProps> = ({
  theme: _theme,
  child: childProp,
  childrenList = [],
  alerts = [],
  signalEvents = [],
  lang = 'ar',
  autoLockInAutomationEnabled = true,
  allLocksDisabled = false,
  onAcceptPlan,
  onApplyModeToChild,
  onPlanExecutionResult,
  onSaveExecutionEvidence,
  onPersistForecastSnapshot,
}) => {
  const fallbackProfile = useMemo<PsychologicalProfile>(
    () => ({
      anxietyLevel: 35,
      moodScore: 55,
      dominantEmotion: lang === 'ar' ? 'Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â±' : 'Stable',
      isolationRisk: 20,
      recentKeywords: [],
      recommendation:
        lang === 'ar'
          ? 'Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Å  Ã˜ÂªÃ˜Â­Ã™â€¦Ã™Å Ã™â€ž Ã™â€¦Ã™â€žÃ™Â Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¨Ã˜Â¶ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å . Ã™Å Ã˜Â±Ã˜Â¬Ã™â€° Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ˜Â¸Ã˜Â§Ã˜Â±...'
          : 'Psych pulse profile is loading. Please wait...',
      riskSignals: [],
      weeklyTrend: [],
    }),
    [lang]
  );
  const fallbackChild = useMemo<Child>(
    () => ({
      id: 'pending-child',
      parentId: '',
      name: lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž' : 'Child',
      role: 'CHILD',
      avatar: 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â',
      age: 0,
      status: 'offline',
      batteryLevel: 0,
      signalStrength: 0,
      screenTimeLimit: 0,
      currentScreenTime: 0,
      deviceLocked: false,
      cameraBlocked: false,
      micBlocked: false,
      preventAppInstall: false,
      preventDeviceLock: false,
      appUsage: [],
      psychProfile: fallbackProfile,
    }),
    [lang, fallbackProfile]
  );
  const availableChildren = useMemo<Child[]>(() => {
    const source = childrenList.length > 0 ? childrenList : childProp ? [childProp] : [];
    const unique = new Map<string, Child>();
    for (const item of source) {
      if (!item?.id) continue;
      if (!unique.has(item.id)) unique.set(item.id, item);
    }
    return Array.from(unique.values());
  }, [childrenList, childProp]);
  const logicalChildren = useMemo<LogicalChildAggregate[]>(
    () => buildLogicalChildAggregates(availableChildren),
    [availableChildren]
  );
  const [selectedChildId, setSelectedChildId] = useState<string>(
    logicalChildren[0]?.groupId || fallbackChild.id
  );
  useEffect(() => {
    if (logicalChildren.length === 0) return;
    if (!logicalChildren.some((item) => item.groupId === selectedChildId)) {
      setSelectedChildId(logicalChildren[0].groupId);
    }
  }, [logicalChildren, selectedChildId]);

  const selectedLogicalChild = useMemo<LogicalChildAggregate | null>(() => {
    return logicalChildren.find((item) => item.groupId === selectedChildId) || logicalChildren[0] || null;
  }, [logicalChildren, selectedChildId]);
  const child = useMemo<Child>(() => {
    return selectedLogicalChild?.mergedChild || fallbackChild;
  }, [selectedLogicalChild, fallbackChild]);
  const targetChildIds = useMemo<string[]>(
    () => (selectedLogicalChild?.members || []).map((member) => member.id).filter(Boolean),
    [selectedLogicalChild]
  );
  const resolvedTargetChildIds = useMemo<string[]>(
    () => Array.from(new Set(targetChildIds.length > 0 ? targetChildIds : child.id ? [child.id] : [])),
    [targetChildIds, child.id]
  );
  const profile = child.psychProfile ?? fallbackProfile;
  const hasChildContext = logicalChildren.length > 0;
  const navigate = useNavigate();
  const primaryCardRef = useRef<HTMLDivElement | null>(null);
  const radarContainerRef = useRef<HTMLDivElement | null>(null);
  const trendContainerRef = useRef<HTMLDivElement | null>(null);
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const lastForecastSnapshotSignatureRef = useRef<string>('');
  const [radarSize, setRadarSize] = useState({ width: 0, height: 0 });
  const [trendSize, setTrendSize] = useState({ width: 0, height: 0 });
  const alertsInScope = useMemo(() => {
    const norm = (value?: string) => (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const selectedNames = new Set(
      (selectedLogicalChild?.members || []).map((member) => norm(member.name)).filter(Boolean)
    );
    if (selectedNames.size === 0 && child.name) {
      selectedNames.add(norm(child.name));
    }
    const selectedIds = new Set((selectedLogicalChild?.members || []).map((member) => member.id));
    return alerts.filter((alert) => {
      if (alert.childId && selectedIds.has(alert.childId)) return true;
      const alertNameNorm = norm(alert.childName);
      if (!alertNameNorm) return false;
      for (const name of selectedNames) {
        if (!name) continue;
        if (alertNameNorm === name || alertNameNorm.includes(name) || name.includes(alertNameNorm)) {
          return true;
        }
      }
      return false;
    });
  }, [alerts, selectedLogicalChild, child.name]);
  const signalEventsInScope = useMemo(() => {
    const norm = (value?: string) => (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const selectedNames = new Set(
      (selectedLogicalChild?.members || []).map((member) => norm(member.name)).filter(Boolean)
    );
    if (selectedNames.size === 0 && child.name) {
      selectedNames.add(norm(child.name));
    }
    const selectedIds = new Set((selectedLogicalChild?.members || []).map((member) => member.id));
    return signalEvents.filter((event) => {
      if (event.childId && selectedIds.has(event.childId)) return true;
      const eventNameNorm = norm(event.childName);
      if (!eventNameNorm) return false;
      for (const name of selectedNames) {
        if (!name) continue;
        if (eventNameNorm === name || eventNameNorm.includes(name) || name.includes(eventNameNorm)) {
          return true;
        }
      }
      return false;
    });
  }, [signalEvents, selectedLogicalChild, child.name]);
  const diagnosis = useMemo(() => {
    if (!child.name || alertsInScope.length === 0) return null;
    const patchedAlerts = alertsInScope.map((alert) => ({
      ...alert,
      childName: child.name,
    }));
    return diagnosePsychScenarioFromAlerts(child.name, patchedAlerts);
  }, [child.name, alertsInScope]);
  const psychForecast = useMemo(
    () =>
      buildPsychRiskForecast({
        childName: child.name,
        child,
        alerts: alertsInScope,
        signalEvents: signalEventsInScope,
        profile,
        diagnosis,
      }),
    [child.name, child, alertsInScope, signalEventsInScope, profile, diagnosis]
  );
  const sevenDayTopForecast = psychForecast.sevenDay.topPredictions[0];
  const thirtyDayTopForecast = psychForecast.thirtyDay.topPredictions[0];
  const sourceCoverageTotal = Object.keys(psychForecast.signalFusion.sourceCoverage.counts || {}).length || 1;
  const forecastSnapshotPayload = useMemo<PsychForecastSnapshotPayload | null>(() => {
    if (!hasChildContext) return null;
    if (!sevenDayTopForecast && !thirtyDayTopForecast) return null;
    if (resolvedTargetChildIds.length === 0) return null;
    return {
      childId: resolvedTargetChildIds[0] || child.id,
      childIds: resolvedTargetChildIds,
      childName: child.name,
      generatedAt: new Date().toISOString(),
      sevenDayTop: sevenDayTopForecast
        ? {
            scenarioId: sevenDayTopForecast.scenarioId,
            riskScore: sevenDayTopForecast.riskScore,
            probability: sevenDayTopForecast.probability,
            confidence: sevenDayTopForecast.confidence,
            trend: sevenDayTopForecast.trend,
            explanationAr: sevenDayTopForecast.explanationAr,
            explanationEn: sevenDayTopForecast.explanationEn,
          }
        : undefined,
      thirtyDayTop: thirtyDayTopForecast
        ? {
            scenarioId: thirtyDayTopForecast.scenarioId,
            riskScore: thirtyDayTopForecast.riskScore,
            probability: thirtyDayTopForecast.probability,
            confidence: thirtyDayTopForecast.confidence,
            trend: thirtyDayTopForecast.trend,
            explanationAr: thirtyDayTopForecast.explanationAr,
            explanationEn: thirtyDayTopForecast.explanationEn,
          }
        : undefined,
      contextSummary: {
        analyzedMessages: psychForecast.context.analyzedMessages,
        analyzedAlerts: psychForecast.context.analyzedAlerts,
        recencyWeight: Number(psychForecast.context.temporal.recencyWeight.toFixed(4)),
        escalationIndex: Number(psychForecast.context.temporal.escalationIndex.toFixed(4)),
        pressureIndex: Number(psychForecast.context.temporal.pressureIndex.toFixed(4)),
        repeatedTerms: psychForecast.context.repeatedTerms.slice(0, 10).map((item) => item.term),
        topPatternIds: psychForecast.context.patternSignals.slice(0, 8).map((signal) => signal.id),
      },
      sourceCoverage: {
        sourceCount: psychForecast.signalFusion.sourceCoverage.sourceCount,
        depthScore: psychForecast.signalFusion.sourceCoverage.depthScore,
        counts: psychForecast.signalFusion.sourceCoverage.counts,
        topDriversEn: psychForecast.signalFusion.topDriversEn.slice(0, 8),
      },
    };
  }, [
    hasChildContext,
    sevenDayTopForecast,
    thirtyDayTopForecast,
    resolvedTargetChildIds,
    child.id,
    child.name,
    psychForecast.context,
    psychForecast.signalFusion,
  ]);

  useEffect(() => {
    if (!onPersistForecastSnapshot || !forecastSnapshotPayload) return;

    const maxRisk = Math.max(
      forecastSnapshotPayload.sevenDayTop?.riskScore || 0,
      forecastSnapshotPayload.thirtyDayTop?.riskScore || 0
    );
    if (maxRisk < 35) return;

    const signature = [
      forecastSnapshotPayload.childId,
      (forecastSnapshotPayload.childIds || []).join(','),
      forecastSnapshotPayload.sevenDayTop?.scenarioId || '',
      forecastSnapshotPayload.sevenDayTop?.riskScore || 0,
      forecastSnapshotPayload.thirtyDayTop?.scenarioId || '',
      forecastSnapshotPayload.thirtyDayTop?.riskScore || 0,
      forecastSnapshotPayload.contextSummary.topPatternIds.join('|'),
      forecastSnapshotPayload.contextSummary.repeatedTerms.join('|'),
      String(forecastSnapshotPayload.sourceCoverage?.sourceCount || 0),
      String(forecastSnapshotPayload.sourceCoverage?.depthScore || 0),
    ].join('::');
    if (lastForecastSnapshotSignatureRef.current === signature) return;
    lastForecastSnapshotSignatureRef.current = signature;

    Promise.resolve(onPersistForecastSnapshot(forecastSnapshotPayload)).catch((error) => {
      console.warn('Failed to persist psych forecast snapshot:', error);
    });
  }, [forecastSnapshotPayload, onPersistForecastSnapshot]);

  const [activeScenarioId, setActiveScenarioId] = useState<GuidanceScenario['id']>(
    diagnosis?.scenarioId || inferScenarioId(child)
  );
  const [expandedScenarioId, setExpandedScenarioId] = useState<GuidanceScenario['id'] | null>(
    diagnosis?.scenarioId || inferScenarioId(child)
  );
  const [expandedSectionMap, setExpandedSectionMap] = useState<Record<string, boolean>>({});
  const [copiedPlan, setCopiedPlan] = useState(false);
  const [autoSelection, setAutoSelection] = useState<Record<string, boolean>>({});
  const [autoStatus, setAutoStatus] = useState<Record<string, AutoStepStatus>>({});
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoRunSummary, setAutoRunSummary] = useState('');
  const [executionTimeline, setExecutionTimeline] = useState<PlanTimelineEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<'all' | PlanTimelineStatus>('all');
  const [isSavingExecutionEvidence, setIsSavingExecutionEvidence] = useState(false);
  const [planVideoSource, setPlanVideoSource] = useState<PlanVideoSource>('screen');
  const [planAudioSource, setPlanAudioSource] = useState<PlanAudioSource>('mic');
  const [playbooks, setPlaybooks] = useState<SafetyPlaybook[]>([]);
  const [blackoutMessage, setBlackoutMessage] = useState(
    lang === 'ar'
      ? 'Ã˜ÂªÃ™â€¦ Ã™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã™â€žÃ˜Â¯Ã™Ë†Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€ . Ã™Å Ã˜Â±Ã˜Â¬Ã™â€° Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€žÃ˜Â¯Ã™Å Ã™â€ .'
      : 'Device locked for safety. Please contact a parent.'
  );

  const activeScenario = useMemo(
    () => guidanceScenarios.find((s) => s.id === activeScenarioId) || guidanceScenarios[0],
    [activeScenarioId]
  );
  const recentKeywords = useMemo(
    () => child?.psychProfile?.recentKeywords || [],
    [child?.psychProfile?.recentKeywords]
  );
  const recentKeywordsSignature = useMemo(() => recentKeywords.join('||'), [recentKeywords]);

  const threatSubtype = useMemo<ThreatExposureSubtype>(() => {
    if (activeScenario.id !== 'threat_exposure') return 'direct_threat';
    return diagnosis?.threatSubtype || inferThreatSubtypeFromKeywords(recentKeywords);
  }, [activeScenario.id, recentKeywords, diagnosis?.threatSubtype]);

  const contentSubtype = useMemo<InappropriateContentSubtype>(() => {
    if (activeScenario.id !== 'inappropriate_content') return 'sexual_content';
    return diagnosis?.contentSubtype || inferContentSubtypeFromKeywords(recentKeywords);
  }, [activeScenario.id, recentKeywords, diagnosis?.contentSubtype]);

  const activeThreatTrack = useMemo(
    () => threatTrackProfiles[threatSubtype],
    [threatSubtype]
  );

  const activeContentTrack = useMemo(
    () => contentTrackProfiles[contentSubtype],
    [contentSubtype]
  );

  const resolvedIncidentPlan = useMemo(() => {
    if (activeScenario.id === 'threat_exposure') {
      return lang === 'ar' ? activeThreatTrack.incidentPlanAr : activeThreatTrack.incidentPlanEn;
    }
    if (activeScenario.id === 'inappropriate_content') {
      return lang === 'ar' ? activeContentTrack.incidentPlanAr : activeContentTrack.incidentPlanEn;
    }
    return activeScenario.incidentPlan;
  }, [activeScenario.id, activeScenario.incidentPlan, activeThreatTrack, activeContentTrack, lang]);

  const resolvedAlertTemplates = useMemo(() => {
    if (activeScenario.id === 'threat_exposure') {
      return lang === 'ar' ? activeThreatTrack.alertTemplatesAr : activeThreatTrack.alertTemplatesEn;
    }
    if (activeScenario.id === 'inappropriate_content') {
      return lang === 'ar' ? activeContentTrack.alertTemplatesAr : activeContentTrack.alertTemplatesEn;
    }
    return activeScenario.alertTemplates;
  }, [activeScenario.id, activeScenario.alertTemplates, activeThreatTrack, activeContentTrack, lang]);

  const fallbackBlackoutMessage = useMemo(
    () =>
      lang === 'ar'
        ? 'Ã˜ÂªÃ™â€¦ Ã™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã™â€žÃ˜Â¯Ã™Ë†Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€ . Ã™Å Ã˜Â±Ã˜Â¬Ã™â€° Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€žÃ˜Â¯Ã™Å Ã™â€ .'
        : 'Device locked for safety. Please contact a parent.',
    [lang]
  );

  useEffect(() => {
    setActiveScenarioId(diagnosis?.scenarioId || inferScenarioId(child));
    setExpandedScenarioId(diagnosis?.scenarioId || inferScenarioId(child));
  }, [
    child?.id,
    child?.psychProfile?.priorityScenario,
    recentKeywordsSignature,
    diagnosis?.scenarioId,
  ]);

  useEffect(() => {
    let mounted = true;
    const loadPlaybooks = async () => {
      if (!child?.parentId) {
        if (mounted) setPlaybooks([]);
        return;
      }
      try {
        const stored = await fetchPlaybooks(child.parentId);
        if (!mounted) return;
        setPlaybooks(stored);
      } catch (error) {
        if (!mounted) return;
        console.warn('Failed to load psychological playbooks:', error);
        setPlaybooks([]);
      }
    };
    void loadPlaybooks();
    return () => {
      mounted = false;
    };
  }, [child?.parentId]);

  useEffect(() => {
    if (!blackoutMessage.trim()) {
      setBlackoutMessage(fallbackBlackoutMessage);
    }
  }, [blackoutMessage, fallbackBlackoutMessage]);

  useEffect(() => {
    const el = primaryCardRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      el.focus({ preventScroll: true });
    });
  }, [child?.id]);

  useEffect(() => {
    const node = radarContainerRef.current;
    if (!node) return;

    let raf = 0;
    const checkReady = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        setRadarSize({
          width: Math.max(0, Math.floor(rect.width)),
          height: Math.max(0, Math.floor(rect.height)),
        });
      });
    };

    checkReady();
    const observer = new ResizeObserver(checkReady);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [child?.id]);

  useEffect(() => {
    const node = trendContainerRef.current;
    if (!node) return;

    let raf = 0;
    const checkReady = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        setTrendSize({
          width: Math.max(0, Math.floor(rect.width)),
          height: Math.max(0, Math.floor(rect.height)),
        });
      });
    };

    checkReady();
    const observer = new ResizeObserver(checkReady);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [child?.id]);

  const childAlerts = useMemo(() => {
    return [...alertsInScope]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alertsInScope]);

  const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const severityToPressure: Record<AlertSeverity, number> = {
    [AlertSeverity.LOW]: 20,
    [AlertSeverity.MEDIUM]: 45,
    [AlertSeverity.HIGH]: 75,
    [AlertSeverity.CRITICAL]: 95,
  };

  const recentAlerts = childAlerts.slice(0, 8);
  const recentAlertPressure =
    recentAlerts.length > 0
      ? recentAlerts.reduce((sum, alert) => sum + severityToPressure[alert.severity], 0) / recentAlerts.length
      : 0;
  const diagnosticPressure =
    diagnosis?.topSignals?.length
      ? diagnosis.topSignals.reduce((sum, signal) => sum + severityToPressure[signal.severity], 0) /
        diagnosis.topSignals.length
      : 0;

  const anxietyScore = clampScore(
    profile.anxietyLevel * 0.65 + recentAlertPressure * 0.25 + diagnosticPressure * 0.1
  );
  const calmScore = clampScore(profile.moodScore * 0.7 + (100 - anxietyScore) * 0.3);
  const frustrationScore = clampScore((100 - profile.moodScore) * 0.65 + anxietyScore * 0.35);
  const isolationScore = clampScore(profile.isolationRisk * 0.8 + recentAlertPressure * 0.2);
  const aggressionScore = clampScore(
    anxietyScore * 0.38 + isolationScore * 0.34 + frustrationScore * 0.28
  );
  const riskComposite = clampScore(
    anxietyScore * 0.35 + frustrationScore * 0.2 + isolationScore * 0.2 + aggressionScore * 0.25
  );
  const stabilityScore = clampScore(calmScore * 0.6 + (100 - riskComposite) * 0.4);
  const readinessScore = profile.incidentReadinessScore ?? clampScore(100 - riskComposite * 0.7);
  const quickAdvisorTip =
    (diagnosis?.scenarioId === activeScenario.id ? diagnosis?.topSignals?.[0]?.suggestedAction : undefined) ||
    activeScenario.dialogues[0]?.advice ||
    resolvedIncidentPlan[0] ||
    profile.recommendation;

  const radarData = [
    { subject: 'Ã™â€šÃ™â€žÃ™â€š', A: anxietyScore, fullMark: 100 },
    { subject: 'Ã˜Â¥Ã˜Â­Ã˜Â¨Ã˜Â§Ã˜Â·', A: frustrationScore, fullMark: 100 },
    { subject: 'Ã˜Â¹Ã˜Â²Ã™â€žÃ˜Â©', A: isolationScore, fullMark: 100 },
    { subject: 'Ã˜Â¹Ã˜Â¯Ã™Ë†Ã˜Â§Ã™â€ Ã™Å Ã˜Â©', A: aggressionScore, fullMark: 100 },
    { subject: 'Ã™â€¡Ã˜Â¯Ã™Ë†Ã˜Â¡', A: calmScore, fullMark: 100 },
  ];

  const trendSeed = clampScore(riskComposite + recentAlertPressure * 0.08 - calmScore * 0.05);
  const weeklyTrend =
    profile.weeklyTrend && profile.weeklyTrend.length > 0
      ? profile.weeklyTrend
      : [
          { label: 'Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â«Ã™â€ Ã™Å Ã™â€ ', value: clampScore(trendSeed - 6) },
          { label: 'Ã˜Â§Ã™â€žÃ˜Â«Ã™â€žÃ˜Â§Ã˜Â«Ã˜Â§Ã˜Â¡', value: clampScore(trendSeed - 2) },
          { label: 'Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â±Ã˜Â¨Ã˜Â¹Ã˜Â§Ã˜Â¡', value: clampScore(trendSeed + 1) },
          { label: 'Ã˜Â§Ã™â€žÃ˜Â®Ã™â€¦Ã™Å Ã˜Â³', value: clampScore(trendSeed + 4) },
          { label: 'Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¦Ã˜Â¹Ã˜Â©', value: clampScore(trendSeed + 7) },
        ];

  const riskSignals = useMemo(() => {
    const diagnosticSignals = diagnosis?.topSignals || [];
    const profileSignals = profile.riskSignals || [];
    const merged = [...diagnosticSignals, ...profileSignals];
    const actionCandidates = Array.from(
      new Set(
        [
          ...diagnosticSignals.map((signal) => signal.suggestedAction),
          ...profileSignals.map((signal) => signal.suggestedAction),
          ...resolvedIncidentPlan,
          ...activeScenario.incidentPlan,
          activeScenario.dialogues[0]?.advice,
          profile.recommendation,
        ].filter((value): value is string => !!value && value.trim().length > 0)
      )
    );

    if (merged.length > 0) {
      const unique = new Map<string, (typeof merged)[number]>();
      for (const signal of merged) {
        const key = `${signal.title}-${signal.severity}-${signal.reason}`;
        if (!unique.has(key)) {
          unique.set(key, signal);
        }
      }
      const usedActions = new Set<string>();
      return Array.from(unique.values())
        .slice(0, 4)
        .map((signal, idx) => {
          let suggestedAction = signal.suggestedAction?.trim();
          if (!suggestedAction || usedActions.has(suggestedAction)) {
            suggestedAction =
              actionCandidates.find((candidate) => !usedActions.has(candidate)) ||
              actionCandidates[idx % Math.max(actionCandidates.length, 1)] ||
              profile.recommendation;
          }
          usedActions.add(suggestedAction);
          return { ...signal, suggestedAction };
        });
    }
    return [
      {
        id: `fallback-${activeScenario.id}`,
        title: activeScenario.title,
        severity: activeScenario.severity,
        reason: activeScenario.symptoms[0],
        suggestedAction: resolvedIncidentPlan[0] || activeScenario.incidentPlan[0],
      },
    ];
  }, [diagnosis?.topSignals, profile.riskSignals, activeScenario, profile.recommendation, resolvedIncidentPlan]);

  const dominantPlatform = useMemo(() => {
    const count = new Map<string, number>();
    for (const alert of childAlerts) {
      const key = (alert.platform || 'Unknown').trim();
      count.set(key, (count.get(key) || 0) + 1);
    }
    const sorted = Array.from(count.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || childAlerts[0]?.platform || 'Discord';
  }, [childAlerts]);

  const dominantSeverity: AlertSeverity =
    diagnosis?.topSignals?.[0]?.severity || childAlerts[0]?.severity || activeScenario.severity;

  const automationGate = useMemo(
    () =>
      buildPsychAutomationGate({
        activeScenarioId: activeScenario.id,
        dominantSeverity,
        trajectories: psychForecast.signalFusion.trajectories,
      }),
    [activeScenario.id, dominantSeverity, psychForecast.signalFusion.trajectories]
  );

  const cyberRiskStage = useMemo(() => {
    if (activeScenario.id !== 'cyber_crime') return null;
    if (dominantSeverity === AlertSeverity.CRITICAL) {
      return { badgeAr: 'Ã™â€¦Ã˜Â±Ã˜Â­Ã™â€žÃ˜Â© Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡', badgeEn: 'Containment Stage' };
    }
    if (severityRank[dominantSeverity] >= severityRank[AlertSeverity.HIGH]) {
      return { badgeAr: 'Ã™â€¦Ã˜Â±Ã˜Â­Ã™â€žÃ˜Â© Ã˜Â¥Ã™â€ Ã˜Â°Ã˜Â§Ã˜Â±', badgeEn: 'Warning Stage' };
    }
    return { badgeAr: 'Ã™â€¦Ã˜Â±Ã˜Â­Ã™â€žÃ˜Â© Ã˜Â±Ã˜ÂµÃ˜Â¯', badgeEn: 'Observation Stage' };
  }, [activeScenario.id, dominantSeverity]);

  const highRiskApp = useMemo(() => {
    const apps = child.appUsage || [];
    if (apps.length === 0) return null;
    const platformNorm = dominantPlatform.toLowerCase();
    const direct = apps.find((app) => app.appName.toLowerCase().includes(platformNorm));
    if (direct) return direct;
    const fallback = apps.find((app) =>
      ['discord', 'telegram', 'roblox', 'tiktok', 'snapchat', 'youtube'].some((name) =>
        app.appName.toLowerCase().includes(name)
      )
    );
    return fallback || apps[0];
  }, [child.appUsage, dominantPlatform]);

  const blockedDomains = useMemo(
    () => scenarioBlockedDomains[activeScenario.id] || [],
    [activeScenario.id]
  );

  const playbookDrivenSteps = useMemo<AutoExecutionStep[]>(() => {
    const category = scenarioToCategory(activeScenario.id, threatSubtype, contentSubtype, dominantSeverity);
    const actions = getDefenseActionsWithPlaybooks(category, dominantSeverity, playbooks, {
      allowAutoLock: autoLockInAutomationEnabled && !allLocksDisabled,
      confidence: automationGate.ruleEngineConfidence,
    });

    const priorityToSeverity = (priority: string): AlertSeverity => {
      if (priority === 'critical') return AlertSeverity.CRITICAL;
      if (priority === 'high') return AlertSeverity.HIGH;
      if (priority === 'medium') return AlertSeverity.MEDIUM;
      return AlertSeverity.LOW;
    };

    return actions
      .map((action) => ({
        id: `pb-${action.id}`,
        title: lang === 'ar' ? `Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â¨Ã˜Â±Ã™Ë†Ã˜ÂªÃ™Ë†Ã™Æ’Ã™Ë†Ã™â€ž: ${action.label}` : `Playbook Action: ${action.label}`,
        description:
          lang === 'ar'
            ? 'Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â© Ã™â€¦Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™â€¦Ã™â€  Ã˜Â¨Ã˜Â±Ã™Ë†Ã˜ÂªÃ™Ë†Ã™Æ’Ã™Ë†Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂµÃ˜ÂµÃ˜Â© Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â§Ã˜Â¦Ã™â€žÃ˜Â©.'
            : 'A family-configured action restored from safety playbooks.',
        command: action.command as AutoExecutionStep['command'],
        value: action.payload ?? true,
        minSeverity: priorityToSeverity(action.priority),
        enabledByDefault: true,
      }));
  }, [
    activeScenario.id,
    allLocksDisabled,
    automationGate.ruleEngineConfidence,
    autoLockInAutomationEnabled,
    contentSubtype,
    dominantSeverity,
    lang,
    playbooks,
    threatSubtype,
  ]);

  useEffect(() => {
    if (activeScenario.id === 'gaming') {
      setPlanVideoSource('screen');
      setPlanAudioSource('system');
      return;
    }
    if (activeScenario.id === 'bullying') {
      setPlanVideoSource('camera_front');
      setPlanAudioSource('mic');
      return;
    }
    if (activeScenario.id === 'threat_exposure') {
      if (threatSubtype === 'financial_blackmail') {
        setPlanVideoSource('screen');
        setPlanAudioSource('system');
        return;
      }
      setPlanVideoSource('camera_front');
      setPlanAudioSource('mic');
      return;
    }
    if (activeScenario.id === 'inappropriate_content') {
      if (contentSubtype === 'violent_content') {
        setPlanVideoSource('camera_front');
        setPlanAudioSource('mic');
        return;
      }
      setPlanVideoSource('screen');
      setPlanAudioSource('system');
      return;
    }
    if (activeScenario.id === 'phishing_links') {
      setPlanVideoSource('screen');
      setPlanAudioSource('system');
      return;
    }
    if (
      activeScenario.id === 'account_theft_fraud' ||
      activeScenario.id === 'crypto_scams' ||
      activeScenario.id === 'gambling_betting' ||
      activeScenario.id === 'privacy_tracking'
    ) {
      setPlanVideoSource('screen');
      setPlanAudioSource('system');
      return;
    }
    if (
      activeScenario.id === 'self_harm' ||
      activeScenario.id === 'sexual_exploitation' ||
      activeScenario.id === 'harmful_challenges'
    ) {
      setPlanVideoSource('camera_front');
      setPlanAudioSource('mic');
      return;
    }
    setPlanVideoSource('screen');
    setPlanAudioSource('mic');
  }, [activeScenario.id, child?.id, contentSubtype, threatSubtype]);

  const digitalBalanceNarrative = useMemo(() => {
    const appLabel = highRiskApp?.appName || dominantPlatform;
    if (activeScenario.id === 'threat_exposure') {
      const base = lang === 'ar' ? activeThreatTrack.narrativeAr : activeThreatTrack.narrativeEn;
      return `${base} (${appLabel}).`;
    }
    if (activeScenario.id === 'inappropriate_content') {
      const base = lang === 'ar' ? activeContentTrack.narrativeAr : activeContentTrack.narrativeEn;
      return `${base} (${appLabel}).`;
    }
    if (activeScenario.id === 'bullying') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜ÂªÃ˜Â´Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž ${appLabel}Ã˜Å’ Ã˜ÂªÃ™â€šÃ™Å Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â³Ã™â€žÃ˜Â© Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â±Ã˜Â¨Ã˜Â§Ã˜Â¡Ã˜Å’ Ã™Ë†Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â¨Ã˜Â±Ã™Ë†Ã˜ÂªÃ™Ë†Ã™Æ’Ã™Ë†Ã™â€ž "Ã™Ë†Ã˜Â«Ã™â€˜Ã™â€š/Ã˜Â§Ã˜Â­Ã˜Â¸Ã˜Â±/Ã˜Â¨Ã™â€žÃ™â€˜Ã˜Âº" Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å Ã˜Â§Ã™â€¹.`;
    }
    if (activeScenario.id === 'gaming') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜Â¶Ã˜Â¨Ã˜Â· ${appLabel} Ã˜Â¹Ã˜Â¨Ã˜Â± Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€ : Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã™â€žÃ˜Â¹Ã˜Â¨ Ã™â€¦Ã˜Â¬Ã˜Â¯Ã™Ë†Ã™â€žÃ˜Â© + Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜ÂªÃ˜Â© + Ã™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜Â¶Ã™â€¦Ã˜Â§Ã™â€¦ Ã™â€žÃ˜ÂºÃ˜Â±Ã™Â Ã˜Â¹Ã˜Â§Ã™â€¦Ã˜Â© Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±.`;
    }
    if (activeScenario.id === 'self_harm') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° ${appLabel}: Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Å’ Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â²Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â©Ã˜Å’ Ã™Ë†Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã™â€žÃ˜ÂµÃ™Å Ã™â€šÃ˜Â© Ã™â€žÃ™â€žÃ™â€¦Ã˜Â­Ã™ÂÃ˜Â²Ã˜Â§Ã˜Âª Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã™Ë†Ã˜Â±Ã˜Â©.`;
    }
    if (activeScenario.id === 'sexual_exploitation') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜Â¹Ã˜Â²Ã™â€ž Ã™â€šÃ™â€ Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° ${appLabel}Ã˜Å’ Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹Ã˜Å’ Ã™Ë†Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™â€¦Ã™Å  Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â©.`;
    }
    if (activeScenario.id === 'account_theft_fraud') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜ÂªÃ˜Â¯Ã™Ë†Ã™Å Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â± Ã™â€žÃ™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã™â‚¬ ${appLabel}Ã˜Å’ Ã˜Â¥Ã˜ÂºÃ™â€žÃ˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€žÃ˜Â³Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·Ã˜Â©Ã˜Å’ Ã™Ë†Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â±Ã˜Â¯Ã˜Â§Ã˜Â¯ Ã™â€¦Ã˜Â´Ã˜Â¯Ã˜Â¯Ã˜Â©.`;
    }
    if (activeScenario.id === 'gambling_betting') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã™â‚¬ ${appLabel}Ã˜Å’ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â­Ã˜Â¯Ã™Ë†Ã˜Â¯ Ã˜Â¥Ã™â€ Ã™ÂÃ˜Â§Ã™â€šÃ˜Å’ Ã™Ë†Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¨Ã˜Â¯Ã˜Â§Ã™â€ž Ã™â€ Ã™â€¦Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â±Ã™â€¡Ã˜Â§Ã™â€  Ã˜Â¨Ã˜Â£Ã™â€ Ã˜Â´Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â¯Ã™Å Ã™â€žÃ˜Â©.`;
    }
    if (activeScenario.id === 'privacy_tracking') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã˜Â£Ã˜Â«Ã˜Â± ${appLabel} Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â©: Ã˜Â¶Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â°Ã™Ë†Ã™â€ Ã˜Â§Ã˜ÂªÃ˜Å’ Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹Ã˜Å’ Ã™Ë†Ã˜ÂªÃ™â€ Ã˜Â¸Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜Â´Ã™Ë†Ã™ÂÃ˜Â©.`;
    }
    if (activeScenario.id === 'harmful_challenges') {
      return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜Â¹Ã˜Â²Ã™â€ž Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã™â€ Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° ${appLabel}Ã˜Å’ Ã™â€¦Ã˜Â¹ Ã˜Â®Ã˜Â·Ã˜Â© Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã˜ÂªÃ˜Â±Ã˜Â¨Ã™Ë†Ã™Å  Ã˜Â¹Ã˜Â§Ã˜Â¬Ã™â€ž Ã™Ë†Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã™Å Ã™Ë†Ã™â€¦Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.`;
    }
    return `Ã™â€ Ã™Ë†Ã˜ÂµÃ™Å  Ã˜Â¨Ã˜Â®Ã˜Â·Ã˜Â© Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€  Ã˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã™â€¦Ã˜Â®Ã˜ÂµÃ˜ÂµÃ˜Â© Ã™â€žÃ™â‚¬ ${appLabel}: Ã˜ÂªÃ™â€šÃ™â€žÃ™Å Ã™â€ž Ã˜Â³Ã˜Â·Ã˜Â­ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶Ã˜Å’ Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ˜Â§Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ™â€žÃ˜Â­Ã˜Â¸Ã™Å Ã˜Â©Ã˜Å’ Ã™Ë†Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â© Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å Ã˜Â© Ã˜Â¹Ã™â€ Ã˜Â¯ Ã˜Â§Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±.`;
  }, [activeScenario.id, activeContentTrack, activeThreatTrack, dominantPlatform, highRiskApp?.appName, lang]);

  const autoExecutionSteps = useMemo<AutoExecutionStep[]>(
    () => {
      const baseSteps: AutoExecutionStep[] = [
      {
        id: 'snapshot',
        title: 'Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã™ÂÃ™Ë†Ã˜Â±Ã™Å ',
        description: 'Ã˜Â£Ã˜Â®Ã˜Â° Ã™â€žÃ™â€šÃ˜Â·Ã˜Â© Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã™â€žÃ˜Â¥Ã˜Â«Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.',
        command: 'takeScreenshot',
        value: true,
        minSeverity: AlertSeverity.LOW,
        enabledByDefault: true,
      },
      {
        id: 'block-app',
        title: 'Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â±Ã˜Â©',
        description: highRiskApp
          ? `Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â­Ã˜Â¸Ã˜Â± ${highRiskApp.appName} Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ™â€¹Ã˜Â§ Ã™â€žÃ˜Â­Ã™Å Ã™â€  Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â±Ã™Â.`
          : 'Ã™â€žÃ˜Â§ Ã™Å Ã™Ë†Ã˜Â¬Ã˜Â¯ Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã™â€¦Ã˜Â±Ã˜ÂµÃ™Ë†Ã˜Â¯ Ã™â€žÃ™Å Ã˜ÂªÃ™â€¦ Ã˜Â­Ã˜Â¸Ã˜Â±Ã™â€¡ Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å Ã™â€¹Ã˜Â§.',
        command: 'blockApp',
        value: highRiskApp
          ? {
            appId: highRiskApp.id,
            appName: highRiskApp.appName,
            blocked: true,
            isBlocked: true,
            reason: 'digital_balance_auto',
          }
          : null,
        minSeverity: AlertSeverity.MEDIUM,
        enabledByDefault: !!highRiskApp,
      },
      {
        id: 'video-source',
        title: 'Ã˜Â¶Ã˜Â¨Ã˜Â· Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Â±Ã˜Â©',
        description: 'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â«: Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â².',
        command: 'setVideoSource',
        value: planVideoSource,
        minSeverity: AlertSeverity.HIGH,
        enabledByDefault: true,
      },
      {
        id: 'audio-source',
        title: 'Ã˜Â¶Ã˜Â¨Ã˜Â· Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Âª',
        description: 'Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Âª: Ã™â€¦Ã™Å Ã™Æ’Ã˜Â±Ã™Ë†Ã™ÂÃ™Ë†Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â².',
        command: 'setAudioSource',
        value: planAudioSource,
        minSeverity: AlertSeverity.HIGH,
        enabledByDefault: true,
      },
      {
        id: 'start-stream',
        title: 'Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã˜Â¨Ã˜Â« Ã˜Â±Ã™â€šÃ˜Â§Ã˜Â¨Ã™Å  Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±',
        description: 'Ã˜ÂªÃ˜Â´Ã˜ÂºÃ™Å Ã™â€ž Ã˜Â¨Ã˜Â« Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â± Ã™â€žÃ™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â© Ã™â€¦Ã™â€  Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â±.',
        command: 'startLiveStream',
        value: {
          videoSource: planVideoSource,
          audioSource: planAudioSource,
          source: 'digital_balance_auto',
        },
        minSeverity: AlertSeverity.HIGH,
        enabledByDefault: true,
      },
      {
        id: 'lock-device',
        title: 'Ã™â€šÃ™ÂÃ™â€ž Ã™Ë†Ã™â€šÃ˜Â§Ã˜Â¦Ã™Å  Ã™â€¦Ã˜Â¤Ã™â€šÃ˜Âª',
        description: 'Ã™â€šÃ™ÂÃ™â€ž Ã™â€¦Ã˜Â¤Ã™â€šÃ˜Âª Ã™â€žÃ™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã˜Â­Ã˜ÂªÃ™â€° Ã˜Â§Ã™Æ’Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€šÃ™Å Ã™Å Ã™â€¦.',
        command: 'lockDevice',
        value: true,
        minSeverity: AlertSeverity.CRITICAL,
        enabledByDefault: true,
      },
      {
        id: 'blackout-screen',
        title: 'Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â³Ã™Ë†Ã˜Â¯Ã˜Â§Ã˜Â¡ Ã˜Â¨Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â©',
        description: 'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â­Ã˜Â¬Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã™â€¦Ã˜Â¹ Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â¥Ã˜Â±Ã˜Â´Ã˜Â§Ã˜Â¯Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â­Ã˜ÂªÃ™â€° Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€žÃ˜Â¯Ã™Å Ã™â€ .',
        command: 'lockscreenBlackout',
        value: { enabled: true, source: 'digital_balance_auto' },
        minSeverity: AlertSeverity.HIGH,
        enabledByDefault:
          activeScenario.id === 'bullying' ||
          activeScenario.id === 'self_harm' ||
          activeScenario.id === 'sexual_exploitation' ||
          activeScenario.id === 'harmful_challenges' ||
          (activeScenario.id === 'threat_exposure' && activeThreatTrack.preferBlackout) ||
          (activeScenario.id === 'inappropriate_content' && activeContentTrack.preferBlackout),
      },
      {
        id: 'walkie-enable',
        title: 'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã™â€šÃ™â€ Ã˜Â§Ã˜Â© Walkie-Talkie',
        description: 'Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜ÂªÃ™Å  Ã˜Â§Ã™â€žÃ™ÂÃ™Ë†Ã˜Â±Ã™Å  Ã˜Â¨Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€žÃ˜Â¯ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.',
        command: 'walkieTalkieEnable',
        value: { enabled: true, source: 'mic' },
        minSeverity: AlertSeverity.HIGH,
        enabledByDefault:
          activeScenario.id === 'self_harm' ||
          activeScenario.id === 'sexual_exploitation' ||
          activeScenario.id === 'harmful_challenges' ||
          (activeScenario.id === 'threat_exposure' && activeThreatTrack.preferWalkie),
      },
      {
        id: 'net-quarantine',
        title: 'Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¨Ã™Æ’Ã˜Â© Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ˜Â§Ã™â€¹',
        description: 'Ã™â€šÃ˜Â·Ã˜Â¹ Ã˜Â§Ã˜ÂªÃ˜ÂµÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€ Ã˜ÂªÃ˜Â±Ã™â€ Ã˜Âª Ã™â€¦Ã˜Â¤Ã™â€šÃ˜ÂªÃ˜Â§Ã™â€¹ Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â£Ã™Ë† Ã˜Â§Ã˜Â³Ã˜ÂªÃ™Æ’Ã™â€¦Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±Ã˜Â©.',
        command: 'cutInternet',
        value: true,
        minSeverity: AlertSeverity.HIGH,
        enabledByDefault:
          (activeScenario.id === 'threat_exposure' && activeThreatTrack.preferCutInternet) ||
          activeScenario.id === 'phishing_links' ||
          activeScenario.id === 'account_theft_fraud',
      },
      {
        id: 'siren',
        title: 'Ã˜ÂµÃ˜Â§Ã™ÂÃ˜Â±Ã˜Â© Ã˜Â±Ã˜Â¯Ã˜Â¹',
        description: 'Ã˜ÂªÃ˜Â´Ã˜ÂºÃ™Å Ã™â€ž Ã˜ÂµÃ˜Â§Ã™ÂÃ˜Â±Ã˜Â© Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â±Ã˜Â¬Ã˜Â© Ã˜Â¬Ã˜Â¯Ã™â€¹Ã˜Â§.',
        command: 'playSiren',
        value: true,
        minSeverity: AlertSeverity.CRITICAL,
        enabledByDefault:
          activeScenario.id === 'harmful_challenges' ||
          (activeScenario.id === 'threat_exposure' && activeThreatTrack.preferSiren) ||
          (activeScenario.id === 'inappropriate_content' && activeContentTrack.preferSiren),
      },
      ];

      const merged = [...baseSteps];
      for (const step of playbookDrivenSteps) {
        if (!merged.some((existing) => existing.command === step.command)) {
          merged.push(step);
        }
      }
      if (allLocksDisabled || !autoLockInAutomationEnabled) {
        return merged.filter((step) => !isAutoLockCommand(step.command));
      }
      return merged;
    },
    [
      activeContentTrack,
      activeScenario.id,
      allLocksDisabled,
      autoLockInAutomationEnabled,
      activeThreatTrack,
      highRiskApp,
      planAudioSource,
      planVideoSource,
      playbookDrivenSteps,
    ]
  );

  useEffect(() => {
    const initSelection: Record<string, boolean> = {};
    const initStatus: Record<string, AutoStepStatus> = {};
    for (const step of autoExecutionSteps) {
      const gateDecision = automationGate.commandDecisions[step.command];
      const isGateAllowed = gateDecision?.allowed ?? true;
      const isPlaybookStep = step.id.startsWith('pb-');
      const isHighRiskTrajectoryPhase = automationGate.containmentEnabled || automationGate.lockEnabled;
      initSelection[step.id] =
        isGateAllowed && (isPlaybookStep ? isHighRiskTrajectoryPhase : step.enabledByDefault);
      initStatus[step.id] = 'idle';
    }
    setAutoSelection(initSelection);
    setAutoStatus(initStatus);
    setAutoRunSummary('');
    setExecutionTimeline([]);
    setTimelineFilter('all');
  }, [
    child?.id,
    activeScenario.id,
    dominantSeverity,
    highRiskApp?.id,
    autoExecutionSteps,
    automationGate.commandDecisions,
    automationGate.containmentEnabled,
    automationGate.lockEnabled,
  ]);

  const pushTimeline = (entry: Omit<PlanTimelineEntry, 'id' | 'at'>) => {
    setExecutionTimeline((prev) =>
      [
        {
          id: `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: new Date(),
          ...entry,
        },
        ...prev,
      ].slice(0, 40)
    );
  };

  const buildSuggestedPlan = (): Partial<CustomMode> => {
    const frequentApps = [...(child.appUsage || [])]
      .sort((a, b) => b.minutesUsed - a.minutesUsed)
      .slice(0, 3)
      .map((app) => app.appName);

    return {
      name: `Digital Balance Mode - ${child.name}`,
      icon: 'DB',
      color: 'bg-indigo-900',
      allowedApps: frequentApps.length > 0 ? frequentApps : ['School App', 'WhatsApp'],
      allowedUrls: [],
      blacklistedUrls: blockedDomains,
      isInternetCut:
        automationGate.containmentEnabled &&
        (dominantSeverity === AlertSeverity.CRITICAL ||
          (activeScenario.id === 'threat_exposure' && activeThreatTrack.preferCutInternet) ||
          activeScenario.id === 'phishing_links' ||
          activeScenario.id === 'account_theft_fraud'),
      isDeviceLocked: false,
      isScreenDimmed: true,
      cameraEnabled: dominantSeverity !== AlertSeverity.CRITICAL,
      micEnabled: true,
      internetStartTime: '06:00',
      internetEndTime: '22:00',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      preferredVideoSource: planVideoSource,
      preferredAudioSource: planAudioSource,
      autoStartLiveStream: severityRank[dominantSeverity] >= severityRank[AlertSeverity.HIGH],
      autoTakeScreenshot: true,
      blackoutOnApply:
        automationGate.lockEnabled &&
        severityRank[dominantSeverity] >= severityRank[AlertSeverity.HIGH] &&
        !allLocksDisabled &&
        (activeScenario.id === 'threat_exposure'
          ? activeThreatTrack.preferBlackout
          : activeScenario.id === 'inappropriate_content'
            ? activeContentTrack.preferBlackout
            : true),
      blackoutMessage: blackoutMessage.trim() || fallbackBlackoutMessage,
      enableWalkieTalkieOnApply:
        automationGate.containmentEnabled &&
        (activeScenario.id === 'bullying' ||
          activeScenario.id === 'self_harm' ||
          activeScenario.id === 'sexual_exploitation' ||
          activeScenario.id === 'harmful_challenges' ||
          (activeScenario.id === 'threat_exposure' && activeThreatTrack.preferWalkie)),
    };
  };

  const handleApplyEmergencyPlan = () => {
    const suggested = buildSuggestedPlan();
    onAcceptPlan(suggested);
    navigate('/modes', { state: { suggestedMode: suggested } });
  };

  const toggleAutoStep = (stepId: string) => {
    if (isAutoRunning) return;
    setAutoSelection((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const runAutoExecutionPlan = async () => {
    if (isAutoRunning) return;
    if (resolvedTargetChildIds.length === 0) {
      const summary = { done: 0, skipped: 0, failed: 1 };
      setAutoRunSummary(
        lang === 'ar'
          ? 'Ã™â€žÃ˜Â§ Ã™Å Ã™â€¦Ã™Æ’Ã™â€  Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â©: Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.'
          : 'Cannot execute plan: no linked devices found for this child.'
      );
      pushTimeline({
        title: lang === 'ar' ? 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°' : 'Execution unavailable',
        detail:
          lang === 'ar'
            ? 'Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª Ã˜Â¹Ã™â€žÃ™Å Ã™â€¡Ã˜Â§.'
            : 'No linked devices were found for this child.',
        status: 'error',
      });
      onPlanExecutionResult?.(summary);
      return summary;
    }
    setIsAutoRunning(true);
    setAutoRunSummary('');
    pushTimeline({
      title: lang === 'ar' ? 'Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°' : 'Execution started',
      detail:
        lang === 'ar'
          ? `Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã˜ÂªÃ˜Â´Ã˜ÂºÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° ${child.name}.`
          : `Started running the plan for ${child.name}.`,
      status: 'info',
    });

    let done = 0;
    let failed = 0;
    let skipped = 0;
    const currentSeverityRank = severityRank[dominantSeverity];

    for (const step of autoExecutionSteps) {
      if (!autoSelection[step.id]) {
        setAutoStatus((prev) => ({ ...prev, [step.id]: 'skipped' }));
        pushTimeline({
          title: step.title,
          detail: lang === 'ar' ? 'Ã˜ÂªÃ™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â®Ã˜Â·Ã™Å  (Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯).' : 'Skipped (not selected).',
          status: 'skipped',
        });
        skipped += 1;
        continue;
      }

      const gateDecision = automationGate.commandDecisions[step.command];
      if (gateDecision && !gateDecision.allowed) {
        setAutoStatus((prev) => ({ ...prev, [step.id]: 'skipped' }));
        pushTimeline({
          title: step.title,
          detail:
            lang === 'ar'
              ? gateDecision.reasonAr
              : gateDecision.reasonEn,
          status: 'skipped',
        });
        skipped += 1;
        continue;
      }

      if (currentSeverityRank < severityRank[step.minSeverity]) {
        setAutoStatus((prev) => ({ ...prev, [step.id]: 'skipped' }));
        pushTimeline({
          title: step.title,
          detail:
            lang === 'ar'
              ? `Ã˜ÂªÃ™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â®Ã˜Â·Ã™Å  Ã™â€žÃ˜Â£Ã™â€  Ã™â€¦Ã˜Â³Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã˜Â£Ã™â€šÃ™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€ Ã™â€° (${step.minSeverity}).`
              : `Skipped because current severity is below minimum (${step.minSeverity}).`,
          status: 'skipped',
        });
        skipped += 1;
        continue;
      }

      if (step.command === 'blockApp' && !highRiskApp) {
        setAutoStatus((prev) => ({ ...prev, [step.id]: 'skipped' }));
        pushTimeline({
          title: step.title,
          detail: lang === 'ar' ? 'Ã˜ÂªÃ™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â®Ã˜Â·Ã™Å  Ã™â€žÃ˜Â¹Ã˜Â¯Ã™â€¦ Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã™Ë†Ã˜Â±Ã˜Â©.' : 'Skipped (no high-risk app).',
          status: 'skipped',
        });
        skipped += 1;
        continue;
      }

      if ((allLocksDisabled || !autoLockInAutomationEnabled) && isAutoLockCommand(step.command)) {
        setAutoStatus((prev) => ({ ...prev, [step.id]: 'skipped' }));
        pushTimeline({
          title: step.title,
          detail:
            lang === 'ar'
              ? allLocksDisabled
                ? 'Ã˜ÂªÃ˜Â®Ã˜Â·Ã™Å  Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™â€žÃ˜Â£Ã™â€  Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã˜Â¬Ã™â€¦Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â£Ã™â€šÃ™ÂÃ˜Â§Ã™â€ž Ã™â€¦Ã™ÂÃ˜Â¹Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª.'
                : 'Ã˜ÂªÃ˜Â®Ã˜Â·Ã™Å  Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™â€žÃ˜Â£Ã™â€  Ã˜Â§Ã™â€žÃ™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å  Ã™â€¦Ã˜Â¹Ã˜Â·Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â·Ã™Ë†Ã˜Â±.'
              : allLocksDisabled
                ? 'Skipped because all locks are disabled in settings.'
                : 'Skipped because automatic lock is disabled in settings.',
          status: 'skipped',
        });
        skipped += 1;
        continue;
      }

      try {
        setAutoStatus((prev) => ({ ...prev, [step.id]: 'pending' }));
        let commandValue = step.value;
        if (step.command === 'lockscreenBlackout') {
          commandValue = {
            enabled: true,
            message: blackoutMessage.trim() || fallbackBlackoutMessage,
            source: 'digital_balance_auto',
          };
        }
        if (step.command === 'walkieTalkieEnable') {
          commandValue = {
            enabled: true,
            source: planAudioSource,
            sourceTag: 'digital_balance_auto',
          };
        }
        const executionResult = await Promise.allSettled(
          resolvedTargetChildIds.map((targetChildId) =>
            sendRemoteCommand(targetChildId, step.command, commandValue)
          )
        );
        const failedTargets = executionResult.filter((result) => result.status === 'rejected').length;
        const succeededTargets = resolvedTargetChildIds.length - failedTargets;
        if (failedTargets === 0) {
          setAutoStatus((prev) => ({ ...prev, [step.id]: 'done' }));
          pushTimeline({
            title: step.title,
            detail:
              lang === 'ar'
                ? `ØªÙ… Ø§Ù„ØªÙ†ÙÙŠØ° Ø¨Ù†Ø¬Ø§Ø­ Ø¹Ù„Ù‰ ${resolvedTargetChildIds.length} Ø¬Ù‡Ø§Ø².`
                : `Executed successfully on ${resolvedTargetChildIds.length} device(s).`,
            status: 'done',
          });
          done += 1;
        } else {
          setAutoStatus((prev) => ({ ...prev, [step.id]: 'error' }));
          pushTimeline({
            title: step.title,
            detail:
              lang === 'ar'
                ? `ØªÙ… Ø§Ù„ØªÙ†ÙÙŠØ° Ø¬Ø²Ø¦ÙŠÙ‹Ø§ (${succeededTargets} Ù†Ø§Ø¬Ø­ / ${failedTargets} ÙØ´Ù„).`
                : `Partial execution (${succeededTargets} succeeded / ${failedTargets} failed).`,
            status: 'error',
          });
          failed += 1;
        }
      } catch (error) {
        console.error(`Auto step failed: ${step.id}`, error);
        setAutoStatus((prev) => ({ ...prev, [step.id]: 'error' }));
        pushTimeline({
          title: step.title,
          detail: lang === 'ar' ? 'Ã™ÂÃ˜Â´Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°.' : 'Execution failed.',
          status: 'error',
        });
        failed += 1;
      }
    }

    const summary = { done, skipped, failed };
    setIsAutoRunning(false);
    setAutoRunSummary(
      lang === 'ar'
        ? `Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° ${done} Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â©Ã˜Å’ Ã˜ÂªÃ˜Â®Ã˜Â·Ã™Å  ${skipped}Ã˜Å’ Ã™Ë†Ã™ÂÃ˜Â´Ã™â€ž ${failed}.`
        : `Executed ${done} steps, skipped ${skipped}, failed ${failed}.`
    );
    pushTimeline({
      title: lang === 'ar' ? 'Ã™â€¦Ã™â€žÃ˜Â®Ã˜Âµ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°' : 'Execution summary',
      detail:
        lang === 'ar'
          ? `${done} Ã˜ÂªÃ™â€¦Ã˜Å’ ${skipped} Ã˜ÂªÃ˜Â®Ã˜Â·Ã™Å Ã˜Å’ ${failed} Ã™ÂÃ˜Â´Ã™â€ž.`
          : `${done} done, ${skipped} skipped, ${failed} failed.`,
      status: failed > 0 ? 'error' : 'done',
    });
    onPlanExecutionResult?.(summary);
    return summary;
  };

  const runPlanAndCreateMode = async () => {
    await runAutoExecutionPlan();
    const suggested = buildSuggestedPlan();
    const modeId = onAcceptPlan(suggested);
    pushTimeline({
      title: lang === 'ar' ? 'Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â°Ã™Æ’Ã™Å ' : 'Smart mode saved',
      detail:
        lang === 'ar'
          ? `Ã˜ÂªÃ™â€¦ Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹ ${suggested.name || ''}.`
          : `Saved mode ${suggested.name || ''}.`,
      status: 'done',
    });
    if (!modeId) {
      pushTimeline({
        title: lang === 'ar' ? 'Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹' : 'Mode ID',
        detail:
          lang === 'ar'
            ? 'Ã˜ÂªÃ™â€¦ Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Â Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Å’ Ã™Å Ã™â€¦Ã™Æ’Ã™â€  Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ™â€¡ Ã™â€¦Ã™â€  Ã˜ÂµÃ™ÂÃ˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã˜Â¶Ã˜Â§Ã˜Â¹.'
            : 'Mode saved without immediate id. You can apply it from Modes page.',
        status: 'info',
      });
      navigate('/modes', { state: { suggestedMode: suggested } });
      return;
    }
    if (onApplyModeToChild) {
      try {
        const applyResults = await Promise.allSettled(
          resolvedTargetChildIds.map((targetChildId) =>
            Promise.resolve().then(() => onApplyModeToChild(targetChildId, modeId))
          )
        );
        const failedTargets = applyResults.filter((result) => result.status === 'rejected').length;
        const succeededTargets = resolvedTargetChildIds.length - failedTargets;

        if (failedTargets === 0) {
          pushTimeline({
            title: lang === 'ar' ? 'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹' : 'Mode applied',
            detail:
              lang === 'ar'
                ? `ØªÙ… ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„ÙˆØ¶Ø¹ Ø¹Ù„Ù‰ ${resolvedTargetChildIds.length} Ø¬Ù‡Ø§Ø² Ù„Ù„Ø·ÙÙ„ ${child.name}.`
                : `Applied mode to ${resolvedTargetChildIds.length} device(s) for ${child.name}.`,
            status: 'done',
          });
        } else {
          pushTimeline({
            title: lang === 'ar' ? 'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹' : 'Mode apply',
            detail:
              lang === 'ar'
                ? `ØªÙ… Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¬Ø²Ø¦ÙŠÙ‹Ø§ (${succeededTargets} Ù†Ø§Ø¬Ø­ / ${failedTargets} ÙØ´Ù„).`
                : `Mode apply partially failed (${succeededTargets} succeeded / ${failedTargets} failed).`,
            status: 'error',
          });
        }
      } catch (error) {
        pushTimeline({
          title: lang === 'ar' ? 'Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹' : 'Mode apply',
          detail: lang === 'ar' ? 'Ã™ÂÃ˜Â´Ã™â€ž Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â¶Ã˜Â¹.' : 'Failed to apply mode.',
          status: 'error',
        });
        console.error('Apply mode from pulse failed', error);
      }
    }
  };

  const stepStateClass = (status: AutoStepStatus) => {
    if (status === 'done') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'pending') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (status === 'error') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'skipped') return 'bg-slate-100 text-slate-500 border-slate-200';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  const stepStateLabel = (status: AutoStepStatus) => {
    if (lang === 'ar') {
      if (status === 'done') return 'Ã˜ÂªÃ™â€¦';
      if (status === 'pending') return 'Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°';
      if (status === 'error') return 'Ã™ÂÃ˜Â´Ã™â€ž';
      if (status === 'skipped') return 'Ã˜ÂªÃ˜Â®Ã˜Â·Ã™Å ';
      return 'Ã˜Â¬Ã˜Â§Ã™â€¡Ã˜Â²';
    }
    if (status === 'done') return 'Done';
    if (status === 'pending') return 'Running';
    if (status === 'error') return 'Failed';
    if (status === 'skipped') return 'Skipped';
    return 'Idle';
  };

  const timelineBadgeClass = (status: PlanTimelineStatus) => {
    if (status === 'done') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'error') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'skipped') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  };

  const timelineStatusLabel = (status: PlanTimelineStatus) => {
    if (lang !== 'ar') return status;
    if (status === 'done') return 'Ã˜ÂªÃ™â€¦';
    if (status === 'error') return 'Ã™ÂÃ˜Â´Ã™â€ž';
    if (status === 'skipped') return 'Ã˜ÂªÃ˜Â®Ã˜Â·Ã™Å ';
    return 'Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â©';
  };

  const filteredExecutionTimeline = useMemo(() => {
    if (timelineFilter === 'all') return executionTimeline;
    return executionTimeline.filter((entry) => entry.status === timelineFilter);
  }, [executionTimeline, timelineFilter]);

  const executionSummary = useMemo(() => {
    return executionTimeline.reduce(
      (acc, entry) => {
        if (entry.status === 'done') acc.done += 1;
        if (entry.status === 'error') acc.failed += 1;
        if (entry.status === 'skipped') acc.skipped += 1;
        return acc;
      },
      { done: 0, failed: 0, skipped: 0 }
    );
  }, [executionTimeline]);

  if (!hasChildContext) {
    return <div className="p-20 text-center font-black">Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Å  Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¨Ã˜Â¶ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å ...</div>;
  }

  const saveExecutionTimelineToVault = async () => {
    if (!onSaveExecutionEvidence || executionTimeline.length === 0 || isSavingExecutionEvidence) return;

    setIsSavingExecutionEvidence(true);
    try {
      const recordId = await onSaveExecutionEvidence({
        childId: resolvedTargetChildIds[0] || child.id,
        childIds: resolvedTargetChildIds,
        childName: child.name,
        scenarioId: activeScenario.id,
        threatSubtype: activeScenario.id === 'threat_exposure' ? threatSubtype : undefined,
        contentSubtype: activeScenario.id === 'inappropriate_content' ? contentSubtype : undefined,
        scenarioTitle: activeScenario.title,
        severity: dominantSeverity,
        dominantPlatform,
        summary: executionSummary,
        timeline: executionTimeline.map((entry) => ({
          title: entry.title,
          detail: entry.detail,
          status: entry.status,
          at: entry.at.toISOString(),
        })),
      });

      pushTimeline({
        title: lang === 'ar' ? 'Ã˜Â­Ã™ÂÃ˜Â¸ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â²Ã™â€ Ã˜Â©' : 'Saved to vault',
        detail:
          lang === 'ar'
            ? 'Ã˜ÂªÃ™â€¦ Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™Æ’Ã˜Â¯Ã™â€žÃ™Å Ã™â€ž Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â±Ã˜Â´Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€ Ã˜Â§Ã˜Â¦Ã™Å .'
            : 'Execution timeline was saved as forensic evidence.',
        status: 'done',
      });

      if (recordId) {
        navigate('/vault', { state: { openAlertId: recordId, presetFilter: 'pulse' } });
      }
    } catch (error) {
      console.error('Save execution evidence failed', error);
      pushTimeline({
        title: lang === 'ar' ? 'Ã˜Â­Ã™ÂÃ˜Â¸ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â²Ã™â€ Ã˜Â©' : 'Save to vault',
        detail:
          lang === 'ar'
            ? 'Ã™ÂÃ˜Â´Ã™â€ž Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â²Ã™â€ Ã˜Â©.'
            : 'Failed to save execution timeline to vault.',
        status: 'error',
      });
    } finally {
      setIsSavingExecutionEvidence(false);
    }
  };

  const exportExecutionTimeline = () => {
    if (filteredExecutionTimeline.length === 0) return;

    const exportPayload = filteredExecutionTimeline.map((entry) => ({
      title: entry.title,
      detail: entry.detail,
      status: entry.status,
      timestamp: entry.at.toISOString(),
      childName: child.name,
      scenarioId: activeScenario.id,
      severity: dominantSeverity,
    }));

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `amanah-execution-timeline-${child.id}-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const copyIncidentPlan = async () => {
    const payload = [
      `Ã˜Â®Ã˜Â·Ã˜Â© 10 Ã˜Â¯Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€š: ${activeScenario.title}`,
      ...resolvedIncidentPlan.map((step, idx) => `${idx + 1}. ${step}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      setCopiedPlan(true);
      setTimeout(() => setCopiedPlan(false), 1500);
    } catch {
      setCopiedPlan(false);
    }
  };

  const previewCount = 2;
  const sectionStateKey = (scenarioId: PsychScenarioId, section: ScenarioSectionKey) =>
    `${scenarioId}:${section}`;
  const isSectionExpanded = (scenarioId: PsychScenarioId, section: ScenarioSectionKey) =>
    !!expandedSectionMap[sectionStateKey(scenarioId, section)];
  const toggleSectionExpansion = (scenarioId: PsychScenarioId, section: ScenarioSectionKey) => {
    const key = sectionStateKey(scenarioId, section);
    setExpandedSectionMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const scenarioOperationalContext: Record<PsychScenarioId, { riskLabel: string; responseWindow: string }> = {
    bullying: { riskLabel: 'Ã˜Â£Ã˜Â°Ã™â€° Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã™Ë†Ã™â€ Ã™ÂÃ˜Â³Ã™Å  Ã™â€¦Ã™â€¦Ã˜ÂªÃ˜Â¯', responseWindow: '48 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    threat_exposure: { riskLabel: 'Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â± Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â¹Ã˜Â¯', responseWindow: 'Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    gaming: { riskLabel: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â²Ã˜Â§Ã™Â Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å  Ã™Ë†Ã˜Â¥Ã˜Â¯Ã™â€¦Ã˜Â§Ã™â€  Ã™â€ Ã™â€¦Ã˜Â·Ã™Å ', responseWindow: '72 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    inappropriate_content: { riskLabel: 'Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã™â€žÃ™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã™â€¦Ã˜Â¤Ã˜Â°Ã™Â Ã™Ë†Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã˜Â¹ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¬Ã™Å ', responseWindow: '48 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    cyber_crime: { riskLabel: 'Ã˜Â§Ã™â€ Ã˜Â­Ã˜Â±Ã˜Â§Ã™Â Ã˜ÂªÃ™â€šÃ™â€ Ã™Å  Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±', responseWindow: 'Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž 24 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    crypto_scams: { riskLabel: 'Ã˜Â®Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â­Ã˜ÂªÃ™Å Ã˜Â§Ã™â€ž Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â«Ã™â€¦Ã˜Â§Ã˜Â±Ã™Å ', responseWindow: 'Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž 24 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    phishing_links: { riskLabel: 'Ã˜Â³Ã˜Â±Ã™â€šÃ˜Â© Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â¹Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¯', responseWindow: 'Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    self_harm: { riskLabel: 'Ã˜Â®Ã˜Â·Ã˜Â± Ã™â€ Ã™ÂÃ˜Â³Ã™Å  Ã™Ë†Ã˜Â¬Ã˜Â³Ã˜Â¯Ã™Å  Ã˜Â­Ã˜Â±Ã˜Â¬', responseWindow: 'Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§ Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â®Ã˜ÂªÃ˜Âµ' },
    sexual_exploitation: { riskLabel: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜ÂºÃ™â€žÃ˜Â§Ã™â€ž Ã˜Â¬Ã™â€ Ã˜Â³Ã™Å  Ã™Ë†Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â³Ã˜Â±Ã™Å ', responseWindow: 'Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    account_theft_fraud: { riskLabel: 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ™Å Ã™â€žÃ˜Â§Ã˜Â¡ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¡Ã™Ë†Ã™Å Ã˜Â©', responseWindow: 'Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž 24 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    gambling_betting: { riskLabel: 'Ã™â€ Ã˜Â²Ã™Å Ã™Â Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã™Ë†Ã˜Â§Ã˜Â¹Ã˜ÂªÃ™Å Ã˜Â§Ã˜Â¯ Ã™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â±Ã˜Â©', responseWindow: '48 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    privacy_tracking: { riskLabel: 'Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€¡Ã˜Â§Ã™Æ’ Ã˜Â®Ã˜ÂµÃ™Ë†Ã˜ÂµÃ™Å Ã˜Â© Ã™Ë†Ã˜ÂªÃ˜ÂªÃ˜Â¨Ã™â€˜Ã˜Â¹ Ã™â€¦Ã˜Â¤Ã˜Â°Ã™Â', responseWindow: 'Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž 24 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©' },
    harmful_challenges: { riskLabel: 'Ã˜Â¥Ã™Å Ã˜Â°Ã˜Â§Ã˜Â¡ Ã˜Â¨Ã˜Â¯Ã™â€ Ã™Å  Ã˜ÂªÃ˜Â­Ã˜Âª Ã˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã™â€ Ã˜Â¯', responseWindow: 'Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã™â€¹Ã˜Â§ Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦' },
  };

  const buildSectionDetail = (
    scenarioId: PsychScenarioId,
    section: Exclude<ScenarioSectionKey, 'interventionProgram' | 'dialogues'>,
    item: string,
    rank: number
  ) => {
    const hasScenarioContext = Object.prototype.hasOwnProperty.call(
      scenarioOperationalContext,
      scenarioId as string
    );
    const resolvedScenarioId = hasScenarioContext ? scenarioId : activeScenario.id;
    const context = scenarioOperationalContext[resolvedScenarioId] || {
      riskLabel: 'Ã™â€¦Ã˜Â®Ã˜Â§Ã˜Â·Ã˜Â± Ã˜Â±Ã™â€šÃ™â€¦Ã™Å Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€¦Ã˜Â©',
      responseWindow: '48 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â©',
    };

    if (import.meta.env.DEV && !hasScenarioContext) {
      console.warn('[PsychologicalInsightView] Missing scenario context for buildSectionDetail:', {
        requestedScenarioId: scenarioId,
        resolvedScenarioId,
        section,
      });
    }

    const rankLabel =
      rank === 1 ? 'Ã˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Ë†Ã™â€°' : rank === 2 ? 'Ã˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â©' : 'Ã˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©';

    if (section === 'symptoms') {
      return `${rankLabel}: Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã™Å Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜Â®Ã˜Â·Ã˜Â± "${context.riskLabel}". Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å : Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â± Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â²Ã™â€¦Ã™â€  Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â§Ã™â€šÃ˜Å’ Ã™Ë†Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€žÃ™â€¹Ã˜Â§ Ã˜Â£Ã™Ë†Ã™â€žÃ™Å Ã™â€¹Ã˜Â§ Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž ${context.responseWindow}.`;
    }
    if (section === 'lurePatterns') {
      return `${rankLabel}: Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ™â€ Ã™â€¦Ã˜Â· Ã™Å Ã™ÂÃ˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦ Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â©Ã™â€¹ Ã™â€žÃ˜Â§Ã˜Â®Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â± Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â© Ã˜Â«Ã™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯. Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å : Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§ Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜Â¯Ã™â€žÃ™Å Ã™â€ž Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž ${context.responseWindow}.`;
    }
    if (section === 'prevention') {
      return `${rankLabel}: Ã˜Â·Ã˜Â¨Ã™â€˜Ã™â€š Ã™â€¡Ã˜Â°Ã™â€¡ Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Â§Ã™Å Ã˜Â© Ã™Æ’Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯ Ã˜Â¯Ã˜Â§Ã˜Â¦Ã™â€¦ Ã˜Â«Ã™â€¦ Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â£Ã˜Â«Ã˜Â±Ã™â€¡Ã˜Â§ Ã˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹Ã™Å Ã™â€¹Ã˜Â§. Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¬Ã˜Â§Ã˜Â­: Ã˜Â§Ã™â€ Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¶ Ã˜ÂªÃ˜Â¹Ã˜Â±Ã˜Â¶ "${context.riskLabel}" Ã™Ë†Ã˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â©.`;
    }
    if (section === 'incidentPlan') {
      return `${rankLabel}: Ã™â€¡Ã˜Â°Ã™â€¡ Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã™Ë†Ã˜Â© Ã˜ÂªÃ˜Â´Ã˜ÂºÃ™Å Ã™â€žÃ™Å Ã˜Â© Ã˜Â¶Ã™â€¦Ã™â€  Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â©. Ã™â€ Ã™ÂÃ™â€˜Ã˜Â°Ã™â€¡Ã˜Â§ Ã™â€¦Ã˜Â¹ Ã˜Â®Ã˜ÂªÃ™â€¦ Ã˜Â²Ã™â€¦Ã™â€ Ã™Å  Ã™Ë†Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã™â€ Ã˜ÂªÃ™Å Ã˜Â¬Ã˜Â© Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­ Ã™â€žÃ˜Â¶Ã™â€¦Ã˜Â§Ã™â€  Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã™â€šÃ™Å Ã™â€š Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã˜Â³Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™â€žÃ˜Â§Ã˜Â­Ã™â€š.`;
    }
    return `${rankLabel}: Ã˜ÂµÃ™Å Ã˜Â§Ã˜ÂºÃ˜Â© Ã˜Â¥Ã™â€ Ã˜Â°Ã˜Â§Ã˜Â± Ã˜ÂªÃ˜Â´Ã˜ÂºÃ™Å Ã™â€žÃ™Å  Ã™â€žÃ™â€¡Ã˜Â°Ã™â€¡ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â©. Ã˜Â§Ã™â€žÃ˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â¨Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°Ã™Å  Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â± Ã™Å Ã˜ÂªÃ™â€ Ã˜Â§Ã˜Â³Ã˜Â¨ Ã™â€¦Ã˜Â¹ "${context.riskLabel}".`;
  };

  const openScenarioSection = (scenarioId: PsychScenarioId, section: PreviewSectionKey) => {
    setActiveScenarioId(scenarioId);
    setExpandedScenarioId(scenarioId);
    const key = sectionStateKey(scenarioId, section);
    setExpandedSectionMap((prev) => ({ ...prev, [key]: true }));
    if (typeof window !== 'undefined') {
      const targetId = `scenario-${scenarioId}-${section}-details`;
      window.setTimeout(() => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  };

  const buildPreviewOperationalInsight = (
    section: PreviewSectionKey,
    item: string,
    rank: number
  ): PreviewOperationalInsight => {
    const isPrimary = rank === 1;
    const normalized = item.toLowerCase();

    if (section === 'symptoms') {
      if (normalized.includes('Ã˜Â­Ã˜Â°Ã™Â') || normalized.includes('Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡')) {
        return {
          badge: isPrimary ? 'Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â­Ã˜Â±Ã˜Â¬Ã˜Â© Ã™â€¦Ã˜Â¨Ã™Æ’Ã˜Â±Ã˜Â©' : 'Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â´Ã™Å Ã™Ë†Ã˜Â¹',
          whyNow: 'Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â± Ã™Å Ã˜Â¹Ã™â€ Ã™Å  Ã˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã™â€¹Ã˜Â§ Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜Â¶Ã˜ÂºÃ˜Â· Ã™â€ Ã˜Â´Ã˜Â· Ã™Å Ã˜Â®Ã˜Â´Ã™â€° Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™Æ’Ã˜Â´Ã™ÂÃ™â€¡.',
          immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã™â€¡Ã˜Â§Ã˜Â¯Ã˜Â¦Ã˜Â© Ã™â€žÃ˜Â¢Ã˜Â®Ã˜Â± 24 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€žÃ˜Â© Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â°Ã™Â.',
          toneClass: isPrimary ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200',
        };
      }
      if (normalized.includes('Ã™â€¦Ã˜Â²Ã˜Â§Ã˜Â¬') || normalized.includes('Ã˜ÂªÃ™Ë†Ã˜ÂªÃ˜Â±')) {
        return {
          badge: isPrimary ? 'Ã˜Â£Ã™Ë†Ã™â€žÃ™Ë†Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å ' : 'Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â´Ã™Å Ã™Ë†Ã˜Â¹',
          whyNow: 'Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â²Ã˜Â§Ã˜Â¬ Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã™â€¦Ã˜Â¨Ã™Æ’Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã˜Â­Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â¶Ã˜Â§Ã˜ÂºÃ˜Â· Ã˜Â£Ã™Ë† Ã˜Â¹Ã™â€žÃ˜Â§Ã™â€šÃ˜Â© Ã™â€¦Ã˜Â¤Ã˜Â°Ã™Å Ã˜Â©.',
          immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã™ÂÃ˜Â­Ã˜Âµ Ã™â€šÃ˜ÂµÃ™Å Ã˜Â± Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã™Æ’Ã™â€ž Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™Ë†Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ™â€ Ã˜ÂªÃ™Å Ã˜Â¬Ã˜Â© Ã˜Â¨Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª.',
          toneClass: isPrimary ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200',
        };
      }
      if (normalized.includes('Ã˜Â§Ã™â€ Ã˜Â³Ã˜Â­Ã˜Â§Ã˜Â¨') || normalized.includes('Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â©')) {
        return {
          badge: isPrimary ? 'Ã˜ÂªÃ˜Â£Ã˜Â«Ã™Å Ã˜Â± Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±' : 'Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â´Ã™Å Ã™Ë†Ã˜Â¹',
          whyNow: 'Ã˜Â§Ã™â€ Ã˜ÂªÃ™â€šÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â«Ã˜Â± Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã˜Â©/Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€žÃ˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã™Å Ã˜Â¹Ã™â€ Ã™Å  Ã˜Â£Ã™â€  Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â© Ã˜ÂªÃ˜ÂªÃ˜ÂµÃ˜Â§Ã˜Â¹Ã˜Â¯.',
          immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã˜Â£Ã˜Â³Ã˜Â±Ã™Å  Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž 72 Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã™Å Ã˜Â© Ã™â€šÃ˜ÂµÃ™Å Ã˜Â±Ã˜Â©.',
          toneClass: isPrimary ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200',
        };
      }
      return {
        badge: isPrimary ? 'Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã˜Â®Ã˜Â·Ã˜Â± Ã™â€¦Ã˜Â±Ã˜ÂªÃ™ÂÃ˜Â¹' : 'Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±',
        whyNow: 'Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã™â€¹Ã˜Â§ Ã™Å Ã˜Â¸Ã™â€¡Ã˜Â± Ã™â€šÃ˜Â¨Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã™â€šÃ™â€¦ Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€ž Ã™â€žÃ™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â©.',
        immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ˜ÂªÃ™Æ’Ã˜Â±Ã˜Â§Ã˜Â± Ã˜Â«Ã™â€¦ Ã™â€¦Ã™â€ Ã˜Â§Ã™â€šÃ˜Â´Ã˜ÂªÃ™â€¡ Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™ÂÃ™Å  Ã˜Â¬Ã™â€žÃ˜Â³Ã˜Â© Ã˜Â¯Ã˜Â¹Ã™â€¦ Ã™â€¦Ã˜Â±Ã™Æ’Ã˜Â²Ã˜Â©.',
        toneClass: isPrimary ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200',
      };
    }

    if (normalized.includes('Ã˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯') || normalized.includes('Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â²') || normalized.includes('Ã™â€ Ã˜Â´Ã˜Â±')) {
      return {
        badge: isPrimary ? 'Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â²Ã˜Â§Ã˜Â² Ã™â€¦Ã˜Â­Ã˜ÂªÃ™â€¦Ã™â€ž' : 'Ã™â€ Ã™â€¦Ã˜Â· Ã˜Â¶Ã˜ÂºÃ˜Â· Ã™â€¦Ã˜ÂªÃ™Æ’Ã˜Â±Ã˜Â±',
        whyNow: 'Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€¡Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â± Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â©Ã™â€¹ Ã™Å Ã˜Â³Ã˜Â¨Ã™â€š Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜ÂµÃ˜Â¹Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã˜Â£Ã™Ë† Ã˜Â³Ã™â€žÃ™Ë†Ã™Æ’Ã™Å Ã˜Â©.',
        immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã™â€žÃ˜Â§ Ã˜ÂªÃ™ÂÃ˜Â§Ã™Ë†Ã˜Â¶Ã˜Å’ Ã˜ÂªÃ™Ë†Ã˜Â«Ã™Å Ã™â€š Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Å’ Ã˜Â­Ã˜Â¸Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Å’ Ã™Ë†Ã˜Â¨Ã˜Â¯Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº.',
        toneClass: isPrimary ? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200',
      };
    }
    if (normalized.includes('Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã™Ë†Ã™â€¡Ã™â€¦Ã™Å Ã˜Â©') || normalized.includes('Ã˜Â«Ã™â€šÃ˜Â©')) {
      return {
        badge: isPrimary ? 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±' : 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã˜Â´Ã˜Â§Ã˜Â¦Ã˜Â¹',
        whyNow: 'Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â«Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â²Ã™Å Ã™ÂÃ˜Â© Ã™â€¡Ã™Ë† Ã˜Â£Ã˜Â³Ã˜Â±Ã˜Â¹ Ã™â€¦Ã˜Â¯Ã˜Â®Ã™â€ž Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â±Ã˜Â§Ã˜Â¬ Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â³Ã˜Â©.',
        immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š Ã™â€šÃ˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â© Ã˜Â¹Ã˜Â¯Ã™â€¦ Ã™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â£Ã™Å  Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â© Ã˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â© Ã™â€¦Ã˜Â¹ Ã˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨ Ã˜Â¬Ã˜Â¯Ã™Å Ã˜Â¯.',
        toneClass: isPrimary ? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200',
      };
    }
    if (normalized.includes('Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª') || normalized.includes('Ã˜Â¥Ã™â€šÃ˜ÂµÃ˜Â§Ã˜Â¡') || normalized.includes('Ã˜Â¥Ã™â€¡Ã˜Â§Ã™â€ Ã˜Â©')) {
      return {
        badge: isPrimary ? 'Ã˜Â¶Ã˜ÂºÃ˜Â· Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â© Ã™â€¦Ã˜Â¤Ã˜Â°Ã™Â' : 'Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã˜Â§Ã˜Â¬Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¹Ã™Å ',
        whyNow: 'Ã˜Â§Ã™â€žÃ˜Â¶Ã˜ÂºÃ˜Â· Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¦Ã˜Â§Ã˜Â¹Ã™Å  Ã™Å Ã˜Â±Ã™ÂÃ˜Â¹ Ã˜Â³Ã˜Â±Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™Ë†Ã™Å Ã™â€šÃ™â€žÃ™â€ž Ã˜Â­Ã™Æ’Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Å Ã™â€¦.',
        immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã˜Â¹Ã˜Â²Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â© Ã˜Â«Ã™â€¦ Ã˜ÂªÃ˜Â¯Ã˜Â±Ã™Å Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â¹Ã˜Â¨Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â±Ã™ÂÃ˜Â¶ Ã˜Â¬Ã˜Â§Ã™â€¡Ã˜Â²Ã˜Â©.',
        toneClass: isPrimary ? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200',
      };
    }
    return {
      badge: isPrimary ? 'Ã˜Â·Ã˜Â±Ã™Å Ã™â€šÃ˜Â© Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã™ÂÃ˜Â¹Ã™â€˜Ã˜Â§Ã™â€žÃ˜Â©' : 'Ã˜Â·Ã˜Â±Ã™Å Ã™â€šÃ˜Â© Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã˜Â´Ã˜Â§Ã˜Â¦Ã˜Â¹Ã˜Â©',
      whyNow: 'Ã™â€¡Ã˜Â°Ã™â€¡ Ã˜Â§Ã™â€žÃ˜Â·Ã˜Â±Ã™Å Ã™â€šÃ˜Â© Ã˜ÂªÃ™ÂÃ˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦ Ã˜Â¹Ã˜Â§Ã˜Â¯Ã˜Â©Ã™â€¹ Ã™â€žÃ˜Â§Ã˜Â®Ã˜ÂªÃ˜Â¨Ã˜Â§Ã˜Â± Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ™Å Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã™â€žÃ™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â±Ã™Å Ã˜Â¹Ã˜Â©.',
      immediateAction: 'Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Ë†Ã˜Â±Ã™Å : Ã˜Â¥Ã™Å Ã™â€šÃ˜Â§Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜Â¹Ã™â€ž + Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â§Ã™â€žÃ˜Â¯Ã™â€žÃ™Å Ã™â€ž + Ã˜Â¥Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº Ã™Ë†Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â± Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.',
      toneClass: isPrimary ? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200',
    };
  };

  const renderRadarAxisTick = (tickProps: {
    x?: number | string;
    y?: number | string;
    cx?: number | string;
    cy?: number | string;
    payload?: { value?: string };
  }) => {
    const { x = 0, y = 0, cx = 0, cy = 0, payload } = tickProps;
    const xNum = Number(x);
    const yNum = Number(y);
    const cxNum = Number(cx);
    const cyNum = Number(cy);
    const dx = xNum - cxNum;
    const dy = yNum - cyNum;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    // Keep Arabic labels away from polygon edges, especially left/right axes.
    const radialOffset = Math.abs(dx) > Math.abs(dy) ? 34 : dy > 0 ? 28 : 24;
    const tx = xNum + (dx / length) * radialOffset;
    const ty = yNum + (dy / length) * radialOffset + (dy > 0 ? 5 : -3);

    let textAnchor: 'middle' | 'start' | 'end' = 'middle';
    if (Math.abs(dx) > 8) {
      textAnchor = dx > 0 ? 'start' : 'end';
    }

    return (
      <text
        x={tx}
        y={ty}
        textAnchor={textAnchor}
        dominantBaseline="central"
        direction="rtl"
        unicodeBidi="plaintext"
        fill="#64748b"
        fontSize={14}
        fontWeight={800}
        fontFamily="Cairo"
      >
        {payload?.value}
      </text>
    );
  };

  const scrollDeviceSelector = (direction: 'prev' | 'next') => {
    const node = selectorRef.current;
    if (!node) return;
    const delta = Math.max(180, Math.round(node.clientWidth * 0.65));
    node.scrollBy({
      left: direction === 'next' ? delta : -delta,
      behavior: 'smooth',
    });
  };

  const isImageAvatar = (value?: string) => {
    const raw = (value || '').trim();
    if (!raw) return false;
    return raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:') || raw.startsWith('/');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-72 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-[2.5rem] p-5 border border-slate-100 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â§Ã˜Â¨Ã™â€š' : 'Previous'}
            onClick={() => scrollDeviceSelector('prev')}
            className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
          >
            {lang === 'ar' ? '>' : '<'}
          </button>
          <div className="flex-1 text-center text-[10px] font-black tracking-wide text-slate-400 uppercase">
            {lang === 'ar' ? 'Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â± Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž' : 'Select Child'}
          </div>
          <button
            type="button"
            aria-label={lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã™â€žÃ™Å ' : 'Next'}
            onClick={() => scrollDeviceSelector('next')}
            className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
          >
            {lang === 'ar' ? '<' : '>'}
          </button>
        </div>

        <div
          ref={selectorRef}
          className="mt-4 flex gap-3 overflow-x-auto pb-1 custom-scrollbar items-stretch snap-x snap-mandatory"
        >
          {logicalChildren.map((group) => {
            const item = group.mergedChild;
            const active = group.groupId === selectedChildId;
            return (
              <button
                key={group.groupId}
                onClick={() => setSelectedChildId(group.groupId)}
                className={`min-w-[230px] flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all whitespace-nowrap text-start snap-start ${
                  active
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:shadow-sm'
                }`}
              >
                {isImageAvatar(item.avatar) ? (
                  <img
                    src={item.avatar}
                    alt={item.name}
                    className="w-11 h-11 rounded-xl object-cover shadow-sm border border-white/50 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                    {item.avatar || 'Ã°Å¸â€˜Â¦'}
                  </div>
                )}
                <div className="text-right">
                  <span className="font-black text-sm block leading-none">{item.name}</span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest mt-1 block ${
                      active ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {group.deviceCount > 1
                      ? lang === 'ar'
                        ? `${group.deviceCount} Ã˜Â£Ã˜Â¬Ã™â€¡Ã˜Â²Ã˜Â© Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â©`
                        : `${group.deviceCount} linked devices`
                      : item.deviceNickname || (lang === 'ar' ? 'Ã˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž' : 'Child Device')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl border-b-8 border-indigo-600">
        <h2 className="text-5xl font-black tracking-tighter mb-2">Amanah Pulse Pro</h2>
        <p className="text-indigo-300 font-bold text-lg opacity-90">
          Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å  Ã™Ë†Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¨Ã˜Â¶ Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â·Ã™ÂÃ™Å  Ã™â€žÃ™â‚¬ {child.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div
          ref={primaryCardRef}
          tabIndex={-1}
          className="bg-[#f4f6fa] rounded-[3.5rem] p-8 md:p-10 shadow-xl border border-[#e8ecf3] h-full flex flex-col items-center focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
        >
          <div className="w-full flex justify-center mb-9">
            <div className="px-8 py-4 bg-[#eef1f6] rounded-full">
              <h3 className="text-[2rem] md:text-[2.2rem] leading-none font-black text-slate-800 text-center">
                Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€  Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å 
              </h3>
            </div>
          </div>
          <div ref={radarContainerRef} className="w-full h-[26rem] relative flex items-center justify-center min-w-0">
            {radarSize.width > 40 && radarSize.height > 40 ? (
              <RadarChart width={radarSize.width} height={radarSize.height} cx="50%" cy="50%" outerRadius="64%" data={radarData}>
                <PolarGrid stroke="#d3dae5" strokeWidth={1.5} />
                <PolarAngleAxis dataKey="subject" tick={renderRadarAxisTick} />
                <RadarComponent
                  name="Amanah Pulse"
                  dataKey="A"
                  stroke="#5f63df"
                  strokeWidth={6}
                  fill="#7b80e7"
                  fillOpacity={0.38}
                />
              </RadarChart>
            ) : (
              <div className="h-full w-full rounded-3xl bg-[#eef2f9]" />
            )}
          </div>
          <div className="w-full mt-3 pt-2">
            <div className="max-w-md mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-6 text-center">
              <div>
                <p className="text-6xl md:text-7xl leading-none font-black text-rose-500">{anxietyScore}</p>
                <p className="mt-2 text-xl md:text-2xl font-black text-slate-400">Ã˜Â§Ã™â€žÃ™â€šÃ™â€žÃ™â€š</p>
              </div>
              <div className="h-32 md:h-36 w-px bg-slate-300"></div>
              <div>
                <p className="text-6xl md:text-7xl leading-none font-black text-indigo-600">{stabilityScore}</p>
                <p className="mt-2 text-xl md:text-2xl font-black text-slate-400">Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€šÃ˜Â±Ã˜Â§Ã˜Â±</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-[4rem] p-10 shadow-2xl border border-indigo-100 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-slate-800">Ã˜Â¨Ã˜Â±Ã™Ë†Ã˜ÂªÃ™Ë†Ã™Æ’Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€šÃ˜ÂªÃ˜Â±Ã˜Â­</h3>
            <div className="bg-white p-7 rounded-[2.5rem] border border-indigo-100 italic font-bold text-indigo-900 leading-relaxed">
              {profile.recommendation}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-indigo-100 rounded-2xl p-4 text-center">
                <p className="text-xs font-black text-slate-500 mb-1">Ã˜Â¬Ã˜Â§Ã™â€¡Ã˜Â²Ã™Å Ã˜Â© Ã˜Â¥Ã˜Â¯Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«</p>
                <p className="text-3xl font-black text-indigo-700">{readinessScore}</p>
              </div>
              <div className="bg-white border border-indigo-100 rounded-2xl p-4 text-center">
                <p className="text-xs font-black text-slate-500 mb-1">Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã˜Â·Ã™ÂÃ˜Â© Ã˜Â§Ã™â€žÃ˜ÂºÃ˜Â§Ã™â€žÃ˜Â¨Ã˜Â©</p>
                <p className="text-xl font-black text-slate-800">{profile.dominantEmotion}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleApplyEmergencyPlan}
            className="py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all"
          >
            Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â­Ã™â€¦Ã˜Â§Ã™Å Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€ 
          </button>
        </div>
      </div>

      <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-black text-slate-900">Ã™â€ Ã˜ÂªÃ™Å Ã˜Â¬Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â´Ã˜Â®Ã™Å Ã˜ÂµÃ™Å  Ã™â€žÃ™â€žÃ˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª</h3>
          {diagnosis ? (
            <span className="px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">
              Ã˜Â¯Ã™â€šÃ˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â´Ã˜Â®Ã™Å Ã˜Âµ: {diagnosis.confidence}%
            </span>
          ) : (
            <span className="px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-xs font-black">
              Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª Ã™Æ’Ã˜Â§Ã™ÂÃ™Å Ã˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž
            </span>
          )}
        </div>

        {diagnosis ? (
          <>
            <p className="text-xs font-bold text-slate-600">
              Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž {diagnosis.analyzedAlertCount} Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ Ã˜Â®Ã˜Â§Ã˜Âµ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€žÃ˜Å’ Ã™Ë†Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ˜Â±Ã˜Â¬Ã™Å Ã˜Â­ Ã˜Â³Ã™Å Ã™â€ Ã˜Â§Ã˜Â±Ã™Å Ã™Ë†{' '}
              <span className="text-indigo-700 font-black">{activeScenario.title}</span> Ã˜Â§Ã˜Â¹Ã˜ÂªÃ™â€¦Ã˜Â§Ã˜Â¯Ã™â€¹Ã˜Â§ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â¯Ã˜Â© + Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¦Ã˜Â© +
              Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã˜Â§Ã™â€š Ã˜Â§Ã™â€žÃ™â€ Ã˜ÂµÃ™Å  + Ã˜Â­Ã˜Â¯Ã˜Â§Ã˜Â«Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã˜Â«.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {diagnosis.reasons.map((reason, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">{reason}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs font-bold text-slate-500">
            Ã˜Â³Ã™Å Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å  Ã™ÂÃ™Ë†Ã˜Â± Ã˜ÂªÃ™Ë†Ã™ÂÃ˜Â± Ã˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž.
          </p>
        )}
      </section>

      <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl space-y-6">
        <h3 className="text-2xl font-black text-slate-900">Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {riskSignals.map((signal) => (
            <article key={signal.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-black text-sm text-slate-900">{signal.title}</h4>
                <span
                  className={`px-3 py-1 rounded-full border text-[10px] font-black ${severityClassMap[signal.severity]}`}
                >
                  {severityTextMap[signal.severity]}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-700 leading-relaxed">{signal.reason}</p>
              <p className="text-xs font-black text-indigo-700">Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã™â€¦Ã™â€šÃ˜ÂªÃ˜Â±Ã˜Â­: {signal.suggestedAction}</p>
            </article>
          ))}
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5">
          <p className="text-xs font-black text-slate-500 mb-3">Ã˜Â§Ã˜ÂªÃ˜Â¬Ã˜Â§Ã™â€¡ Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¨Ã˜Â¶ Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â¨Ã™Ë†Ã˜Â¹</p>
          <div ref={trendContainerRef} className="w-full h-56 min-w-0">
            {trendSize.width > 40 && trendSize.height > 40 ? (
              <BarChart width={trendSize.width} height={trendSize.height} data={weeklyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                <Tooltip cursor={{ fill: '#eef2ff' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[10, 10, 0, 0]} />
              </BarChart>
            ) : (
              <div className="h-full w-full rounded-2xl bg-slate-100" />
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              {lang === 'ar' ? 'Ø§Ù„ØªÙˆÙ‚Ø¹ Ø§Ù„Ø§Ø³ØªØ¨Ø§Ù‚ÙŠ Ù„Ù„Ù…Ø®Ø§Ø·Ø±' : 'Proactive Risk Forecast'}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {lang === 'ar'
                ? 'ØªØ­Ù„ÙŠÙ„ Ø³ÙŠØ§Ù‚ Ø§Ù„Ø­ÙˆØ§Ø± ÙˆØªÙƒØ±Ø§Ø± Ø§Ù„Ø£Ù†Ù…Ø§Ø· Ù„ØªÙˆÙ‚Ø¹ Ù…Ø§ Ù‚Ø¯ ÙŠÙˆØ§Ø¬Ù‡Ù‡ Ø§Ù„Ø·ÙÙ„ Ø®Ù„Ø§Ù„ 7 Ùˆ30 ÙŠÙˆÙ….'
                : 'Dialogue-context and repetition analysis to forecast what the child may face in 7 and 30 days.'}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
              {`Messages: ${psychForecast.context.analyzedMessages}`}
            </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                {lang === 'ar'
                ? `Sources: ${psychForecast.signalFusion.sourceCoverage.sourceCount}/${sourceCoverageTotal}`
                : `Sources: ${psychForecast.signalFusion.sourceCoverage.sourceCount}/${sourceCoverageTotal}`}
              </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              {`Depth: ${psychForecast.signalFusion.sourceCoverage.depthScore}%`}
            </span>
          </div>
        </div>

        {sevenDayTopForecast || thirtyDayTopForecast ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[sevenDayTopForecast, thirtyDayTopForecast]
              .filter(Boolean)
              .map((item, index) => {
                const prediction = item!;
                const isRising = prediction.trend === 'rising';
                const trendClass = isRising
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : prediction.trend === 'cooling'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200';
                return (
                  <article
                    key={`${prediction.scenarioId}-${index}`}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-black text-sm text-slate-900">
                        {index === 0
                          ? lang === 'ar'
                            ? 'ØªÙˆÙ‚Ø¹ 7 Ø£ÙŠØ§Ù…'
                            : '7-day forecast'
                          : lang === 'ar'
                            ? 'ØªÙˆÙ‚Ø¹ 30 ÙŠÙˆÙ…'
                            : '30-day forecast'}
                      </h4>
                      <span className={`px-3 py-1 rounded-full border text-[10px] font-black ${trendClass}`}>
                        {prediction.trend.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-black text-indigo-700">
                      {lang === 'ar' ? prediction.scenarioLabelAr : prediction.scenarioLabelEn}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white border border-slate-200 px-2 py-2 text-center">
                        <p className="text-[10px] font-black text-slate-500">RISK</p>
                        <p className="text-sm font-black text-slate-900">{prediction.riskScore}%</p>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 px-2 py-2 text-center">
                        <p className="text-[10px] font-black text-slate-500">PROB</p>
                        <p className="text-sm font-black text-slate-900">{prediction.probability}%</p>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 px-2 py-2 text-center">
                        <p className="text-[10px] font-black text-slate-500">CONF</p>
                        <p className="text-sm font-black text-slate-900">{prediction.confidence}%</p>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                      {lang === 'ar' ? prediction.explanationAr : prediction.explanationEn}
                    </p>
                    <p className="text-xs font-black text-indigo-700">
                      {lang === 'ar' ? prediction.recommendationAr : prediction.recommendationEn}
                    </p>
                  </article>
                );
              })}
          </div>
        ) : (
          <p className="text-xs font-bold text-slate-500">
            {lang === 'ar'
              ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª ÙƒØ§ÙÙŠØ© Ù„Ù„ØªÙˆÙ‚Ø¹ Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†. Ø³ÙŠØ¸Ù‡Ø± Ø§Ù„ØªÙˆÙ‚Ø¹ Ø¨Ø¹Ø¯ ØªØ±Ø§ÙƒÙ… Ø³ÙŠØ§Ù‚ Ù…Ø­Ø§Ø¯Ø«Ø§Øª ÙƒØ§Ù.'
              : 'Not enough data for forecasting yet. Forecasts appear after enough conversation context is collected.'}
          </p>
        )}

        {psychForecast.context.repeatedTerms.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-black text-slate-500">
              {lang === 'ar' ? 'Ø£ÙƒØ«Ø± Ø§Ù„ÙƒÙ„Ù…Ø§Øª ØªÙƒØ±Ø§Ø±Ù‹Ø§ ÙÙŠ Ø§Ù„Ø³ÙŠØ§Ù‚' : 'Most repeated context terms'}
            </p>
            <div className="flex flex-wrap gap-2">
              {psychForecast.context.repeatedTerms.slice(0, 8).map((term) => (
                <span
                  key={term.term}
                  className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  {term.term} x{term.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {psychForecast.signalFusion.trajectories.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-black text-slate-500">
              {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â¨Ã˜Â¤Ã™Å Ã˜Â© Ã™â€¦Ã˜ÂªÃ˜Â¹Ã˜Â¯Ã˜Â¯Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂµÃ˜Â§Ã˜Â¯Ã˜Â±' : 'Multi-source predictive trajectories'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {psychForecast.signalFusion.trajectories.slice(0, 4).map((trajectory) => {
                const stageClass =
                  trajectory.stage === 'critical'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : trajectory.stage === 'escalating'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200';
                return (
                  <article key={trajectory.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-900">
                        {lang === 'ar' ? trajectory.titleAr : trajectory.titleEn}
                      </p>
                      <span className={`px-2 py-1 rounded-full border text-[10px] font-black ${stageClass}`}>
                        {trajectory.stage.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-center">
                        <p className="text-[10px] font-black text-slate-500">RISK</p>
                        <p className="text-xs font-black text-slate-900">{trajectory.riskScore}%</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-center">
                        <p className="text-[10px] font-black text-slate-500">CONF</p>
                        <p className="text-xs font-black text-slate-900">{trajectory.confidence}%</p>
                      </div>
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                      {lang === 'ar' ? trajectory.explanationAr : trajectory.explanationEn}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {psychForecast.signalFusion.topDriversEn.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-black text-slate-500">
              {lang === 'ar' ? 'Ø£Ù‚ÙˆÙ‰ Ø¯ÙˆØ§ÙØ¹ Ø§Ù„ØªÙˆÙ‚Ø¹ Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ù…ØµØ§Ø¯Ø±' : 'Top multi-source forecast drivers'}
            </p>
            <div className="flex flex-wrap gap-2">
              {psychForecast.signalFusion.topDriversEn.slice(0, 6).map((driver) => (
                <span
                  key={driver}
                  className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  {driver}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bg-gradient-to-br from-indigo-700 to-indigo-500 rounded-[3rem] p-8 text-white shadow-2xl border border-indigo-300/30 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <h3 className="text-2xl md:text-3xl font-black tracking-tight">
              {lang === 'ar' ? 'Ã˜Â®Ã˜Â·Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜Â²Ã™â€  Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦Ã™Å ' : 'Digital Balance Plan'}
            </h3>
            <p className="text-indigo-100 font-bold leading-relaxed">{digitalBalanceNarrative}</p>
          </div>
          <div className="flex flex-col gap-2 text-xs font-black">
            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">
              {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â³Ã™Å Ã™â€ Ã˜Â§Ã˜Â±Ã™Å Ã™Ë†' : 'Scenario'}: {activeScenario.title}
            </span>
            {activeScenario.id === 'threat_exposure' && (
              <span className="px-3 py-1 rounded-full bg-rose-500/25 border border-rose-200/50">
                {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â±' : 'Track'}:{' '}
                {lang === 'ar' ? activeThreatTrack.badgeLabelAr : activeThreatTrack.badgeLabelEn}
              </span>
            )}
            {activeScenario.id === 'inappropriate_content' && (
              <span className="px-3 py-1 rounded-full bg-amber-400/25 border border-amber-100/50">
                {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â±' : 'Track'}:{' '}
                {lang === 'ar' ? activeContentTrack.badgeLabelAr : activeContentTrack.badgeLabelEn}
              </span>
            )}
            {activeScenario.id === 'cyber_crime' && cyberRiskStage && (
              <span className="px-3 py-1 rounded-full bg-cyan-400/25 border border-cyan-100/50">
                {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â­Ã™â€žÃ˜Â©' : 'Stage'}:{' '}
                {lang === 'ar' ? cyberRiskStage.badgeAr : cyberRiskStage.badgeEn}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">
              {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â©' : 'Platform'}: {highRiskApp?.appName || dominantPlatform}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">
              {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯Ã˜Â©' : 'Severity'}: {dominantSeverity}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {blockedDomains.map((domain) => (
            <span key={domain} className="px-3 py-1 rounded-lg text-xs font-black bg-white/15 border border-white/20">
              {domain}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs font-black text-indigo-100 flex flex-col gap-2">
            {lang === 'ar' ? 'Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Â±Ã˜Â©' : 'Video Source'}
            <select
              value={planVideoSource}
              onChange={(event) => setPlanVideoSource(event.target.value as PlanVideoSource)}
              className="bg-white/15 border border-white/30 rounded-xl px-3 py-2 text-white font-black outline-none"
            >
              <option className="text-slate-900" value="camera_front">
                {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™Å Ã˜Â±Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€¦Ã™Å Ã˜Â©' : 'Front Camera'}
              </option>
              <option className="text-slate-900" value="camera_back">
                {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™Å Ã˜Â±Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â®Ã™â€žÃ™ÂÃ™Å Ã˜Â©' : 'Back Camera'}
              </option>
              <option className="text-slate-900" value="screen">
                {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â§Ã˜Â´Ã˜Â©' : 'Screen'}
              </option>
            </select>
          </label>
          <label className="text-xs font-black text-indigo-100 flex flex-col gap-2">
            {lang === 'ar' ? 'Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Âª' : 'Audio Source'}
            <select
              value={planAudioSource}
              onChange={(event) => setPlanAudioSource(event.target.value as PlanAudioSource)}
              className="bg-white/15 border border-white/30 rounded-xl px-3 py-2 text-white font-black outline-none"
            >
              <option className="text-slate-900" value="mic">
                {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ™â€¦Ã™Å Ã™Æ’Ã˜Â±Ã™Ë†Ã™ÂÃ™Ë†Ã™â€ ' : 'Microphone'}
              </option>
              <option className="text-slate-900" value="system">
                {lang === 'ar' ? 'Ã˜ÂµÃ™Ë†Ã˜Âª Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¸Ã˜Â§Ã™â€¦' : 'System Audio'}
              </option>
            </select>
          </label>
        </div>

        <label className="text-xs font-black text-indigo-100 flex flex-col gap-2">
          {lang === 'ar' ? 'Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¬Ã˜Â¨ Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Â§Ã˜Â¦Ã™Å ' : 'Blackout Screen Message'}
          <input
            value={blackoutMessage}
            onChange={(event) => setBlackoutMessage(event.target.value)}
            className="bg-white/15 border border-white/30 rounded-xl px-3 py-2 text-white font-bold outline-none placeholder:text-indigo-200/70"
            placeholder={
              lang === 'ar'
                ? 'Ã™â€¦Ã˜Â«Ã˜Â§Ã™â€ž: Ã˜ÂªÃ™â€¦ Ã™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã™â€žÃ˜Â¯Ã™Ë†Ã˜Â§Ã˜Â¹Ã™Å  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â§Ã™â€ . Ã™Å Ã˜Â±Ã˜Â¬Ã™â€° Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜ÂµÃ™â€ž Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â§Ã™â€žÃ˜Â¯Ã™Å Ã™â€ .'
                : 'Example: Device locked for safety. Please contact a parent.'
            }
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleApplyEmergencyPlan}
            className="px-5 py-3 rounded-xl bg-white text-indigo-700 font-black text-sm shadow active:scale-95"
          >
            {lang === 'ar' ? 'Ã˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã™Ë†Ã˜Â¶Ã˜Â¹ Ã˜Â°Ã™Æ’Ã™Å  Ã™â€¦Ã™â€šÃ˜ÂªÃ˜Â±Ã˜Â­' : 'Create Suggested Smart Mode'}
          </button>
          <button
            onClick={runAutoExecutionPlan}
            disabled={isAutoRunning}
            className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black text-sm shadow disabled:opacity-50 active:scale-95"
          >
            {isAutoRunning
              ? lang === 'ar'
                ? 'Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°...'
                : 'Running...'
              : lang === 'ar'
                ? 'Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â© Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å Ã˜Â§Ã™â€¹'
                : 'Execute Plan Automatically'}
          </button>
          <button
            onClick={runPlanAndCreateMode}
            disabled={isAutoRunning}
            className="px-5 py-3 rounded-xl bg-emerald-500 text-white font-black text-sm shadow disabled:opacity-50 active:scale-95"
          >
            {isAutoRunning
              ? lang === 'ar'
                ? 'Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°...'
                : 'Running...'
              : lang === 'ar'
                ? 'Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° + Ã˜Â­Ã™ÂÃ˜Â¸ + Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€š'
                : 'Execute + Save as Mode'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl space-y-5">
        <div>
          <h3 className="text-xl font-black text-slate-900">
            {lang === 'ar' ? 'Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å ' : 'Auto Execution Steps'}
          </h3>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {lang === 'ar'
              ? 'Ã™Å Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ˜Â´Ã˜ÂºÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â£Ã™Ë†Ã˜Â§Ã™â€¦Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜Â§Ã˜Â±Ã˜Â© Ã™â€¦Ã˜Â¨Ã˜Â§Ã˜Â´Ã˜Â±Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â¬Ã™â€¡Ã˜Â§Ã˜Â² Ã˜Â§Ã™â€žÃ˜Â·Ã™ÂÃ™â€ž Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡Ã™â€¹ Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã˜Â³Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å .'
              : 'Selected commands run directly on the child device based on the current risk severity.'}
          </p>
          {allLocksDisabled && (
            <p className="mt-2 text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {lang === 'ar'
                ? 'Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã˜Â¬Ã™â€¦Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â£Ã™â€šÃ™ÂÃ˜Â§Ã™â€ž Ã™â€¦Ã™ÂÃ˜Â¹Ã™â€žÃ˜Å’ Ã™Ë†Ã™â€žÃ™â€  Ã™Å Ã˜ÂªÃ™â€¦ Ã˜Â¥Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€ž Ã˜Â£Ã™Å  Ã˜Â£Ã™Ë†Ã˜Â§Ã™â€¦Ã˜Â± Ã™â€šÃ™ÂÃ™â€ž Ã˜Â£Ã™Ë† Ã˜Â´Ã˜Â§Ã˜Â´Ã˜Â© Ã˜Â­Ã˜Â¬Ã˜Â¨.'
                : 'All lock actions are disabled, and no lock/blackout commands will be sent.'}
            </p>
          )}
          {!allLocksDisabled && !autoLockInAutomationEnabled && (
            <p className="mt-2 text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {lang === 'ar'
                ? 'Ã˜Â§Ã™â€žÃ™â€šÃ™ÂÃ™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å  Ã™â€¦Ã˜Â¹Ã˜Â·Ã™â€ž Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜ÂªÃ˜Å’ Ã™Ë†Ã˜Â³Ã™Å Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â¨Ã˜Â§Ã™â€šÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª Ã™ÂÃ™â€šÃ˜Â·.'
                : 'Automatic lock is disabled from settings, and only non-lock actions will run.'}
            </p>
          )}
        </div>

          <p
            className={`mt-2 text-[11px] font-black rounded-lg px-3 py-2 border ${
              automationGate.lockEnabled
                ? 'text-rose-700 bg-rose-50 border-rose-200'
                : automationGate.containmentEnabled
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-slate-700 bg-slate-100 border-slate-200'
            }`}
          >
            {lang === 'ar' ? automationGate.summaryAr : automationGate.summaryEn}
          </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {autoExecutionSteps.map((step) => {
                        const checked = !!autoSelection[step.id];
            const status = autoStatus[step.id] || 'idle';
            const gateDecision = automationGate.commandDecisions[step.command];
            const blockedByTrajectoryGate = !!gateDecision && !gateDecision.allowed;
            return (
              <article key={step.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="font-black text-sm text-slate-900">{step.title}</h4>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
                  <button
                                        onClick={() => toggleAutoStep(step.id)}
                    disabled={isAutoRunning || blockedByTrajectoryGate}
                    className={`w-12 h-7 rounded-full p-1 transition-all disabled:opacity-50 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        checked ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-slate-200 text-slate-700">
                    {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¯Ã™â€ Ã™â€°' : 'Min'}: {step.minSeverity}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black border ${stepStateClass(status)}`}>
                    {stepStateLabel(status)}
                  </span>
                </div>
                {blockedByTrajectoryGate && (
                  <p className="text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {lang === 'ar' ? gateDecision.reasonAr : gateDecision.reasonEn}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {autoRunSummary && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700 px-4 py-3 text-xs font-black">
            {autoRunSummary}
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-black text-slate-900">
              {lang === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â²Ã™â€¦Ã™â€ Ã™Å  Ã™â€žÃ™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°' : 'Execution Timeline'}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500">
                {lang === 'ar'
                  ? `${filteredExecutionTimeline.length} / ${executionTimeline.length} Ã˜Â£Ã˜Â­Ã˜Â¯Ã˜Â§Ã˜Â«`
                  : `${filteredExecutionTimeline.length} / ${executionTimeline.length} events`}
              </span>
              <button
                onClick={saveExecutionTimelineToVault}
                disabled={
                  executionTimeline.length === 0 ||
                  isSavingExecutionEvidence ||
                  !onSaveExecutionEvidence
                }
                className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black disabled:opacity-40"
              >
                {isSavingExecutionEvidence
                  ? lang === 'ar'
                    ? 'Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ˜Â­Ã™ÂÃ˜Â¸...'
                    : 'Saving...'
                  : lang === 'ar'
                    ? 'Ã˜Â­Ã™ÂÃ˜Â¸ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â²Ã™â€ Ã˜Â©'
                    : 'Save to Vault'}
              </button>
              <button
                onClick={exportExecutionTimeline}
                disabled={filteredExecutionTimeline.length === 0}
                className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black disabled:opacity-40"
              >
                {lang === 'ar' ? 'Ã˜ÂªÃ˜ÂµÃ˜Â¯Ã™Å Ã˜Â± JSON' : 'Export JSON'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'done', 'error', 'skipped', 'info'] as const).map((statusKey) => {
              const isActive = timelineFilter === statusKey;
              const label =
                statusKey === 'all'
                  ? lang === 'ar'
                    ? 'Ã˜Â§Ã™â€žÃ™Æ’Ã™â€ž'
                    : 'All'
                  : timelineStatusLabel(statusKey);
              return (
                <button
                  key={statusKey}
                  onClick={() => setTimelineFilter(statusKey)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black border ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {filteredExecutionTimeline.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {filteredExecutionTimeline.map((entry) => (
                <article
                  key={entry.id}
                  className="bg-white border border-slate-100 rounded-xl px-3 py-2 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-900">{entry.title}</p>
                    <p className="text-xs font-bold text-slate-600">{entry.detail}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${timelineBadgeClass(entry.status)}`}>
                      {timelineStatusLabel(entry.status)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {formatTimeDefault(entry.at, { includeSeconds: true })}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-500">
              {lang === 'ar'
                ? executionTimeline.length > 0
                  ? 'Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â£Ã˜Â­Ã˜Â¯Ã˜Â§Ã˜Â« Ã˜Â¶Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜ÂªÃ˜Â± Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å .'
                  : 'Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™â€žÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã™Ë†Ã˜Â§Ã˜Âª Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å Ã™â€¹Ã˜Â§.'
                : executionTimeline.length > 0
                  ? 'No events for the selected filter.'
                  : 'Run the plan to populate execution timeline.'}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Ã™â€¦Ã˜Â±Ã™Æ’Ã˜Â² Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¨Ã˜Â¶ Ã˜Â§Ã™â€žÃ™â€ Ã™ÂÃ˜Â³Ã™Å </h3>
          <p className="text-slate-500 font-bold">Ã˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã™â€¦Ã˜Â¯Ã™â€¦Ã˜Â¬Ã˜Â© Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ™â€¦Ã˜Â¯Ã˜Â¯: Ã™â€¦Ã™â€žÃ˜Â®Ã˜Âµ Ã˜Â³Ã˜Â±Ã™Å Ã˜Â¹ Ã˜Â«Ã™â€¦ Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â©.</p>
        </div>

        <div className="space-y-5 pt-1">
          {guidanceScenarios.map((scenario) => {
            const isExpanded = expandedScenarioId === scenario.id;
            const isActiveScenario = activeScenarioId === scenario.id;
            const glass = scenarioGlassStyles[scenario.id];
            const incidentSteps =
              scenario.id === 'threat_exposure'
                ? isActiveScenario
                  ? resolvedIncidentPlan
                  : scenario.incidentPlan
                : scenario.id === 'inappropriate_content'
                  ? isActiveScenario
                    ? resolvedIncidentPlan
                    : scenario.incidentPlan
                  : scenario.incidentPlan;
            const alertTemplates =
              scenario.id === 'threat_exposure'
                ? isActiveScenario
                  ? resolvedAlertTemplates
                  : scenario.alertTemplates
                : scenario.id === 'inappropriate_content'
                  ? isActiveScenario
                    ? resolvedAlertTemplates
                    : scenario.alertTemplates
                  : scenario.alertTemplates;
            const canExpandSymptoms = scenario.symptoms.length > previewCount;
            const canExpandLurePatterns = scenario.lurePatterns.length > previewCount;

            return (
              <article
                key={scenario.id}
                className={`relative w-full overflow-hidden rounded-[3rem] border border-slate-100 bg-white/55 backdrop-blur-xl shadow-xl shadow-slate-900/10 transition-all duration-300 ${
                  isExpanded ? 'ring-2 ring-white/70' : ''
                }`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glass.tint}`} />
                <div className="relative p-5 space-y-4">
                  <header className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScenarioId(scenario.id);
                        setExpandedScenarioId((prev) => (prev === scenario.id ? null : scenario.id));
                      }}
                      className="flex items-center gap-3 text-right"
                    >
                      <div className="h-12 w-12 rounded-2xl bg-white/85 shadow-[0_2px_8px_rgba(15,23,42,0.08)] flex items-center justify-center text-2xl">
                        {scenario.icon}
                      </div>
                      <div>
                        <h4 className="text-base md:text-lg font-black text-slate-900">{scenario.title}</h4>
                        <p className="text-sm font-black text-slate-600">
                          Ã™â€¦Ã˜Â³Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â±: {severityTextMap[scenario.severity]}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveScenarioId(scenario.id);
                        setExpandedScenarioId((prev) => (prev === scenario.id ? null : scenario.id));
                      }}
                      className={`shrink-0 px-3 py-2 rounded-xl text-sm font-black text-white bg-gradient-to-r ${glass.button} shadow-lg`}
                    >
                      {isExpanded ? 'Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž' : 'Ã˜Â§Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â²Ã™Å Ã˜Â¯'}
                    </button>
                  </header>

                  {!isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50/85 border border-slate-100 p-3 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-500">Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¹Ã˜Â±Ã˜Â§Ã˜Â¶ (Ã˜Â£Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â¥Ã˜Â´Ã˜Â§Ã˜Â±Ã˜ÂªÃ™Å Ã™â€ )</p>
                          <button
                            type="button"
                            onClick={() => openScenarioSection(scenario.id, 'symptoms')}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black"
                          >
                            {canExpandSymptoms ? 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©' : 'Ã™ÂÃ˜ÂªÃ˜Â­ Ã˜Â§Ã™â€žÃ™â€šÃ˜Â³Ã™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜ÂµÃ™Å Ã™â€žÃ™Å '}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {scenario.symptoms.slice(0, 2).map((item, idx) => {
                            const preview = buildPreviewOperationalInsight('symptoms', item, idx + 1);
                            return (
                              <article key={`${item}-${idx}`} className="rounded-2xl border border-slate-100 bg-white/95 p-3 space-y-1.5 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${preview.toneClass}`}>
                                    {preview.badge}
                                  </span>
                                  <span className="text-[10px] font-black text-slate-500">#{idx + 1}</span>
                                </div>
                                <p className="text-sm font-black text-slate-800 leading-relaxed">{item}</p>
                                <p className="text-sm font-bold text-slate-600">Ã™â€žÃ™â€¦Ã˜Â§Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ : {preview.whyNow}</p>
                                <p className="text-sm font-bold text-slate-700">{preview.immediateAction}</p>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50/85 border border-slate-100 p-3 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-500">Ã˜Â·Ã˜Â±Ã™â€š Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ (Ã˜Â£Ã˜Â¹Ã™â€žÃ™â€° Ã™â€ Ã™â€¦Ã˜Â·Ã™Å Ã™â€ )</p>
                          <button
                            type="button"
                            onClick={() => openScenarioSection(scenario.id, 'lurePatterns')}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black"
                          >
                            {canExpandLurePatterns ? 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©' : 'Ã™ÂÃ˜ÂªÃ˜Â­ Ã˜Â§Ã™â€žÃ™â€šÃ˜Â³Ã™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜ÂµÃ™Å Ã™â€žÃ™Å '}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {scenario.lurePatterns.slice(0, 2).map((item, idx) => {
                            const preview = buildPreviewOperationalInsight('lurePatterns', item, idx + 1);
                            return (
                              <article key={`${item}-${idx}`} className="rounded-2xl border border-slate-100 bg-white/95 p-3 space-y-1.5 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${preview.toneClass}`}>
                                    {preview.badge}
                                  </span>
                                  <span className="text-[10px] font-black text-slate-500">#{idx + 1}</span>
                                </div>
                                <p className="text-sm font-black text-slate-800 leading-relaxed">{item}</p>
                                <p className="text-sm font-bold text-slate-600">Ã™â€žÃ™â€¦Ã˜Â§Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ : {preview.whyNow}</p>
                                <p className="text-sm font-bold text-slate-700">{preview.immediateAction}</p>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="space-y-4 pt-3">
                      {scenario.id === 'threat_exposure' && isActiveScenario && (
                        <div className="rounded-xl bg-rose-50/80 border border-rose-200 px-3 py-2 text-sm font-black text-rose-700">
                          Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·: {lang === 'ar' ? activeThreatTrack.badgeLabelAr : activeThreatTrack.badgeLabelEn}
                        </div>
                      )}
                      {scenario.id === 'inappropriate_content' && isActiveScenario && (
                        <div className="rounded-xl bg-amber-50/80 border border-amber-200 px-3 py-2 text-sm font-black text-amber-700">
                          Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·: {lang === 'ar' ? activeContentTrack.badgeLabelAr : activeContentTrack.badgeLabelEn}
                        </div>
                      )}
                      {scenario.id === 'cyber_crime' && isActiveScenario && cyberRiskStage && (
                        <div className="rounded-xl bg-cyan-50/80 border border-cyan-200 px-3 py-2 text-sm font-black text-cyan-700">
                          Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â­Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·Ã˜Â©: {lang === 'ar' ? cyberRiskStage.badgeAr : cyberRiskStage.badgeEn}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div
                          id={`scenario-${scenario.id}-symptoms-details`}
                          className="rounded-2xl bg-slate-50/85 border border-slate-100 p-4 space-y-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-500">Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¹Ã˜Â±Ã˜Â§Ã˜Â¶ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜ÂµÃ™Å Ã™â€žÃ™Å Ã˜Â©</p>
                            <button
                              type="button"
                              onClick={() => toggleSectionExpansion(scenario.id, 'symptoms')}
                              disabled={!canExpandSymptoms}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                                canExpandSymptoms ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {canExpandSymptoms
                                ? isSectionExpanded(scenario.id, 'symptoms')
                                  ? 'Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã™â€šÃ™â€ž'
                                  : 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©'
                                : 'Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã˜ÂµÃ˜Â± Ã˜Â¸Ã˜Â§Ã™â€¡Ã˜Â±Ã˜Â©'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(isSectionExpanded(scenario.id, 'symptoms')
                              ? scenario.symptoms
                              : scenario.symptoms.slice(0, previewCount)
                            ).map((item, idx) => (
                              <article key={`${item}-${idx}`} className="rounded-2xl bg-white/95 border border-slate-100 p-3 space-y-1 shadow-sm">
                                <p className="text-sm font-black text-slate-800">{idx + 1}. {item}</p>
                                <p className="text-sm font-bold text-slate-600">
                                  {buildSectionDetail(scenario.id, 'symptoms', item, idx + 1)}
                                </p>
                              </article>
                            ))}
                          </div>
                        </div>

                        <div
                          id={`scenario-${scenario.id}-lurePatterns-details`}
                          className="rounded-2xl bg-slate-50/85 border border-slate-100 p-4 space-y-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-500">Ã˜Â·Ã˜Â±Ã™â€š Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ˜Â¯Ã˜Â±Ã˜Â§Ã˜Â¬ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜ÂµÃ™Å Ã™â€žÃ™Å Ã˜Â©</p>
                            <button
                              type="button"
                              onClick={() => toggleSectionExpansion(scenario.id, 'lurePatterns')}
                              disabled={!canExpandLurePatterns}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                                canExpandLurePatterns ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {canExpandLurePatterns
                                ? isSectionExpanded(scenario.id, 'lurePatterns')
                                  ? 'Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã™â€šÃ™â€ž'
                                  : 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©'
                                : 'Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã˜ÂµÃ˜Â± Ã˜Â¸Ã˜Â§Ã™â€¡Ã˜Â±Ã˜Â©'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(isSectionExpanded(scenario.id, 'lurePatterns')
                              ? scenario.lurePatterns
                              : scenario.lurePatterns.slice(0, previewCount)
                            ).map((item, idx) => (
                              <article key={`${item}-${idx}`} className="rounded-2xl bg-white/95 border border-slate-100 p-3 space-y-1 shadow-sm">
                                <p className="text-sm font-black text-slate-800">{idx + 1}. {item}</p>
                                <p className="text-sm font-bold text-slate-600">
                                  {buildSectionDetail(scenario.id, 'lurePatterns', item, idx + 1)}
                                </p>
                              </article>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50/85 border border-slate-100 p-4 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-500">Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Â§Ã™Å Ã˜Â© (Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©)</p>
                          <button
                            type="button"
                            onClick={() => toggleSectionExpansion(scenario.id, 'prevention')}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black"
                          >
                            {isSectionExpanded(scenario.id, 'prevention') ? 'Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã™â€šÃ™â€ž' : 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(isSectionExpanded(scenario.id, 'prevention')
                            ? scenario.prevention
                            : scenario.prevention.slice(0, previewCount)
                          ).map((item, idx) => (
                            <article key={`${item}-${idx}`} className="rounded-2xl bg-white/95 border border-slate-100 p-3 space-y-1 shadow-sm">
                              <p className="text-sm font-black text-slate-800">{idx + 1}. {item}</p>
                              <p className="text-sm font-bold text-slate-600">
                                {buildSectionDetail(scenario.id, 'prevention', item, idx + 1)}
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50/85 border border-slate-100 p-4 space-y-2 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-500">Ã˜Â®Ã˜Â·Ã˜Â© 10 Ã˜Â¯Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€š (Ã˜ÂªÃ™ÂÃ˜ÂµÃ™Å Ã™â€ž)</p>
                            <button
                              type="button"
                              onClick={() => toggleSectionExpansion(scenario.id, 'incidentPlan')}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black"
                            >
                              {isSectionExpanded(scenario.id, 'incidentPlan') ? 'Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã™â€šÃ™â€ž' : 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(isSectionExpanded(scenario.id, 'incidentPlan')
                              ? incidentSteps
                              : incidentSteps.slice(0, previewCount)
                            ).map((step, idx) => (
                              <article key={`${step}-${idx}`} className="rounded-2xl bg-white/95 border border-slate-100 p-3 space-y-1 shadow-sm">
                                <p className="text-sm font-black text-slate-800">{idx + 1}. {step}</p>
                                <p className="text-sm font-bold text-slate-600">
                                  {buildSectionDetail(scenario.id, 'incidentPlan', step, idx + 1)}
                                </p>
                              </article>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-slate-50/85 border border-slate-100 p-4 space-y-2 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-500">Ã˜Â±Ã˜Â³Ã˜Â§Ã˜Â¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã˜Â¨Ã™Å Ã™â€¡ (Ã˜ÂªÃ™ÂÃ˜ÂµÃ™Å Ã™â€ž)</p>
                            <button
                              type="button"
                              onClick={() => toggleSectionExpansion(scenario.id, 'alertTemplates')}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black"
                            >
                              {isSectionExpanded(scenario.id, 'alertTemplates') ? 'Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã™â€šÃ™â€ž' : 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(isSectionExpanded(scenario.id, 'alertTemplates')
                              ? alertTemplates
                              : alertTemplates.slice(0, previewCount)
                            ).map((template, idx) => (
                              <article key={`${template}-${idx}`} className="rounded-2xl bg-white/95 border border-slate-100 p-3 space-y-1 shadow-sm">
                                <p className="text-sm font-black text-slate-800">{idx + 1}. {template}</p>
                                <p className="text-sm font-bold text-slate-600">
                                  {buildSectionDetail(scenario.id, 'alertTemplates', template, idx + 1)}
                                </p>
                              </article>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50/85 border border-slate-100 p-4 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-500">Ã˜Â¨Ã˜Â±Ã™â€ Ã˜Â§Ã™â€¦Ã˜Â¬ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€žÃ˜Â§Ã˜Â¬Ã™Å  (Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹)</p>
                          <button
                            type="button"
                            onClick={() => toggleSectionExpansion(scenario.id, 'interventionProgram')}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black"
                          >
                            {isSectionExpanded(scenario.id, 'interventionProgram') ? 'Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã™â€šÃ™â€ž' : 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(isSectionExpanded(scenario.id, 'interventionProgram')
                            ? scenario.interventionProgram
                            : scenario.interventionProgram.slice(0, previewCount)
                          ).map((step, idx) => (
                            <article key={`${step.week}-${idx}`} className="rounded-2xl bg-white/95 border border-slate-100 p-3 space-y-1 shadow-sm">
                              <p className="text-[10px] font-black text-indigo-600">{step.week}</p>
                              <p className="text-sm font-black text-slate-800">{step.goal}</p>
                              <p className="text-sm font-bold text-slate-600">{step.action}</p>
                              <p className="text-sm font-bold text-slate-500">
                                Ã˜Â´Ã˜Â±Ã˜Â­ Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°Ã™Å : Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã™â€¡Ã˜Â¯Ã™Â &quot;{step.goal}&quot; Ã˜Â¹Ã˜Â¨Ã˜Â± Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ &quot;{step.action}&quot; Ã™â€¦Ã˜Â¹ Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â£Ã˜Â«Ã˜Â±Ã™â€¡ Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž 7 Ã˜Â£Ã™Å Ã˜Â§Ã™â€¦.
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50/85 border border-slate-100 p-4 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-500">Ã˜Â§Ã™â€žÃ˜Â­Ã™Ë†Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã˜Â¨Ã™Ë†Ã™Å Ã˜Â© (Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©)</p>
                          <button
                            type="button"
                            onClick={() => toggleSectionExpansion(scenario.id, 'dialogues')}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black"
                          >
                            {isSectionExpanded(scenario.id, 'dialogues') ? 'Ã˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â£Ã™â€šÃ™â€ž' : 'Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã™â€¦Ã™Ë†Ã˜Â³Ã˜Â¹Ã˜Â©'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(isSectionExpanded(scenario.id, 'dialogues')
                            ? scenario.dialogues
                            : scenario.dialogues.slice(0, previewCount)
                          ).map((dialogue, idx) => (
                            <article key={`${dialogue.situation}-${idx}`} className="rounded-2xl bg-white/95 border border-slate-100 p-3 space-y-1 shadow-sm">
                              <p className="text-sm font-black text-slate-500">{dialogue.situation}</p>
                              <p className="text-sm font-black text-slate-800">{dialogue.opener}</p>
                              <p className="text-sm font-bold text-slate-600">{dialogue.advice}</p>
                              <p className="text-sm font-bold text-slate-500">
                                Ã˜Â¥Ã˜Â±Ã˜Â´Ã˜Â§Ã˜Â¯ Ã˜ÂªÃ˜Â·Ã˜Â¨Ã™Å Ã™â€šÃ™Å : Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â­Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â«Ã™â€¦ Ã˜Â§Ã˜Â³Ã˜Â£Ã™â€ž Ã˜Â³Ã˜Â¤Ã˜Â§Ã™â€žÃ™â€¹Ã˜Â§ Ã™â€¦Ã™ÂÃ˜ÂªÃ™Ë†Ã˜Â­Ã™â€¹Ã˜Â§Ã˜Å’ Ã™Ë†Ã˜Â§Ã˜Â®Ã˜ÂªÃ™â€¦ Ã˜Â¨Ã˜Â®Ã˜Â·Ã™Ë†Ã˜Â© Ã˜Â£Ã™â€¦Ã˜Â§Ã™â€  Ã™Ë†Ã˜Â§Ã˜Â­Ã˜Â¯Ã˜Â© Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€žÃ˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™ÂÃ™Ë†Ã˜Â±Ã™â€¹Ã˜Â§.
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>

                      {isActiveScenario && (
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm font-black text-slate-700">{quickAdvisorTip}</p>
                          <button
                            onClick={copyIncidentPlan}
                            className="px-4 py-2 text-sm font-black rounded-xl bg-slate-900 text-white"
                          >
                            {copiedPlan ? 'Ã˜ÂªÃ™â€¦ Ã˜Â§Ã™â€žÃ™â€ Ã˜Â³Ã˜Â®' : 'Ã™â€ Ã˜Â³Ã˜Â® Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â·Ã˜Â©'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

    </div>
  );
};

export default PsychologicalInsightView;


