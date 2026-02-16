
import { prisma } from '../prisma';
import { appendCustodyEvent } from '../forensics/custody';

export type ThreatInput = {
  familyId: string;
  deviceId: string;
  childId: string;
  sourceKey: string;
  threatType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  appPackage?: string | null;
  appName?: string | null;
  url?: string | null;
  payload: any;
};

export async function processThreatEvent(t: ThreatInput) {
  // 1. تسجيل الحدث الخام
  const threatRow = await prisma.threatEvent.create({
    data: {
      family_id: t.familyId,
      device_id: t.deviceId,
      child_id: t.childId,
      source_key: t.sourceKey,
      threat_type: t.threatType,
      severity: t.severity,
      confidence: t.confidence,
      app_package: t.appPackage,
      app_name: t.appName,
      url: t.url,
      payload_json: JSON.stringify(t.payload),
    }
  });

  // 2. تحديث أو إنشاء حادثة (Incident)
  const incident = await prisma.incident.upsert({
    where: { incident_id: `inc_${t.familyId}_${t.threatType}` }, // تبسيط للمثال
    create: {
      family_id: t.familyId,
      device_id: t.deviceId,
      child_id: t.childId,
      threat_type: t.threatType,
      severity: t.severity,
      confidence: t.confidence,
      title: `${t.threatType} detected on ${t.appName || 'device'}`,
      incident_json: JSON.stringify({}),
    },
    update: {
      last_seen_at: new Date(),
      severity: t.severity,
      confidence: t.confidence,
    }
  });

  // 3. تقييم قواعد الدفاع (Rule Evaluation)
  const rules = await prisma.defenseRule.findMany({
    where: { family_id: t.familyId, is_enabled: true },
    orderBy: { priority: 'desc' }
  });

  const matchedActions: any[] = [];
  for (const rule of rules) {
    const match = JSON.parse(rule.match_json);
    // منطق بسيط للمطابقة
    if (match.threat_types?.includes(t.threatType) && match.min_severity === t.severity) {
      matchedActions.push(...JSON.parse(rule.actions_json));
      break; // نكتفي بأعلى قاعدة أولوية
    }
  }

  // 4. تنفيذ الأوامر السيادية
  const commandIds: string[] = [];
  for (const action of matchedActions) {
    const cmd = await prisma.deviceCommand.create({
      data: {
        family_id: t.familyId,
        device_id: t.deviceId,
        command_key: action.action_key,
        payload_json: JSON.stringify(action.params || {}),
        status: 'queued',
        requested_by: 'system_auto_defense'
      }
    } as any);
    commandIds.push(cmd.command_id);
  }

  // 5. توثيق جنائي
  await appendCustodyEvent({
    familyId: t.familyId,
    incidentId: incident.incident_id,
    deviceId: t.deviceId,
    userId: null,
    eventKey: 'AUTO_DEFENSE_EXECUTED',
    actor: 'system:ase',
    eventJson: { threat_event_id: threatRow.threat_event_id, actions: matchedActions, command_ids: commandIds }
  });

  return { incident_id: incident.incident_id, actions_count: matchedActions.length };
}
