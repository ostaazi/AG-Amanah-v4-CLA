import { describe, expect, it } from 'vitest';
import { buildUnifiedPsychSignals } from '../../services/psychSignalFusionService';
import { AlertSeverity, Category, Child, ChildSignalEvent, MonitoringAlert } from '../../types';

const buildChild = (partial: Partial<Child> = {}): Child => ({
  id: partial.id || 'child-1',
  parentId: partial.parentId || 'parent-1',
  name: partial.name || 'Test Child',
  role: 'CHILD',
  avatar: partial.avatar || 'avatar',
  age: partial.age ?? 12,
  status: partial.status || 'online',
  batteryLevel: partial.batteryLevel ?? 80,
  signalStrength: partial.signalStrength ?? 4,
  screenTimeLimit: partial.screenTimeLimit ?? 180,
  currentScreenTime: partial.currentScreenTime ?? 90,
  deviceLocked: partial.deviceLocked ?? false,
  cameraBlocked: partial.cameraBlocked ?? false,
  micBlocked: partial.micBlocked ?? false,
  preventAppInstall: partial.preventAppInstall ?? false,
  preventDeviceLock: partial.preventDeviceLock ?? false,
  appUsage: partial.appUsage || [],
  location: partial.location,
  psychProfile: partial.psychProfile,
});

const buildAlert = (partial: Partial<MonitoringAlert>): MonitoringAlert => ({
  id: partial.id || 'a1',
  childName: partial.childName || 'Test Child',
  platform: partial.platform || 'screen monitor',
  content: partial.content || '',
  category: partial.category || Category.SAFE,
  severity: partial.severity || AlertSeverity.LOW,
  timestamp: partial.timestamp || new Date(),
  aiAnalysis: partial.aiAnalysis || partial.content || '',
});

const buildSignalEvent = (partial: Partial<ChildSignalEvent>): ChildSignalEvent => ({
  id: partial.id || `ev-${Math.random().toString(36).slice(2, 8)}`,
  parentId: partial.parentId || 'parent-1',
  childId: partial.childId || 'child-1',
  childName: partial.childName || 'Test Child',
  eventType: partial.eventType || 'search_intent',
  source: partial.source || 'screen_guardian',
  platform: partial.platform || 'com.android.chrome',
  content: partial.content || 'search query',
  normalizedContent: partial.normalizedContent || partial.content || 'search query',
  severity: partial.severity || AlertSeverity.MEDIUM,
  confidence: partial.confidence ?? 84,
  scenarioHints: partial.scenarioHints || [],
  timestamp: partial.timestamp || new Date(),
});

describe('psychSignalFusionService', () => {
  it('adds dns_network source when DNS sandbox alert exists', () => {
    const dnsAlert = buildAlert({
      id: 'dns-1',
      platform: 'DNS Filter',
      category: Category.SCAM,
      severity: AlertSeverity.HIGH,
      content: 'Sandbox auto-blocked suspicious domain: verify-login-check.com',
      aiAnalysis: 'DNS sandbox AI blocked this domain automatically (riskScore=88, reason=sandbox_keyword:login).',
    }) as MonitoringAlert & Record<string, unknown>;
    dnsAlert.triggerType = 'DNS';
    dnsAlert.triggerDomain = 'verify-login-check.com';
    dnsAlert.dnsMode = 'sandbox';
    dnsAlert.decisionScore = 88;

    const result = buildUnifiedPsychSignals({
      alerts: [dnsAlert],
      signalEvents: [],
    });

    const dnsEvent = result.events.find((event) => event.source === 'dns_network');
    expect(dnsEvent).toBeDefined();
    expect(dnsEvent?.scenarioHints).toContain('phishing_links');
  });

  it('adds location_risk source when location address has sensitive context', () => {
    const child = buildChild({
      location: {
        lat: 25.2861,
        lng: 51.5348,
        address: 'Night Club district',
        lastUpdated: new Date(),
      },
    });

    const result = buildUnifiedPsychSignals({
      child,
      alerts: [],
      signalEvents: [],
    });

    const locationEvent = result.events.find((event) => event.source === 'location_risk');
    expect(locationEvent).toBeDefined();
    expect(
      locationEvent?.scenarioHints.includes('inappropriate_content') ||
        locationEvent?.scenarioHints.includes('sexual_exploitation')
    ).toBe(true);
  });

  it('adds stale-location signal when device is online but GPS is stale', () => {
    const child = buildChild({
      status: 'online',
      location: {
        lat: 25.2861,
        lng: 51.5348,
        address: 'Test Area',
        lastUpdated: new Date(Date.now() - 30 * 60 * 60 * 1000),
      },
    });

    const result = buildUnifiedPsychSignals({
      child,
      alerts: [],
      signalEvents: [],
    });

    const staleEvent = result.events.find(
      (event) =>
        event.source === 'location_risk' &&
        event.evidence.includes('lastLocationUpdateHours=') &&
        event.scenarioHints.includes('privacy_tracking')
    );
    expect(staleEvent).toBeDefined();
  });

  it('adds chain signal when search and link intents spike in same 6h window', () => {
    const now = Date.now();
    const signalEvents: ChildSignalEvent[] = [
      ...Array.from({ length: 4 }).map((_, index) =>
        buildSignalEvent({
          id: `s-${index}`,
          eventType: 'search_intent',
          content: `search suspicious ${index}`,
          timestamp: new Date(now - (index + 1) * 20 * 60 * 1000),
        })
      ),
      ...Array.from({ length: 4 }).map((_, index) =>
        buildSignalEvent({
          id: `l-${index}`,
          eventType: 'link_intent',
          content: `open domain ${index}`,
          normalizedContent: `http://risk-domain-${index}.com`,
          timestamp: new Date(now - (index + 1) * 24 * 60 * 1000),
        })
      ),
    ];

    const result = buildUnifiedPsychSignals({
      alerts: [],
      signalEvents,
    });

    const chainEvent = result.events.find((event) => event.id === 'sig-chain-search-link');
    expect(chainEvent).toBeDefined();
    expect(chainEvent?.scenarioHints).toContain('phishing_links');
    expect(chainEvent?.source).toBe('web_link');

    const chainTrajectory = result.trajectories.find((trajectory) => trajectory.id === 'traj-search-link-escalation');
    expect(chainTrajectory).toBeDefined();
    expect(chainTrajectory?.scenarioHints).toContain('account_theft_fraud');
    expect(chainTrajectory?.riskScore || 0).toBeGreaterThanOrEqual(40);
  });
});
