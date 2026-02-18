import {
  AlertSeverity,
  Category,
  CommandPriority,
  SafetyPlaybook,
  AutomatedAction,
} from '../types';

export interface DefenseAction {
  id: string;
  label: string;
  command: string;
  payload?: any;
  priority: CommandPriority;
}

interface DefenseActionOptions {
  allowAutoLock?: boolean;
  /** Alert confidence score (0-100). Lock commands are suppressed below 70. */
  confidence?: number;
}

const isAutoLockCommand = (command: string): boolean =>
  command === 'lockDevice' || command === 'lockscreenBlackout';

const filterDefenseActions = (
  actions: DefenseAction[],
  options: DefenseActionOptions
): DefenseAction[] => {
  let filtered = actions;
  if (options.allowAutoLock === false) {
    filtered = filtered.filter((action) => !isAutoLockCommand(action.command));
  }
  // Suppress lock commands when confidence is below threshold
  if (options.confidence !== undefined && options.confidence < 70) {
    filtered = filtered.filter((action) => !isAutoLockCommand(action.command));
  }
  return filtered;
};

const severityWeight = (severity: AlertSeverity): number => {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return 4;
    case AlertSeverity.HIGH:
      return 3;
    case AlertSeverity.MEDIUM:
      return 2;
    default:
      return 1;
  }
};

export const getDefenseActions = (
  category: Category,
  severity: AlertSeverity,
  options: DefenseActionOptions = {}
): DefenseAction[] => {
  const weight = severityWeight(severity);
  const common: DefenseAction[] = [
    {
      id: 'notify',
      label: 'Notify Parent',
      command: 'notifyParent',
      priority: CommandPriority.MEDIUM,
    },
  ];

  if (category === Category.PREDATOR || category === Category.SEXUAL_EXPLOITATION) {
    return filterDefenseActions([
      {
        id: 'lock',
        label: 'Emergency Lock',
        command: 'lockDevice',
        payload: true,
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'blackout',
        label: 'Blackout Lock Screen',
        command: 'lockscreenBlackout',
        payload: {
          enabled: true,
          message: 'Device locked for safety. Please contact your parent.',
        },
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'siren',
        label: 'Deterrence Siren',
        command: 'playSiren',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      {
        id: 'screenshot',
        label: 'Capture Evidence',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      {
        id: 'walkie',
        label: 'Enable Walkie-Talkie',
        command: 'walkieTalkieEnable',
        payload: { enabled: true, source: 'mic' },
        priority: CommandPriority.HIGH,
      },
      ...common,
    ], options);
  }

  if (category === Category.BULLYING) {
    return filterDefenseActions([
      {
        id: 'screenshot',
        label: 'Capture Screen',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.MEDIUM,
      },
      {
        id: 'lock_soft',
        label: 'Soft Lock',
        command: 'lockDevice',
        payload: weight >= 3,
        priority: weight >= 3 ? CommandPriority.HIGH : CommandPriority.MEDIUM,
      },
      ...common,
    ], options);
  }

  if (category === Category.SELF_HARM) {
    return filterDefenseActions([
      {
        id: 'lock',
        label: 'Safety Lock',
        command: 'lockDevice',
        payload: true,
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'blackout',
        label: 'Blackout Safety Screen',
        command: 'lockscreenBlackout',
        payload: {
          enabled: true,
          message: 'Safety mode is active. Please wait for parent guidance.',
        },
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'screenshot',
        label: 'Capture Context',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      ...common,
    ], options);
  }

  if (category === Category.BLACKMAIL) {
    return filterDefenseActions([
      {
        id: 'lock',
        label: 'Emergency Lock',
        command: 'lockDevice',
        payload: true,
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'blackout',
        label: 'Blackout Protection Screen',
        command: 'lockscreenBlackout',
        payload: {
          enabled: true,
          message: 'Security hold in progress. Wait for parent guidance.',
        },
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'screenshot',
        label: 'Capture Evidence',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      {
        id: 'walkie',
        label: 'Enable Walkie Channel',
        command: 'walkieTalkieEnable',
        payload: { enabled: true, source: 'mic' },
        priority: CommandPriority.HIGH,
      },
      ...common,
    ], options);
  }

  if (category === Category.SCAM) {
    return filterDefenseActions([
      {
        id: 'quarantine-net',
        label: 'Cut Internet Session',
        command: 'cutInternet',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      {
        id: 'screenshot',
        label: 'Capture Financial Evidence',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      ...common,
    ], options);
  }

  if (category === Category.VIOLENCE) {
    return filterDefenseActions([
      {
        id: 'lock',
        label: 'Emergency Lock',
        command: 'lockDevice',
        payload: true,
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'siren',
        label: 'Deterrence Siren',
        command: 'playSiren',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      {
        id: 'screenshot',
        label: 'Capture Threat Evidence',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      ...common,
    ], options);
  }

  if (category === Category.TAMPER) {
    return filterDefenseActions([
      {
        id: 'lock',
        label: 'Containment Lock',
        command: 'lockDevice',
        payload: true,
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'quarantine-net',
        label: 'Containment Network Cut',
        command: 'cutInternet',
        payload: true,
        priority: CommandPriority.CRITICAL,
      },
      {
        id: 'screenshot',
        label: 'Capture Tamper Evidence',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.HIGH,
      },
      ...common,
    ], options);
  }

  return filterDefenseActions(common, options);
};

const severityWeightFromEnum = (severity: AlertSeverity): number => severityWeight(severity);

const mapPlaybookAction = (action: AutomatedAction): DefenseAction | null => {
  if (!action.isEnabled) return null;

  switch (action.type) {
    case 'LOCK_DEVICE':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Lock Device',
        command: 'lockDevice',
        payload: true,
        priority: CommandPriority.CRITICAL,
      };
    case 'LOCKSCREEN_BLACKOUT':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Blackout Screen',
        command: 'lockscreenBlackout',
        payload: {
          enabled: true,
          message: 'Device locked by family protection protocol.',
        },
        priority: CommandPriority.CRITICAL,
      };
    case 'WALKIE_TALKIE_ENABLE':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Walkie-Talkie',
        command: 'walkieTalkieEnable',
        payload: { enabled: true, source: 'mic' },
        priority: CommandPriority.HIGH,
      };
    case 'LIVE_CAMERA_REQUEST':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Live Camera',
        command: 'startLiveStream',
        payload: { videoSource: 'camera_front', audioSource: 'mic', source: 'playbook' },
        priority: CommandPriority.HIGH,
      };
    case 'SCREENSHOT_CAPTURE':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Screenshot Capture',
        command: 'takeScreenshot',
        payload: true,
        priority: CommandPriority.HIGH,
      };
    case 'BLOCK_APP':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Block App',
        command: 'blockApp',
        payload: true,
        priority: CommandPriority.HIGH,
      };
    case 'SIREN':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Siren',
        command: 'playSiren',
        payload: true,
        priority: CommandPriority.HIGH,
      };
    case 'QUARANTINE_NET':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Cut Internet',
        command: 'cutInternet',
        payload: true,
        priority: CommandPriority.HIGH,
      };
    case 'DISABLE_HARDWARE':
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Disable Hardware',
        command: 'blockCameraAndMic',
        payload: true,
        priority: CommandPriority.HIGH,
      };
    case 'NOTIFY_PARENTS':
    default:
      return {
        id: `pb-${action.id}`,
        label: 'Playbook Notify Parent',
        command: 'notifyParent',
        payload: true,
        priority: CommandPriority.MEDIUM,
      };
  }
};

export const getPlaybookActions = (
  playbooks: SafetyPlaybook[],
  category: Category,
  severity: AlertSeverity,
  options: DefenseActionOptions = {}
): DefenseAction[] => {
  const currentSeverityWeight = severityWeightFromEnum(severity);
  const eligible = playbooks.filter(
    (pb) =>
      pb.enabled &&
      pb.category === category &&
      severityWeightFromEnum(pb.minSeverity) <= currentSeverityWeight
  );

  return filterDefenseActions(
    eligible.flatMap((pb) => pb.actions.map(mapPlaybookAction).filter(Boolean) as DefenseAction[]),
    options
  );
};

export const getDefenseActionsWithPlaybooks = (
  category: Category,
  severity: AlertSeverity,
  playbooks: SafetyPlaybook[] = [],
  options: DefenseActionOptions = {}
): DefenseAction[] => {
  const base = getDefenseActions(category, severity, options);
  const playbookActions = getPlaybookActions(playbooks, category, severity, options);
  const unique = new Map<string, DefenseAction>();
  [...playbookActions, ...base].forEach((action) => {
    if (!unique.has(action.command)) unique.set(action.command, action);
  });
  return filterDefenseActions(Array.from(unique.values()), options).sort((a, b) => {
    const rank = {
      [CommandPriority.CRITICAL]: 4,
      [CommandPriority.HIGH]: 3,
      [CommandPriority.MEDIUM]: 2,
      [CommandPriority.LOW]: 1,
    };
    return rank[b.priority] - rank[a.priority];
  });
};
