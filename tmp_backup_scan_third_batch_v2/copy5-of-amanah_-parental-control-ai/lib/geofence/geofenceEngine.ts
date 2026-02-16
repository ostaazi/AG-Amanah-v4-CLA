
import { prisma } from '../prisma';
import { haversineDistanceMeters } from '../geo/haversine';
import { appendCustodyEvent } from '../forensics/custody';
import { runAutoDefense } from '../defense/defenseOrchestrator';

const JITTER_MARGIN_METERS = 20;

export async function processGeoFencesForHeartbeat(args: {
  familyId: string;
  deviceId: string;
  childId?: string | null;
  location: { lat: number; lng: number; accM?: number | null };
}) {
  // 1. جلب كافة المناطق المفعلة للعائلة
  const zones = await (prisma as any).geoFenceZone.findMany({
    where: { family_id: args.familyId, is_enabled: true }
  });

  for (const zone of zones) {
    const distanceM = haversineDistanceMeters(
      args.location.lat, args.location.lng,
      zone.center_lat, zone.center_lng
    );

    // جلب آخر حالة مسجلة للجهاز في هذه المنطقة
    const state = await (prisma as any).deviceGeoFenceState.findUnique({
      where: { device_id_zone_id: { device_id: args.deviceId, zone_id: zone.zone_id } }
    }) || { is_inside: false };

    let transition: 'ENTER' | 'EXIT' | 'NONE' = 'NONE';

    // منطق الهسترة لمنع القفزات الوهمية
    if (!state.is_inside && distanceM <= (zone.radius_m - JITTER_MARGIN_METERS)) {
      transition = 'ENTER';
    } else if (state.is_inside && distanceM >= (zone.radius_m + JITTER_MARGIN_METERS)) {
      transition = 'EXIT';
    }

    if (transition !== 'NONE') {
      const isInside = transition === 'ENTER';

      // تحديث الحالة في قاعدة البيانات
      await (prisma as any).deviceGeoFenceState.upsert({
        where: { device_id_zone_id: { device_id: args.deviceId, zone_id: zone.zone_id } },
        update: { is_inside: isInside, last_distance_m: distanceM, last_transition_at: new Date() },
        create: { 
          family_id: args.familyId, device_id: args.deviceId, zone_id: zone.zone_id,
          is_inside: isInside, last_distance_m: distanceM, last_transition_at: new Date() 
        }
      });

      // توثيق في سجل الحيازة الجنائي
      await appendCustodyEvent({
        familyId: args.familyId,
        deviceId: args.deviceId,
        eventKey: transition === 'ENTER' ? 'GEOFENCE_ENTER' : 'GEOFENCE_EXIT',
        actor: 'system:geo_engine',
        eventJson: { zone_id: zone.zone_id, zone_name: zone.name, distance_m: distanceM }
      });

      // إشعار الأهل
      if ((transition === 'ENTER' && zone.notify_on_enter) || (transition === 'EXIT' && zone.notify_on_exit)) {
        await (prisma as any).notificationEvent.create({
          data: {
            family_id: args.familyId,
            severity: transition === 'EXIT' && zone.auto_defense_on_exit ? 'critical' : 'warning',
            title: isInside ? `دخول منطقة آمنة: ${zone.name}` : `خروج من منطقة آمنة: ${zone.name}`,
            body: `جهاز الطفل الآن على بعد ${distanceM}م من مركز ${zone.name}.`,
            data_json: JSON.stringify({ device_id: args.deviceId, zone_id: zone.zone_id })
          }
        });
      }

      // تفعيل الدفاع التلقائي عند الخروج إذا كان الإعداد نشطاً
      if (transition === 'EXIT' && zone.auto_defense_on_exit) {
        await runAutoDefense({
          familyId: args.familyId,
          deviceId: args.deviceId,
          childId: args.childId,
          incidentId: `geo_exit_${Date.now()}`,
          severity: zone.defense_severity || 'high',
          threatType: 'GEOFENCE_VIOLATION'
        });
      }
    }
  }
}
