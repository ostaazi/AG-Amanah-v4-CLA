
import { prisma } from './prisma';
import {
  ActionType,
  CommandType,
  IncidentType,
  Severity,
  ProtocolStatus,
  CommandStatus,
} from '@prisma/client';

export type PolicyDecision = {
  protocol_id: string | null;
  actions: { action: ActionType; order: number }[];
  commands: { type: CommandType; payload: any }[];
};

function severityRank(s: Severity): number {
  switch (s) {
    case 'LOW': return 1;
    case 'MED': return 2;
    case 'HIGH': return 3;
    case 'CRITICAL': return 4;
    default: return 0;
  }
}

function actionToCommand(action: ActionType, ctx: { blackout_message?: string }) {
  switch (action) {
    case 'APP_KILL':
      return { type: CommandType.APP_KILL, payload: {} };
    case 'APP_BLOCK':
      return { type: CommandType.APP_BLOCK, payload: {} };
    case 'NET_QUARANTINE':
      return { type: CommandType.NET_QUARANTINE, payload: { mode: 'deny_all_except_amanah' } };
    case 'MIC_BLOCK':
      return { type: CommandType.MIC_BLOCK, payload: { enabled: true } };
    case 'CAMERA_BLOCK':
      return { type: CommandType.CAMERA_BLOCK, payload: { enabled: true } };
    case 'LOCKSCREEN_BLACKOUT':
      return {
        type: CommandType.LOCKSCREEN_BLACKOUT,
        payload: {
          enabled: true,
          message: ctx.blackout_message || 'Device locked. Please contact a parent.',
        },
      };
    case 'WALKIE_TALKIE_ENABLE':
      return { type: CommandType.WALKIE_TALKIE_ENABLE, payload: { enabled: true } };
    case 'LIVE_CAMERA_REQUEST':
      return { type: CommandType.LIVE_CAMERA_REQUEST, payload: { mode: 'on_demand' } };
    case 'SCREENSHOT_CAPTURE':
      return { type: CommandType.SCREENSHOT_CAPTURE, payload: { reason: 'incident_protocol' } };
    default:
      return null;
  }
}

export async function decidePolicy(params: {
  family_id: string;
  incident_type: IncidentType;
  severity: Severity;
}): Promise<PolicyDecision> {
  const { family_id, incident_type, severity } = params;

  const protocols = await prisma.safetyProtocol.findMany({
    where: {
      family_id,
      incident_type,
      enabled: true,
      status: ProtocolStatus.PUBLISHED,
    },
    select: {
      protocol_id: true,
      min_severity: true,
      blackout_message: true,
      actions: {
        select: {
          action: true,
          order: true,
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { updated_at: 'desc' },
    take: 30,
  });

  const eligible = protocols.filter((p) => severityRank(severity) >= severityRank(p.min_severity));

  if (eligible.length === 0) {
    return { protocol_id: null, actions: [], commands: [] };
  }

  eligible.sort((a, b) => severityRank(b.min_severity) - severityRank(a.min_severity));

  const chosen = eligible[0];
  const actions = chosen.actions.map((x) => ({ action: x.action, order: x.order }));

  const commands: { type: CommandType; payload: any }[] = [];
  for (const a of actions) {
    const mapped = actionToCommand(a.action, { blackout_message: chosen.blackout_message });
    if (mapped) commands.push(mapped);
  }

  return {
    protocol_id: chosen.protocol_id,
    actions,
    commands,
  };
}

export async function enqueueCommands(params: {
  family_id: string;
  device_id: string;
  issued_by_user_id?: string | null;
  commands: { type: CommandType; payload: any }[];
  ttl_sec?: number;
}) {
  const { family_id, device_id, issued_by_user_id, commands, ttl_sec } = params;
  const ttl = Math.min(Math.max(ttl_sec || 60, 10), 600);
  const expires_at = new Date(Date.now() + ttl * 1000);

  if (commands.length === 0) return [];

  const created = await prisma.$transaction(
    commands.map((c) =>
      prisma.deviceCommand.create({
        data: {
          family_id,
          device_id,
          issued_by_user_id: issued_by_user_id ?? null,
          type: c.type,
          payload_json: c.payload,
          status: CommandStatus.QUEUED,
          expires_at,
        },
        select: {
          command_id: true,
          type: true,
          status: true,
          created_at: true,
          expires_at: true,
        },
      })
    )
  );

  return created;
}
