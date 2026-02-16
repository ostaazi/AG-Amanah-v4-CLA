
import { NextRequest, NextResponse } from 'next/server';
import { processThreatEvent } from '../../../../lib/defense/autoDefense';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // ملاحظة: هنا يجب إضافة Device Authentication في الإنتاج
    const result = await processThreatEvent({
      familyId: body.family_id,
      deviceId: body.device_id,
      childId: body.child_id,
      sourceKey: body.source_key,
      threatType: body.threat_type,
      severity: body.severity,
      confidence: body.confidence,
      appPackage: body.app_package,
      appName: body.app_name,
      url: body.url,
      payload: body.payload,
      contentHash: body.content_hash
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
