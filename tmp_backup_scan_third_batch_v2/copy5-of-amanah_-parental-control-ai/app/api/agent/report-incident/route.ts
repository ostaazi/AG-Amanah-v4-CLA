
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireDevicePrincipal, DeviceAuthError } from '../../../lib/device-auth';
import { decidePolicy, enqueueCommands } from '../../../lib/policy-engine';
import {
  IncidentType,
  Severity,
  ContentType,
  CustodyAction,
} from '@prisma/client';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

function cleanEnum(input: string) {
  return String(input || '').trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const devicePrincipal = await requireDevicePrincipal(req);
    const body = await req.json().catch(() => ({}));

    const incident_type = cleanEnum(body?.incident_type) as IncidentType;
    const severity = cleanEnum(body?.severity) as Severity;
    const content_type = cleanEnum(body?.content_type) as ContentType;

    const summary = String(body?.summary || '').trim().slice(0, 400);
    const object_uri = body?.object_uri ? String(body.object_uri).slice(0, 500) : null;
    const sha256 = String(body?.sha256 || '').trim().slice(0, 64);
    const tags = Array.isArray(body?.tags) ? body.tags.slice(0, 10).map((x: any) => String(x).trim().toLowerCase()) : [];
    const app_package = body?.app_package ? String(body.app_package).slice(0, 120) : null;

    if (!summary || summary.length < 10) return jsonError(400, 'summary required (min 10 chars)');
    if (!sha256 || sha256.length < 16) return jsonError(400, 'sha256 required');

    const device = await prisma.device.findUnique({
      where: { device_id: devicePrincipal.device_id },
      select: { device_id: true, family_id: true, child_id: true },
    });

    if (!device) return jsonError(404, 'Device not found');

    const created = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          family_id: device.family_id,
          child_id: device.child_id,
          device_id: device.device_id,
          incident_type,
          severity,
        },
      });

      const evidence = await tx.evidence.create({
        data: {
          family_id: device.family_id,
          incident_id: incident.incident_id,
          child_id: device.child_id,
          device_id: device.device_id,
          content_type,
          severity,
          summary,
          object_uri,
          sha256,
          tags,
          notes: app_package ? `app_package:${app_package}` : null,
        },
      });

      await tx.custodyLog.create({
        data: {
          evidence_id: evidence.evidence_id,
          actor_device_id: device.device_id,
          action: CustodyAction.CREATE,
          reason: 'agent_report_incident',
        },
      });

      return { incident, evidence };
    });

    const decision = await decidePolicy({
      family_id: device.family_id,
      incident_type,
      severity,
    });

    const commands = await enqueueCommands({
      family_id: device.family_id,
      device_id: device.device_id,
      commands: decision.commands.map((c) => ({
        ...c,
        payload: (c.type === 'APP_KILL' || c.type === 'APP_BLOCK') 
          ? { ...c.payload, app_package: app_package || undefined } 
          : c.payload
      })),
      ttl_sec: 90,
    });

    return NextResponse.json({
      ok: true,
      incident_id: created.incident.incident_id,
      evidence_id: created.evidence.evidence_id,
      commands_count: commands.length,
    });
  } catch (e: any) {
    if (e instanceof DeviceAuthError) return jsonError(e.status, e.message);
    return jsonError(500, e?.message ?? 'Unexpected error');
  }
}
