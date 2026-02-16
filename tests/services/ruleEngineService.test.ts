import { describe, expect, it } from 'vitest';
import { getDefenseActions, getDefenseActionsWithPlaybooks } from '../../services/ruleEngineService';
import { AlertSeverity, Category, SafetyPlaybook } from '../../types';

describe('ruleEngineService', () => {
  it('includes blackout and walkie actions for predator threats', () => {
    const actions = getDefenseActions(Category.PREDATOR, AlertSeverity.CRITICAL);
    const commands = actions.map((x) => x.command);

    expect(commands).toContain('lockscreenBlackout');
    expect(commands).toContain('walkieTalkieEnable');
    expect(commands).toContain('lockDevice');
  });

  it('maps advanced playbook actions to executable commands', () => {
    const playbooks: SafetyPlaybook[] = [
      {
        id: 'pb-advanced',
        name: 'Advanced Protocol',
        category: Category.BULLYING,
        minSeverity: AlertSeverity.HIGH,
        enabled: true,
        actions: [
          { id: 'a1', type: 'LOCKSCREEN_BLACKOUT', isEnabled: true },
          { id: 'a2', type: 'WALKIE_TALKIE_ENABLE', isEnabled: true },
          { id: 'a3', type: 'LIVE_CAMERA_REQUEST', isEnabled: true },
          { id: 'a4', type: 'SCREENSHOT_CAPTURE', isEnabled: true },
        ],
      },
    ];

    const actions = getDefenseActionsWithPlaybooks(Category.BULLYING, AlertSeverity.CRITICAL, playbooks);
    const commands = actions.map((x) => x.command);

    expect(commands).toContain('lockscreenBlackout');
    expect(commands).toContain('walkieTalkieEnable');
    expect(commands).toContain('startLiveStream');
    expect(commands).toContain('takeScreenshot');
  });

  it('returns financial-blackmail defensive actions for SCAM category', () => {
    const actions = getDefenseActions(Category.SCAM, AlertSeverity.HIGH);
    const commands = actions.map((x) => x.command);

    expect(commands).toContain('cutInternet');
    expect(commands).toContain('takeScreenshot');
    expect(commands).toContain('notifyParent');
  });

  it('returns sexual-blackmail protective actions for SEXUAL_EXPLOITATION category', () => {
    const actions = getDefenseActions(Category.SEXUAL_EXPLOITATION, AlertSeverity.CRITICAL);
    const commands = actions.map((x) => x.command);

    expect(commands).toContain('lockDevice');
    expect(commands).toContain('lockscreenBlackout');
    expect(commands).toContain('walkieTalkieEnable');
  });

  it('returns containment actions for TAMPER category', () => {
    const actions = getDefenseActions(Category.TAMPER, AlertSeverity.CRITICAL);
    const commands = actions.map((x) => x.command);

    expect(commands).toContain('lockDevice');
    expect(commands).toContain('cutInternet');
    expect(commands).toContain('takeScreenshot');
  });
});
