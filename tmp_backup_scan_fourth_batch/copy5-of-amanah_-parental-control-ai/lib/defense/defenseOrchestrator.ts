
import { prisma } from '../prisma';
import { appendCustodyEvent } from '../forensics/custody';

type Severity = 'critical' | 'high' | 'medium' | 'low';

function normalizeSeverity(s: string): Severity {
  const v = (s || '').toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v;
  return 'medium';
}

export async function runAutoDefense(args: {
  familyId: string;
  deviceId: string;
  childId?: string | null;
  incidentId: string;
  severity: string;
  threatType?: string | null;
}) {
  const sev = normalizeSeverity(args.severity);

  // جلب سياسة العائلة أو استخدام الافتراضية
  // ملاحظة: نفترض وجود النموذج في بريزما
  const policy = await (prisma as any).defensePolicy.findUnique({ 
    where: { family_id: args.familyId } 
  }) || {
    critical_lock_overlay: true,
    critical_cut_internet: true,
    critical_block_chatapps: true,
    high_cut_internet: true,
    high_block_chatapps: true,
    medium_block_chatapps: false
  };

  const commands: Array<{ type: string; payload: any; priority: number }> = [];

  if (sev === 'critical') {
    if (policy.critical_block_chatapps) commands.push({ type: 'BLOCK_APP_CATEGORY', payload: { category: 'social' }, priority: 1 });
    if (policy.critical_cut_internet) commands.push({ type: 'CUT_INTERNET', payload: { mode: 'hard' }, priority: 1 });
    if (policy.critical_lock_overlay) commands.push({ type: 'LOCK_OVERLAY', payload: { message: 'تم قفل الجهاز لحمايتك. اتصل بوالدك.' }, priority: 1 });
    commands.push({ type: 'CAPTURE_SCREENSHOT', payload: { reason: 'critical_incident' }, priority: 3 });
  }

  if (sev === 'high') {
    if (policy.high_block_chatapps) commands.push({ type: 'BLOCK_APP_CATEGORY', payload: { category: 'social' }, priority: 2 });
    if (policy.high_cut_internet) commands.push({ type: 'CUT_INTERNET', payload: { mode: 'soft' }, priority: 3 });
  }

  const createdIds: string[] = [];
  for (const c of commands) {
    const row = await (prisma as any).deviceCommand.create({
      data: {
        family_id: args.familyId,
        device_id: args.deviceId,
        child_id: args.childId || null,
        incident_id: args.incidentId,
        cmd_type: c.type,
        cmd_payload_json: JSON.stringify(c.payload),
        priority: c.priority,
        status: 'queued',
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    createdIds.push(row.cmd_id);
  }

  await appendCustodyEvent({
    familyId: args.familyId,
    incidentId: args.incidentId,
    deviceId: args.deviceId,
    eventKey: 'AUTO_DEFENSE_TRIGGERED',
    actor: 'system:ase',
    eventJson: { severity: sev, command_count: createdIds.length, cmd_ids: createdIds },
  });

  return { ok: true, queued_count: createdIds.length };
}
