
/**
 * حساب المسافة بالمتر بين نقطتين على كروية الأرض
 */
export function haversineDistanceMeters(
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): number {
  const R = 6371000; // نصف قطر الأرض بالمتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
